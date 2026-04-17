/* Finance AI — Bot bidirecional
 *
 * Telegram: polling via getUpdates (100% gratuito, sem servidor).
 * Polling a cada 20s quando app está aberto (aba visível).
 *
 * WhatsApp inbound requer Twilio/Green-API (pagos) — suportamos OUTBOUND via wa.me
 * (link que o usuário clica e já tem a mensagem montada).
 *
 * Parser de comandos em linguagem natural:
 *   "gastei 50 no mercado"  → despesa
 *   "recebi 3000 de freelance" → receita
 *   "saldo" → retorna saldo
 *   "resumo" → resumo do mês
 *   "meta reserva" → mostra meta
 */

const BOT_KEY = "fa_bot_last_update";
let polling = null;

function config() { return Store.data?.settings?.channels?.telegram || {}; }

function isConfigured() {
  const c = config();
  return c.enabled && c.token && c.chat_id;
}

async function sendMessage(text) {
  const c = config();
  if (!c.token || !c.chat_id) return;
  await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: c.chat_id, text, parse_mode: "Markdown" })
  });
}

async function poll() {
  if (!isConfigured()) return;
  const c = config();
  const lastUpdate = +localStorage.getItem(BOT_KEY) || 0;
  try {
    const res = await fetch(`https://api.telegram.org/bot${c.token}/getUpdates?offset=${lastUpdate + 1}&timeout=20`);
    if (!res.ok) return;
    const j = await res.json();
    if (!j.ok) return;
    for (const upd of j.result) {
      localStorage.setItem(BOT_KEY, String(upd.update_id));
      const msg = upd.message;
      if (!msg) continue;
      if (String(msg.chat?.id) !== String(c.chat_id)) continue; // só chat autorizado
      const reply = handleCommand(msg.text || "");
      if (reply) await sendMessage(reply);
    }
  } catch (e) { console.warn("Bot poll:", e.message); }
}

function handleCommand(text) {
  text = (text || "").trim();
  if (!text) return null;
  const q = text.toLowerCase();

  // /start ou help
  if (/^\/?(start|help|ajuda)/.test(q)) return helpMsg();

  // Consultas
  if (/^(\/)?saldo/.test(q)) return cmdSaldo();
  if (/^(\/)?resumo|^(\/)?mes/.test(q)) return cmdResumo();
  if (/^(\/)?metas?/.test(q)) return cmdMetas();
  if (/^(\/)?cart(ões|oes)/.test(q)) return cmdCartoes();
  if (/^(\/)?patrim/.test(q)) return cmdPatrim();
  if (/^(\/)?insights?/.test(q)) return cmdInsights();
  if (/^(\/)?ultimas?|^(\/)?recent/.test(q)) return cmdUltimas();

  // Registrar transação: "gastei X com/no/em Y" ou "recebi X de Y"
  const despesa = q.match(/^(?:\/)?gast(?:ei|o) (?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:com |no |na |em |de )?(.+)?/i);
  if (despesa) return cmdGasto(-parseFloat(despesa[1].replace(",", ".")), despesa[2] || "Despesa");

  const receita = q.match(/^(?:\/)?(?:recebi|ganhei) (?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:de |com )?(.+)?/i);
  if (receita) return cmdGasto(parseFloat(receita[1].replace(",", ".")), receita[2] || "Receita");

  // Qualquer outra pergunta → chat IA
  try {
    return (window.LLM?.isConfigured() && false)
      ? "(LLM externo — em breve inbound)"
      : AI.chat(Store, text);
  } catch { return "Não entendi. Use /ajuda."; }
}

function helpMsg() {
  return `🤖 *Finance AI Bot*

Comandos disponíveis:

📊 *Consultas*
• \`/saldo\` — saldo de todas as contas
• \`/resumo\` — resumo do mês
• \`/patrimonio\` — patrimônio líquido
• \`/metas\` — progresso das metas
• \`/cartoes\` — faturas e limites
• \`/insights\` — alertas da IA
• \`/ultimas\` — últimas 5 transações

✍️ *Registrar*
• \`gastei 50 no mercado\`
• \`gastei 120 com uber\`
• \`recebi 3000 de freelance\`
• \`recebi 8500 de salário\`

💬 *Ou faça qualquer pergunta em português*`;
}

function cmdSaldo() {
  const accs = Store.accounts();
  if (!accs.length) return "Você ainda não tem contas.";
  const lines = accs.map(a => `• ${a.icon} *${a.name}*: ${fmtBRL(Store.accountBalance(a.id))}`);
  const total = accs.reduce((s,a) => s + Store.accountBalance(a.id), 0);
  return `💰 *Saldo total: ${fmtBRL(total)}*\n\n${lines.join("\n")}`;
}

function cmdResumo() {
  const m = Store.monthSummary();
  return `📊 *Resumo do mês*\n\n` +
    `Receita: ${fmtBRL(m.income)}\nDespesa: ${fmtBRL(m.expense)}\nSaldo: ${fmtBRL(m.net)}`;
}

function cmdPatrim() {
  const n = Store.netWorth();
  return `💎 *Patrimônio: ${fmtBRL(n.net)}*\n\nAtivos: ${fmtBRL(n.assets)}\nPassivos: ${fmtBRL(n.liabilities)}`;
}

function cmdMetas() {
  const goals = Store.goals();
  if (!goals.length) return "Nenhuma meta cadastrada.";
  return "🎯 *Metas*\n\n" + goals.map(g => {
    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount * 100).toFixed(0) : 0;
    return `${g.icon} *${g.name}*: ${pct}%\n${fmtBRL(g.current_amount)} / ${fmtBRL(g.target_amount)}`;
  }).join("\n\n");
}

function cmdCartoes() {
  const cs = Store.cards();
  if (!cs.length) return "Nenhum cartão.";
  return "💳 *Cartões*\n\n" + cs.map(c => {
    const used = Store.cardCurrentUsage(c.id);
    const inv = Store.cardInvoice(c.id);
    return `*${c.name}*\nUsado: ${fmtBRL(used)} de ${fmtBRL(c.limit)}\nFatura atual: ${fmtBRL(inv.total)} (vence ${inv.due_date})`;
  }).join("\n\n");
}

function cmdInsights() {
  const ins = AI.insights(Store).slice(0, 5);
  if (!ins.length) return "✨ Tudo em ordem!";
  return "💡 *Insights*\n\n" + ins.map(i => {
    const ic = i.severity === "danger" ? "🚨" : i.severity === "warn" ? "⚠️" : i.severity === "ok" ? "✅" : "ℹ️";
    return `${ic} *${i.title}*\n${i.msg}`;
  }).join("\n\n");
}

function cmdUltimas() {
  const txs = Store.listTransactions({ limit: 5 });
  if (!txs.length) return "Sem transações.";
  return "📝 *Últimas transações*\n\n" + txs.map(t => {
    const sig = t.amount >= 0 ? "+" : "";
    return `${t.date} | ${t.description}\n${sig}${fmtBRL(t.amount)}`;
  }).join("\n\n");
}

function cmdGasto(amount, desc) {
  const accs = Store.accounts();
  if (!accs.length) return "⚠️ Crie uma conta primeiro no Finance AI.";
  const defaultAcc = accs[0];
  try {
    Store.addTransaction({
      description: desc.trim() || "Via bot",
      amount,
      account_id: defaultAcc.id,
      type: amount >= 0 ? "income" : "expense"
    });
    const verbo = amount >= 0 ? "💰 Recebimento" : "💸 Gasto";
    return `${verbo} registrado!\n\n*${desc}*\n${fmtBRL(amount)}\nConta: ${defaultAcc.name}\n\nNovo saldo: ${fmtBRL(Store.accountBalance(defaultAcc.id))}`;
  } catch (e) {
    return `❌ Erro: ${e.message}`;
  }
}

function fmtBRL(v) { return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function start() {
  if (polling) return;
  const tick = async () => {
    if (!document.hidden && isConfigured()) await poll();
    polling = setTimeout(tick, 20000); // 20s
  };
  tick();
}

function stop() {
  if (polling) clearTimeout(polling);
  polling = null;
}

/* WhatsApp via wa.me (unidirecional, link rápido) */
function whatsappSendLink(phone, text) {
  const clean = String(phone || "").replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

window.Bot = { isConfigured, sendMessage, poll, handleCommand, start, stop, whatsappSendLink };
