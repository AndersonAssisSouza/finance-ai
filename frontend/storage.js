/* Finance AI v3 — camada de dados completa (localStorage).
 * Modelo: Accounts, Cards, Transactions, Budgets, Goals, Debts,
 * Investments, Categories, Rules, Alerts, Tags.
 * Toda mutação aciona consolidação (recompõe saldos, insights, budgets).
 */

const DB_KEY = "fa_v3_db";
const SESSION_KEY = "fa_v3_session";

const DEFAULT_CATEGORIES = [
  { id: "cat_salary",    name: "Salário",      group: "Receitas",   icon: "💰", color: "#10b981", type: "income" },
  { id: "cat_freelance", name: "Freelance",    group: "Receitas",   icon: "💼", color: "#06b6d4", type: "income" },
  { id: "cat_dividend",  name: "Rendimentos",  group: "Receitas",   icon: "📈", color: "#0ea5e9", type: "income" },
  { id: "cat_other_in",  name: "Outras receitas", group: "Receitas", icon: "🪙", color: "#14b8a6", type: "income" },
  { id: "cat_rent",      name: "Aluguel/Prestação", group: "Moradia", icon: "🏠", color: "#f59e0b" },
  { id: "cat_utilities", name: "Contas da casa",   group: "Moradia", icon: "💡", color: "#eab308" },
  { id: "cat_internet",  name: "Internet/TV",  group: "Moradia",   icon: "📡", color: "#f97316" },
  { id: "cat_grocery",   name: "Supermercado", group: "Alimentação", icon: "🛒", color: "#ef4444" },
  { id: "cat_restaurant",name: "Restaurante",  group: "Alimentação", icon: "🍽️", color: "#f43f5e" },
  { id: "cat_delivery",  name: "Delivery",     group: "Alimentação", icon: "🛵", color: "#dc2626" },
  { id: "cat_fuel",      name: "Combustível",  group: "Transporte",  icon: "⛽", color: "#8b5cf6" },
  { id: "cat_rideshare", name: "Uber/Táxi",    group: "Transporte",  icon: "🚕", color: "#a855f7" },
  { id: "cat_transit",   name: "Transporte público", group: "Transporte", icon: "🚌", color: "#7c3aed" },
  { id: "cat_health",    name: "Saúde",        group: "Saúde",      icon: "⚕️", color: "#22c55e" },
  { id: "cat_pharmacy",  name: "Farmácia",     group: "Saúde",      icon: "💊", color: "#16a34a" },
  { id: "cat_gym",       name: "Academia",     group: "Saúde",      icon: "🏋️", color: "#15803d" },
  { id: "cat_education", name: "Educação",     group: "Educação",   icon: "📚", color: "#3b82f6" },
  { id: "cat_streaming", name: "Streaming",    group: "Lazer",      icon: "📺", color: "#ec4899" },
  { id: "cat_travel",    name: "Viagens",      group: "Lazer",      icon: "✈️", color: "#d946ef" },
  { id: "cat_entertainment", name: "Entretenimento", group: "Lazer", icon: "🎬", color: "#c026d3" },
  { id: "cat_shopping",  name: "Compras",      group: "Compras",    icon: "🛍️", color: "#e11d48" },
  { id: "cat_clothing",  name: "Vestuário",    group: "Compras",    icon: "👕", color: "#be123c" },
  { id: "cat_personal",  name: "Cuidados pessoais", group: "Pessoal", icon: "💇", color: "#9333ea" },
  { id: "cat_subscription", name: "Assinaturas", group: "Pessoal", icon: "🔁", color: "#7e22ce" },
  { id: "cat_taxes",     name: "Impostos/Taxas", group: "Financeiro", icon: "🧾", color: "#78716c" },
  { id: "cat_interest",  name: "Juros/Multas", group: "Financeiro", icon: "⚠️", color: "#57534e" },
  { id: "cat_invest_out",name: "Aporte investimento", group: "Financeiro", icon: "📊", color: "#0891b2", type: "invest" },
  { id: "cat_transfer",  name: "Transferência", group: "Transferência", icon: "🔄", color: "#64748b", type: "transfer" },
  { id: "cat_other",     name: "Outros",       group: "Outros",     icon: "📎", color: "#6b7280" },
];

const AUTO_RULES = [
  { pattern: /ifood|uber eats|rappi/i, category_id: "cat_delivery" },
  { pattern: /uber|99app|99 \-|cabify/i, category_id: "cat_rideshare" },
  { pattern: /netflix|spotify|disney|hbo|prime video|globoplay/i, category_id: "cat_streaming" },
  { pattern: /posto|shell|ipiranga|petrobras|combust/i, category_id: "cat_fuel" },
  { pattern: /mercado|supermerc|carrefour|pão de aç|atacad|extra |assaí/i, category_id: "cat_grocery" },
  { pattern: /farmac|drogaria|drogasil|droga raia|pague menos/i, category_id: "cat_pharmacy" },
  { pattern: /restaurante|burger|pizza|sush|outback|mcdon/i, category_id: "cat_restaurant" },
  { pattern: /vivo|claro|tim |oi fibra|net |algar|nextel/i, category_id: "cat_internet" },
  { pattern: /energ|eletric|cemig|enel|copel|celpe|cpfl|light /i, category_id: "cat_utilities" },
  { pattern: /agua|saneamento|sabesp|cedae|caesb|copasa/i, category_id: "cat_utilities" },
  { pattern: /alug/i, category_id: "cat_rent" },
  { pattern: /conselheir|consult|hospital|clinica|med /i, category_id: "cat_health" },
  { pattern: /academia|smartfit|bioritmo|bluefit/i, category_id: "cat_gym" },
  { pattern: /amazon|mercadolivre|magalu|shopee|shein|aliexpress|americanas/i, category_id: "cat_shopping" },
  { pattern: /curso|udemy|coursera|alura|senai|sesc|faculdade|esc /i, category_id: "cat_education" },
  { pattern: /salar|folha|contracheque|remuner/i, category_id: "cat_salary" },
  { pattern: /rendimento|cdb|tesouro|dividend|b3 |fii /i, category_id: "cat_dividend" },
  { pattern: /^pix|^ted|^doc|^transf/i, category_id: "cat_transfer", type: "transfer" },
  { pattern: /darf|das |inss|irpf|iptu|ipva/i, category_id: "cat_taxes" },
];

function uid(prefix = "") { return prefix + (crypto.randomUUID?.() || Math.random().toString(36).slice(2)); }
function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0,10); }
function monthKey(d) { return (d || today()).slice(0,7); }
function addMonths(ym, n) {
  const [y,m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return date.toISOString().slice(0,7);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function sha(s) { let h = 5381; for (const c of (s||"")) h = ((h*33) ^ c.charCodeAt(0)) >>> 0; return "h" + h.toString(36); }
function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function autoCategorize(description) {
  for (const r of AUTO_RULES) {
    if (r.pattern.test(description || "")) return r.category_id;
  }
  return null;
}

/* Extrai um número de contrato/identificador de descrições opacas tipo
 * "Debito automatico: '0080000355232'" ou "Pagamento conta: 12345678".
 * Retorna a substring do número (>= 6 dígitos) ou null. */
function extractContractNumber(description) {
  const m = String(description || "").match(/(?:^|\D)['"]?(\d{6,})['"]?/);
  return m ? m[1] : null;
}

/* Heurística: descrição opaca de débito automático sem nome do beneficiário. */
function isOpaqueAutoDebit(description) {
  const s = String(description || "");
  return /d[eé]bito\s*autom[aá]tico|d[eé]b\.?\s*auto/i.test(s) && /\d{6,}/.test(s);
}

function emptyDb() {
  return {
    version: 3,
    users: {},
    sessions: {},
    data: {},   // { [user_id]: { accounts, cards, transactions, budgets, goals, debts, investments, rules, categories, alerts, tags, settings } }
  };
}

function emptyUserData() {
  return {
    accounts: [],
    cards: [],
    transactions: [],
    budgets: [],        // [{month:"YYYY-MM", category_id, planned}]
    goals: [],
    debts: [],
    investments: [],
    rules: [],          // regras customizadas { id, pattern, category_id, account_id? }
    recurrences: [],    // [{id, template:{description,amount,category_id,...}, frequency:"monthly"|"weekly"|"daily"|"yearly", day, start_date, end_date, last_generated_date}]
    cost_centers: [],   // [{id, name, color, icon}] — modo empresarial
    automations: [],    // [{id, name, trigger:{event, filters}, actions:[], active, runs}]
    categories: DEFAULT_CATEGORIES.map(c => ({...c})),
    alerts: [],
    tags: [],
    settings: { currency: "BRL", theme: "light", first_name: "", mode: "personal" }  // mode: personal | business
  };
}

class FinanceStore {
  constructor() {
    this.db = this._load();
    this.currentUserId = this._loadSession();
  }
  _load() {
    try { return JSON.parse(localStorage.getItem(DB_KEY)) || emptyDb(); }
    catch { return emptyDb(); }
  }
  _loadSession() { return localStorage.getItem(SESSION_KEY) || null; }
  _save() { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); }
  _saveSession(id) {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
    this.currentUserId = id;
  }

  get user() { return Object.values(this.db.users).find(u => u.id === this.currentUserId); }
  get data() {
    if (!this.currentUserId) return null;
    if (!this.db.data[this.currentUserId]) this.db.data[this.currentUserId] = emptyUserData();
    // Garante shape completo (importações antigas podem ter campos faltando)
    const d = this.db.data[this.currentUserId];
    const defaults = emptyUserData();
    for (const key of Object.keys(defaults)) {
      if (d[key] === undefined || d[key] === null) d[key] = defaults[key];
    }
    return d;
  }

  /* === AUTH === */
  register({ email, password, name }) {
    email = (email || "").trim().toLowerCase();
    if (!email) throw new Error("Email obrigatório");
    if (!password || password.length < 4) throw new Error("Senha mínima de 4 caracteres");
    if (this.db.users[email]) throw new Error("Email já cadastrado");
    const id = uid("u_");
    this.db.users[email] = { id, email, name: name || email.split("@")[0], password: sha(password), created_at: now() };
    this.db.data[id] = emptyUserData();
    this.db.data[id].settings.first_name = name || email.split("@")[0];
    this._saveSession(id);
    this._save();
    return this.user;
  }
  login({ email, password }) {
    email = (email || "").trim().toLowerCase();
    const u = this.db.users[email];
    if (!u || u.password !== sha(password)) throw new Error("Credenciais inválidas");
    this._saveSession(u.id);
    this._save();
    return u;
  }
  logout() { this._saveSession(null); }

  /* === ACCOUNTS === */
  accounts() { return (this.data?.accounts || []).filter(a => !a.archived); }
  accountById(id) { return this.data?.accounts.find(a => a.id === id); }
  addAccount({ name, type = "checking", initial_balance = 0, currency = null, color = "#6366f1", icon = "🏦", include_in_net_worth = true }) {
    const a = {
      id: uid("acc_"), name, type,
      initial_balance: +initial_balance,
      currency: currency || this.data?.settings?.currency || "BRL",
      color, icon, include_in_net_worth, created_at: now()
    };
    this.data.accounts.push(a);
    this._save();
    return a;
  }
  updateAccount(id, patch) {
    const a = this.accountById(id); if (!a) return;
    Object.assign(a, patch); this._save();
  }
  deleteAccount(id) {
    this.data.accounts = this.data.accounts.filter(a => a.id !== id);
    this.data.transactions = this.data.transactions.filter(t => t.account_id !== id);
    this._save();
  }
  accountBalance(id) {
    const acc = this.accountById(id);
    if (!acc) return 0;
    const delta = this.data.transactions
      .filter(t => t.account_id === id)
      .reduce((s,t) => s + t.amount, 0);
    return +(acc.initial_balance + delta).toFixed(2);
  }

  /* === CARDS === */
  cards() { return (this.data?.cards || []).filter(c => !c.archived); }
  cardById(id) { return this.data?.cards.find(c => c.id === id); }
  addCard({ name, limit, closing_day = 25, due_day = 5, color_start = "#6366f1", color_end = "#ec4899", icon = "💳", default_account_id = null }) {
    const c = { id: uid("card_"), name, limit: +limit, closing_day: +closing_day, due_day: +due_day,
                color_start, color_end, icon, default_account_id, created_at: now() };
    this.data.cards.push(c);
    this._save();
    return c;
  }
  updateCard(id, patch) { const c = this.cardById(id); if (c) { Object.assign(c, patch); this._save(); } }
  deleteCard(id) {
    this.data.cards = this.data.cards.filter(c => c.id !== id);
    this.data.transactions = this.data.transactions.filter(t => t.card_id !== id);
    this._save();
  }
  /* Fatura aberta: compras a partir do último fechamento (inclusive) até hoje. */
  cardInvoice(card_id, ref_month = monthKey()) {
    const card = this.cardById(card_id); if (!card) return { total: 0, items: [] };
    const [y, m] = ref_month.split("-").map(Number);
    // ciclo que vence em ref_month: fecha em (m-1)/closing_day; vence em m/due_day
    const closeDate = new Date(y, m - 2, card.closing_day);
    const openDate  = new Date(y, m - 3, card.closing_day); // dia seguinte seria open+1, mas usamos >= open
    openDate.setDate(openDate.getDate() + 1);
    const items = this.data.transactions.filter(t =>
      t.card_id === card_id &&
      new Date(t.date) >= openDate &&
      new Date(t.date) <= closeDate
    );
    return {
      total: +items.reduce((s,t) => s + t.amount, 0).toFixed(2),
      items,
      close_date: closeDate.toISOString().slice(0,10),
      due_date: new Date(y, m - 1, card.due_day).toISOString().slice(0,10)
    };
  }
  cardCurrentUsage(card_id) {
    /* usado = soma de transações do ciclo corrente (desde último fechamento) */
    const card = this.cardById(card_id); if (!card) return 0;
    const todayD = new Date();
    let openDate = new Date(todayD.getFullYear(), todayD.getMonth(), card.closing_day);
    if (todayD < openDate) openDate = new Date(todayD.getFullYear(), todayD.getMonth() - 1, card.closing_day);
    openDate.setDate(openDate.getDate() + 1);
    const used = this.data.transactions
      .filter(t => t.card_id === card_id && new Date(t.date) >= openDate)
      .reduce((s,t) => s + Math.abs(t.amount), 0);
    return +used.toFixed(2);
  }

  /* === TRANSACTIONS === */
  /* Types: income | expense | transfer */
  addTransaction({
    date, description, amount, account_id, card_id = null, category_id = null,
    type, tags = [], notes = "", installments = 1, transfer_to_account = null,
    merchant_label = null, merchant_category = null, receiver_document = null,
    pluggy_category = null, external_id = null
  }) {
    date = date || today();
    description = (description || "").trim();
    amount = +amount;
    type = type || (amount >= 0 ? "income" : "expense");

    // Aplica regras customizadas do usuário primeiro (podem definir category_id E merchant_label)
    if (!category_id || !merchant_label) {
      for (const r of (this.data.rules || [])) {
        if (normalize(description).includes(normalize(r.keyword))) {
          if (!category_id) category_id = r.category_id;
          if (!merchant_label && r.merchant_label) merchant_label = r.merchant_label;
          break;
        }
      }
    }

    if (!category_id) {
      const autoId = autoCategorize(description);
      category_id = autoId || (type === "income" ? "cat_other_in" : "cat_other");
    }

    // transferência
    if (type === "transfer") {
      if (!transfer_to_account || transfer_to_account === account_id) throw new Error("Transferência precisa de conta destino diferente");
      const g = uid("grp_");
      const neg = { id: uid("tx_"), group_id: g, date, description: description || "Transferência", amount: -Math.abs(amount),
                    account_id, category_id: "cat_transfer", type: "transfer", tags, notes, created_at: now() };
      const pos = { id: uid("tx_"), group_id: g, date, description: description || "Transferência", amount: +Math.abs(amount),
                    account_id: transfer_to_account, category_id: "cat_transfer", type: "transfer", tags, notes, created_at: now() };
      this.data.transactions.push(neg, pos);
      this._save();
      return [neg, pos];
    }

    // parcelamento (apenas cartão, ou conta com is_recurring=false)
    if (installments > 1 && card_id) {
      const group_id = uid("inst_");
      const perInstallment = +(amount / installments).toFixed(2);
      const created = [];
      for (let i = 0; i < installments; i++) {
        const d = new Date(date); d.setMonth(d.getMonth() + i);
        created.push({
          id: uid("tx_"), group_id, date: d.toISOString().slice(0,10),
          description: `${description} (${i+1}/${installments})`,
          amount: perInstallment, account_id, card_id, category_id,
          type, tags, notes, installment: { index: i+1, total: installments },
          created_at: now()
        });
      }
      this.data.transactions.push(...created);
      this._save();
      return created;
    }

    const tx = {
      id: uid("tx_"), date, description, amount, account_id, card_id,
      category_id, type, tags, notes, created_at: now(),
      ...(merchant_label ? { merchant_label } : {}),
      ...(merchant_category ? { merchant_category } : {}),
      ...(receiver_document ? { receiver_document } : {}),
      ...(pluggy_category ? { pluggy_category } : {}),
      ...(external_id ? { external_id } : {})
    };
    this.data.transactions.push(tx);
    this._save();
    return tx;
  }

  deleteTransaction(id) {
    const t = this.data.transactions.find(x => x.id === id);
    if (!t) return;
    if (t.group_id) this.data.transactions = this.data.transactions.filter(x => x.group_id !== t.group_id);
    else this.data.transactions = this.data.transactions.filter(x => x.id !== id);
    this._save();
  }
  updateTransaction(id, patch) {
    const t = this.data.transactions.find(x => x.id === id);
    if (t) { Object.assign(t, patch); this._save(); }
  }
  listTransactions({ month, account_id, card_id, category_id, type, search, limit } = {}) {
    let ts = [...(this.data?.transactions || [])];
    if (month) ts = ts.filter(t => t.date.slice(0,7) === month);
    if (account_id) ts = ts.filter(t => t.account_id === account_id);
    if (card_id) ts = ts.filter(t => t.card_id === card_id);
    if (category_id) ts = ts.filter(t => t.category_id === category_id);
    if (type) ts = ts.filter(t => t.type === type);
    if (search) {
      const q = normalize(search);
      ts = ts.filter(t => normalize(t.description).includes(q) || normalize(t.notes || "").includes(q));
    }
    ts.sort((a,b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    return limit ? ts.slice(0, limit) : ts;
  }

  /* === CATEGORIES === */
  categories() { return this.data?.categories || []; }
  categoryById(id) { return this.data?.categories.find(c => c.id === id); }
  addCategory({ name, group = "Personalizado", icon = "📎", color = "#6b7280", type = null }) {
    const c = { id: uid("cat_"), name, group, icon, color, type, custom: true };
    this.data.categories.push(c);
    this._save();
    return c;
  }
  deleteCategory(id) {
    const c = this.categoryById(id);
    if (!c || !c.custom) return;
    this.data.categories = this.data.categories.filter(x => x.id !== id);
    this.data.transactions.forEach(t => { if (t.category_id === id) t.category_id = "cat_other"; });
    this._save();
  }

  /* === BUDGETS === */
  budgets(month = monthKey()) {
    return (this.data?.budgets || []).filter(b => b.month === month);
  }
  setBudget({ month, category_id, planned }) {
    const existing = this.data.budgets.find(b => b.month === month && b.category_id === category_id);
    if (existing) existing.planned = +planned;
    else this.data.budgets.push({ id: uid("bud_"), month, category_id, planned: +planned });
    this._save();
  }
  deleteBudget(id) {
    this.data.budgets = this.data.budgets.filter(b => b.id !== id);
    this._save();
  }
  /* Relatório: planejado vs gasto, por categoria, no mês. */
  budgetReport(month = monthKey()) {
    const buds = this.budgets(month);
    const txs = this.listTransactions({ month, type: "expense" });
    return buds.map(b => {
      const spent = txs.filter(t => t.category_id === b.category_id)
                       .reduce((s,t) => s + Math.abs(t.amount), 0);
      const remaining = b.planned - spent;
      const pct = b.planned > 0 ? (spent / b.planned) * 100 : 0;
      return { ...b, spent: +spent.toFixed(2), remaining: +remaining.toFixed(2), pct: +pct.toFixed(1) };
    });
  }

  /* === GOALS === */
  goals() { return this.data?.goals || []; }
  addGoal({ name, target_amount, current_amount = 0, deadline = null, icon = "🎯", color = "#6366f1", monthly_contribution = 0 }) {
    const g = { id: uid("gol_"), name, target_amount: +target_amount,
                current_amount: +current_amount, deadline, icon, color,
                monthly_contribution: +monthly_contribution, created_at: now() };
    this.data.goals.push(g);
    this._save();
    return g;
  }
  updateGoal(id, patch) {
    const g = this.data.goals.find(x => x.id === id);
    if (g) { Object.assign(g, patch); this._save(); }
  }
  deleteGoal(id) {
    this.data.goals = this.data.goals.filter(g => g.id !== id);
    this._save();
  }
  contributeGoal(id, amount) {
    const g = this.data.goals.find(x => x.id === id);
    if (g) { g.current_amount = +(g.current_amount + +amount).toFixed(2); this._save(); }
  }

  /* === DEBTS === */
  debts() { return this.data?.debts || []; }
  addDebt({ name, total_amount, balance, interest_rate = 0, installments_total = null, installments_paid = 0, due_day = 10 }) {
    const d = { id: uid("debt_"), name, total_amount: +total_amount, balance: +balance,
                interest_rate: +interest_rate, installments_total, installments_paid,
                due_day: +due_day, created_at: now() };
    this.data.debts.push(d);
    this._save();
    return d;
  }
  updateDebt(id, patch) { const d = this.data.debts.find(x => x.id === id); if (d) { Object.assign(d, patch); this._save(); } }
  deleteDebt(id) { this.data.debts = this.data.debts.filter(d => d.id !== id); this._save(); }

  /* === INVESTMENTS === */
  investments() { return this.data?.investments || []; }
  addInvestment({ name, ticker = "", type = "renda_fixa", quantity = 1, avg_price, current_price, is_liquid = false }) {
    const i = { id: uid("inv_"), name, ticker, type,
                quantity: +quantity, avg_price: +avg_price, current_price: +current_price,
                is_liquid: is_liquid === true,
                created_at: now() };
    this.data.investments.push(i);
    this._save();
    return i;
  }
  updateInvestment(id, patch) { const i = this.data.investments.find(x => x.id === id); if (i) { Object.assign(i, patch); this._save(); } }
  deleteInvestment(id) { this.data.investments = this.data.investments.filter(i => i.id !== id); this._save(); }

  /* === RULES (auto-categorização personalizada) === */
  rules() { return this.data?.rules || []; }
  addRule({ keyword, category_id, merchant_label = null }) {
    const r = { id: uid("rule_"), keyword, category_id, merchant_label, created_at: now() };
    this.data.rules.push(r);
    // aplicar retroativamente — atualiza category_id e (se houver) merchant_label
    let applied = 0;
    this.data.transactions.forEach(t => {
      if (normalize(t.description).includes(normalize(keyword))) {
        t.category_id = category_id;
        if (merchant_label) t.merchant_label = merchant_label;
        applied++;
      }
    });
    this._save();
    r._applied = applied;
    return r;
  }
  deleteRule(id) { this.data.rules = this.data.rules.filter(r => r.id !== id); this._save(); }

  /* === ALERTS === */
  alerts() { return this.data?.alerts || []; }
  markAlertRead(id) { const a = this.data.alerts.find(x => x.id === id); if (a) { a.read = true; this._save(); } }
  clearAlerts() { this.data.alerts = []; this._save(); }

  /* === COMPUTED === */
  netWorth() {
    const base = this.data?.settings?.currency || "BRL";
    const conv = window.FX ? (v, from) => FX.convertSync(v, from || base, base) : (v) => v;

    const accAssets = this.accounts()
      .filter(a => a.include_in_net_worth)
      .reduce((s,a) => s + conv(this.accountBalance(a.id), a.currency || base), 0);
    const investAssets = this.investments()
      .reduce((s,i) => s + conv(i.quantity * i.current_price, i.currency || base), 0);
    const liabilities = this.debts().reduce((s,d) => s + conv(d.balance, d.currency || base), 0);
    const cardsDue = this.cards().reduce((s,c) => s + conv(this.cardCurrentUsage(c.id), c.currency || base), 0);
    const assets = +(accAssets + investAssets).toFixed(2);
    const totalLiabilities = +(liabilities + cardsDue).toFixed(2);
    return {
      assets, liabilities: totalLiabilities,
      net: +(assets - totalLiabilities).toFixed(2),
      base_currency: base,
      breakdown: {
        cash: +accAssets.toFixed(2),
        investments: +investAssets.toFixed(2),
        debts: +liabilities.toFixed(2),
        cards_open: +cardsDue.toFixed(2)
      }
    };
  }

  monthSummary(month = monthKey()) {
    const txs = this.listTransactions({ month });
    const income = txs.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
    const expense = Math.abs(txs.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0));
    return { income: +income.toFixed(2), expense: +expense.toFixed(2), net: +(income - expense).toFixed(2) };
  }

  /* === RECURRENCES === */
  recurrences() { return this.data?.recurrences || []; }

  addRecurrence({ template, frequency = "monthly", day = null, start_date = null, end_date = null, active = true }) {
    // template: { description, amount, category_id, account_id?, card_id?, type, tags, notes }
    if (!template || !template.description) throw new Error("Descrição obrigatória");
    if (typeof template.amount !== "number" || isNaN(template.amount)) throw new Error("Valor inválido");

    // Garante array (import antigo pode não ter)
    if (!Array.isArray(this.data.recurrences)) this.data.recurrences = [];

    const r = {
      id: uid("rec_"),
      template: { ...template },
      frequency,
      day: day ?? new Date().getDate(),
      start_date: start_date || today(),
      end_date: end_date || null,
      last_generated_date: null,
      active,
      created_at: now()
    };
    this.data.recurrences.push(r);
    this._save();
    return r;
  }

  updateRecurrence(id, patch) {
    const r = this.data.recurrences.find(x => x.id === id);
    if (r) { Object.assign(r, patch); this._save(); }
  }

  deleteRecurrence(id) {
    this.data.recurrences = this.data.recurrences.filter(r => r.id !== id);
    this._save();
  }

  /** Calcula próximas N ocorrências da recorrência a partir de uma data. */
  nextOccurrences(rec, fromDate = null, maxCount = 12) {
    if (!rec.active) return [];
    const from = fromDate ? new Date(fromDate) : new Date();
    from.setHours(0, 0, 0, 0);
    const start = new Date(rec.start_date);
    const endDate = rec.end_date ? new Date(rec.end_date) : null;
    const out = [];
    let cursor = new Date(Math.max(start, from));

    for (let i = 0; i < maxCount * 2 && out.length < maxCount; i++) {
      let next;
      if (rec.frequency === "monthly") {
        next = new Date(cursor.getFullYear(), cursor.getMonth(), rec.day);
        if (next < cursor) next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, rec.day);
      } else if (rec.frequency === "yearly") {
        const m = new Date(rec.start_date).getMonth();
        next = new Date(cursor.getFullYear(), m, rec.day);
        if (next < cursor) next = new Date(cursor.getFullYear() + 1, m, rec.day);
      } else if (rec.frequency === "weekly") {
        next = new Date(cursor);
        const diff = ((rec.day - cursor.getDay()) + 7) % 7;
        next.setDate(cursor.getDate() + (diff || 7));
      } else { // daily
        next = new Date(cursor);
        next.setDate(next.getDate() + 1);
      }
      if (endDate && next > endDate) break;
      out.push(next.toISOString().slice(0, 10));
      cursor = new Date(next); cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  /** Gera transações concretas para datas passadas ainda não processadas. */
  materializeRecurrences() {
    const today_ = today();
    let created = 0;
    for (const r of this.data.recurrences || []) {
      if (!r.active) continue;
      const from = r.last_generated_date ? addDays(r.last_generated_date, 1) : r.start_date;
      const occurrences = this.nextOccurrences(r, from, 60).filter(d => d <= today_);
      for (const occDate of occurrences) {
        const t = r.template;
        this.data.transactions.push({
          id: uid("tx_"),
          date: occDate,
          description: t.description,
          amount: t.amount,
          account_id: t.account_id,
          card_id: t.card_id,
          category_id: t.category_id,
          type: t.type || (t.amount >= 0 ? "income" : "expense"),
          tags: t.tags || [],
          notes: t.notes || "",
          recurrence_id: r.id,
          created_at: now()
        });
        r.last_generated_date = occDate;
        created++;
      }
    }
    if (created) this._save();
    return created;
  }

  /** Previstas não materializadas (futuras), para calendário/forecast. */
  upcomingFromRecurrences(daysAhead = 60) {
    const today_ = today();
    const horizon = addDays(today_, daysAhead);
    const out = [];
    for (const r of this.data.recurrences || []) {
      if (!r.active) continue;
      const dates = this.nextOccurrences(r, today_, 30);
      for (const d of dates) {
        if (d > horizon) break;
        out.push({
          date: d,
          description: r.template.description,
          amount: r.template.amount,
          category_id: r.template.category_id,
          account_id: r.template.account_id,
          card_id: r.template.card_id,
          type: r.template.type || (r.template.amount >= 0 ? "income" : "expense"),
          recurrence_id: r.id,
          forecast: true
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /* === COST CENTERS (empresarial) === */
  costCenters() { return this.data?.cost_centers || []; }
  addCostCenter({ name, icon = "🏢", color = "#6366f1" }) {
    const c = { id: uid("cc_"), name, icon, color };
    this.data.cost_centers.push(c);
    this._save();
    return c;
  }
  deleteCostCenter(id) {
    this.data.cost_centers = this.data.cost_centers.filter(c => c.id !== id);
    this.data.transactions.forEach(t => { if (t.cost_center_id === id) delete t.cost_center_id; });
    this._save();
  }

  /* === MODE === */
  isBusinessMode() { return this.data?.settings?.mode === "business"; }
  setMode(mode) {
    this.data.settings.mode = mode;
    this._save();
  }

  /* === DEMO === */
  seedDemo() {
    if (!this.currentUserId) throw new Error("Faça login primeiro");
    const d = this.data;
    d.accounts = []; d.cards = []; d.transactions = []; d.budgets = [];
    d.goals = []; d.debts = []; d.investments = []; d.rules = []; d.alerts = [];

    const acc1 = this.addAccount({ name: "Conta Corrente", type: "checking", initial_balance: 3000, color: "#6366f1", icon: "🏦" });
    const acc2 = this.addAccount({ name: "Poupança", type: "savings", initial_balance: 8500, color: "#10b981", icon: "🐷" });
    const acc3 = this.addAccount({ name: "Carteira", type: "wallet", initial_balance: 250, color: "#f59e0b", icon: "👛" });
    const card1 = this.addCard({ name: "Cartão Platinum", limit: 5000, closing_day: 25, due_day: 5, color_start: "#1f2937", color_end: "#6366f1", default_account_id: acc1.id });
    const card2 = this.addCard({ name: "Cartão Gold", limit: 3000, closing_day: 10, due_day: 20, color_start: "#f59e0b", color_end: "#ef4444", default_account_id: acc1.id });

    const mk = d => new Date(Date.now() - d * 86400000).toISOString().slice(0,10);
    const samples = [
      // mês atual
      ["Salário Empresa XYZ", 8500, 1, acc1.id, null, "cat_salary", "income"],
      ["Rendimento Tesouro Direto", 120, 2, acc2.id, null, "cat_dividend", "income"],
      ["Aluguel apartamento", -2200, 3, acc1.id, null, "cat_rent", "expense"],
      ["Conta de luz CEMIG", -189.50, 4, acc1.id, null, "cat_utilities", "expense"],
      ["Internet Vivo Fibra", -129.90, 5, acc1.id, null, "cat_internet", "expense"],
      ["Supermercado Pão de Açúcar", -487.30, 6, null, card1.id, "cat_grocery", "expense"],
      ["iFood almoço", -42.90, 7, null, card1.id, "cat_delivery", "expense"],
      ["Posto Shell combustível", -250, 8, null, card1.id, "cat_fuel", "expense"],
      ["Netflix assinatura", -55.90, 9, null, card2.id, "cat_streaming", "expense"],
      ["Spotify Premium", -21.90, 9, null, card2.id, "cat_streaming", "expense"],
      ["Academia Smart Fit", -99.90, 10, acc1.id, null, "cat_gym", "expense"],
      ["Uber para reunião", -28.50, 11, null, card1.id, "cat_rideshare", "expense"],
      ["Farmácia Drogasil", -85.40, 12, null, card2.id, "cat_pharmacy", "expense"],
      ["Restaurante Outback", -240, 13, null, card1.id, "cat_restaurant", "expense"],
      ["Amazon livros técnicos", -210, 14, null, card1.id, "cat_education", "expense"],
      ["Shopee vestuário", -189, 15, null, card2.id, "cat_clothing", "expense"],
      // mês anterior
      ["Salário Empresa XYZ", 8500, 31, acc1.id, null, "cat_salary", "income"],
      ["Aluguel apartamento", -2200, 33, acc1.id, null, "cat_rent", "expense"],
      ["Supermercado", -420, 36, null, card1.id, "cat_grocery", "expense"],
      ["Netflix", -55.90, 39, null, card2.id, "cat_streaming", "expense"],
      ["Spotify", -21.90, 39, null, card2.id, "cat_streaming", "expense"],
      ["Combustível", -220, 40, null, card1.id, "cat_fuel", "expense"],
      ["Uber", -35, 42, null, card1.id, "cat_rideshare", "expense"],
      ["Farmácia", -65, 45, null, card2.id, "cat_pharmacy", "expense"],
      // parcelamento Mac (3x)
      ["Apple MacBook Air - 1/3", -1666.33, 3, null, card1.id, "cat_shopping", "expense"],
    ];
    for (const [desc, amt, days, aid, cid, catid, type] of samples) {
      this.data.transactions.push({
        id: uid("tx_"), date: mk(days), description: desc, amount: amt,
        account_id: aid, card_id: cid, category_id: catid, type,
        tags: [], notes: "", created_at: now()
      });
    }
    // parcelas futuras do MacBook (2 e 3)
    const mkFuture = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0,10);
    for (let i = 2; i <= 3; i++) {
      this.data.transactions.push({
        id: uid("tx_"), date: mkFuture((i-1) * 30 - 3),
        description: `Apple MacBook Air - ${i}/3`, amount: -1666.33,
        account_id: null, card_id: card1.id, category_id: "cat_shopping",
        type: "expense", installment: { index: i, total: 3 },
        tags: [], notes: "", created_at: now()
      });
    }

    this.addGoal({ name: "Reserva de emergência", target_amount: 30000, current_amount: 8500, icon: "🛡️", color: "#10b981", monthly_contribution: 800 });
    this.addGoal({ name: "Viagem Europa 2027", target_amount: 20000, current_amount: 2400, icon: "✈️", color: "#0ea5e9", monthly_contribution: 600 });
    this.addGoal({ name: "Aposentadoria (FIRE)", target_amount: 1000000, current_amount: 45000, icon: "🏖️", color: "#f59e0b", monthly_contribution: 2000 });

    this.addDebt({ name: "Empréstimo carro", total_amount: 50000, balance: 32000, interest_rate: 1.8, installments_total: 48, installments_paid: 18, due_day: 15 });

    this.addInvestment({ name: "Tesouro IPCA+ 2035", ticker: "NTNB", type: "renda_fixa", quantity: 15, avg_price: 3000, current_price: 3180 });
    this.addInvestment({ name: "BOVA11 ETF Ibovespa", ticker: "BOVA11", type: "acoes", quantity: 40, avg_price: 110, current_price: 118 });

    this.setBudget({ month: monthKey(), category_id: "cat_grocery", planned: 800 });
    this.setBudget({ month: monthKey(), category_id: "cat_restaurant", planned: 400 });
    this.setBudget({ month: monthKey(), category_id: "cat_delivery", planned: 200 });
    this.setBudget({ month: monthKey(), category_id: "cat_fuel", planned: 400 });
    this.setBudget({ month: monthKey(), category_id: "cat_streaming", planned: 100 });
    this.setBudget({ month: monthKey(), category_id: "cat_clothing", planned: 200 });

    this._save();
  }

  /* === EXPORT / IMPORT === */
  exportJson() {
    return JSON.stringify(this.data, null, 2);
  }
  importJson(text) {
    const obj = JSON.parse(text);
    this.db.data[this.currentUserId] = { ...emptyUserData(), ...obj };
    this._save();
  }
  /* Importar CSV simples: date,description,amount,account */
  importCsv(text, account_id) {
    const lines = text.trim().split(/\r?\n/);
    let imported = 0;
    for (const line of lines.slice(1)) {
      const parts = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
      if (parts.length < 3) continue;
      const [date, description, amtRaw] = parts;
      const amount = +amtRaw.replace(/[^\d,.\-]/g, "").replace(",", ".");
      if (!date || !description || isNaN(amount)) continue;
      this.addTransaction({ date, description, amount, account_id,
                            type: amount >= 0 ? "income" : "expense" });
      imported++;
    }
    return imported;
  }

  resetAll() {
    if (!this.currentUserId) return;
    this.db.data[this.currentUserId] = emptyUserData();
    this._save();
  }
}

window.Store = new FinanceStore();
