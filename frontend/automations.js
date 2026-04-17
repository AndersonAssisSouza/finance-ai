/* Finance AI — Automações condicionais
 *
 * Modelo:
 *   automation = {
 *     id, name, active,
 *     trigger: { event, filters: [{ field, op, value }] },
 *     actions: [{ type, params }],
 *     runs: [{ at, tx_id, success }]
 *   }
 *
 * Eventos:
 *   - tx_created: disparado em Store.addTransaction
 *   - tx_updated: disparado em Store.updateTransaction
 *   - daily: disparado 1x por dia (no primeiro boot do dia)
 *
 * Operadores de filtro:
 *   contains, equals, not_equals, gt, gte, lt, lte, between, matches_regex
 *
 * Ações:
 *   - transfer_to_account: transfere % ou valor absoluto para conta
 *   - contribute_goal: contribui % ou valor absoluto para meta
 *   - create_transaction: cria transação relacionada
 *   - notify: dispara notificação (usa Notifs/canais)
 *   - tag: adiciona tags
 *   - set_category: muda categoria
 *   - set_cost_center: atribui centro de custo
 */

const OPS = {
  contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  equals: (a, b) => String(a) === String(b),
  not_equals: (a, b) => String(a) !== String(b),
  gt: (a, b) => +a > +b,
  gte: (a, b) => +a >= +b,
  lt: (a, b) => +a < +b,
  lte: (a, b) => +a <= +b,
  between: (a, [min, max]) => +a >= +min && +a <= +max,
  matches_regex: (a, pattern) => new RegExp(pattern, "i").test(String(a)),
};

function evalFilter(tx, filter) {
  let value;
  switch (filter.field) {
    case "description": value = tx.description || ""; break;
    case "amount": value = tx.amount || 0; break;
    case "abs_amount": value = Math.abs(tx.amount || 0); break;
    case "type": value = tx.type || ""; break;
    case "category_id": value = tx.category_id || ""; break;
    case "account_id": value = tx.account_id || ""; break;
    case "date": value = tx.date || ""; break;
    case "day_of_month": value = tx.date ? +tx.date.slice(8, 10) : 0; break;
    default: value = "";
  }
  const op = OPS[filter.op];
  if (!op) return false;
  try { return op(value, filter.value); } catch { return false; }
}

function match(tx, automation) {
  if (!automation.active) return false;
  const filters = automation.trigger?.filters || [];
  if (!filters.length) return true;
  return filters.every(f => evalFilter(tx, f));
}

async function runAction(action, tx, Store) {
  const p = action.params || {};
  switch (action.type) {
    case "transfer_to_account": {
      if (!p.to_account_id || !tx.account_id || tx.account_id === p.to_account_id) return;
      let amount = +p.amount || 0;
      if (p.percent_of_amount) amount = Math.abs(tx.amount || 0) * (+p.percent_of_amount / 100);
      if (amount <= 0) return;
      Store.addTransaction({
        description: p.description || `Auto: ${action.params.label || "transferência automática"}`,
        amount, account_id: tx.account_id,
        type: "transfer", transfer_to_account: p.to_account_id
      });
      return { ok: true, detail: `Transferiu ${amount} para conta ${p.to_account_id}` };
    }
    case "contribute_goal": {
      if (!p.goal_id) return;
      let amount = +p.amount || 0;
      if (p.percent_of_amount) amount = Math.abs(tx.amount || 0) * (+p.percent_of_amount / 100);
      if (amount <= 0) return;
      Store.contributeGoal(p.goal_id, amount);
      return { ok: true, detail: `Aportou ${amount} na meta ${p.goal_id}` };
    }
    case "create_transaction": {
      const payload = {
        description: p.description || "Auto-gerado",
        amount: +p.amount || 0,
        account_id: p.account_id || tx.account_id,
        category_id: p.category_id,
        type: +p.amount >= 0 ? "income" : "expense"
      };
      Store.addTransaction(payload);
      return { ok: true, detail: "Transação criada" };
    }
    case "notify": {
      if (window.Notifs) {
        const id = `auto_${Date.now()}`;
        // bypass dedup
        const sent = JSON.parse(localStorage.getItem("fa_v3_notifs_sent") || "{}");
        delete sent[id];
        localStorage.setItem("fa_v3_notifs_sent", JSON.stringify(sent));
        await Notifs.sendToChannels(p.title || "Automação", p.body || tx.description);
      }
      return { ok: true, detail: "Notificado" };
    }
    case "set_category": {
      if (p.category_id) {
        Store.updateTransaction(tx.id, { category_id: p.category_id });
        return { ok: true, detail: "Categoria atribuída" };
      }
      return;
    }
    case "set_cost_center": {
      if (p.cost_center_id) {
        Store.updateTransaction(tx.id, { cost_center_id: p.cost_center_id });
        return { ok: true, detail: "Centro atribuído" };
      }
      return;
    }
    case "tag": {
      if (Array.isArray(p.tags) && p.tags.length) {
        const t = Store.data.transactions.find(x => x.id === tx.id);
        if (t) {
          t.tags = Array.from(new Set([...(t.tags || []), ...p.tags]));
          Store._save();
          return { ok: true, detail: "Tags adicionadas" };
        }
      }
      return;
    }
  }
}

async function runTriggers(event, tx) {
  if (!window.Store?.data?.automations) return;
  const automations = Store.data.automations.filter(a => a.trigger?.event === event);
  const results = [];
  for (const auto of automations) {
    if (!match(tx, auto)) continue;
    for (const action of auto.actions || []) {
      try {
        const r = await runAction(action, tx, Store);
        results.push({ auto_id: auto.id, action: action.type, ...r });
      } catch (e) {
        results.push({ auto_id: auto.id, action: action.type, ok: false, error: e.message });
      }
    }
    // Log run
    auto.runs = auto.runs || [];
    auto.runs.unshift({ at: new Date().toISOString(), tx_id: tx.id, actions: auto.actions.length });
    if (auto.runs.length > 20) auto.runs.length = 20;
    Store._save();
  }
  return results;
}

/* Hook no Store */
function attachHooks(Store) {
  if (Store._automationsHooked) return;
  Store._automationsHooked = true;

  const originalAdd = Store.addTransaction.bind(Store);
  Store.addTransaction = function(payload) {
    const result = originalAdd(payload);
    // Não dispara em transferências internas (grupos)
    const tx = Array.isArray(result) ? result[0] : result;
    if (tx && tx.type !== "transfer" && !tx.group_id) {
      runTriggers("tx_created", tx).catch(console.warn);
    }
    return result;
  };
}

/* Daily trigger: 1x/dia */
function runDailyIfNeeded() {
  const lastDay = localStorage.getItem("fa_auto_last_daily");
  const today = new Date().toISOString().slice(0, 10);
  if (lastDay === today) return;
  localStorage.setItem("fa_auto_last_daily", today);
  runTriggers("daily", { date: today });
}

function list() { return Store.data?.automations || []; }

function add({ name, trigger, actions }) {
  Store.data.automations = Store.data.automations || [];
  const a = {
    id: "auto_" + Math.random().toString(36).slice(2),
    name, trigger, actions, active: true, runs: [],
    created_at: new Date().toISOString()
  };
  Store.data.automations.push(a);
  Store._save();
  return a;
}

function update(id, patch) {
  const a = Store.data.automations?.find(x => x.id === id);
  if (a) { Object.assign(a, patch); Store._save(); }
}

function remove(id) {
  if (!Store.data.automations) return;
  Store.data.automations = Store.data.automations.filter(a => a.id !== id);
  Store._save();
}

window.Automations = { list, add, update, remove, attachHooks, runDailyIfNeeded, runTriggers, OPS };
