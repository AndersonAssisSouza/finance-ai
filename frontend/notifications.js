/* Finance AI — Notificações locais
 * Usa Notification API + agendamento via setInterval (quando aba aberta)
 * + Service Worker para mostrar notificações.
 *
 * Regras:
 *  - Vencimento de cartão: 3d antes, 1d antes, dia do vencimento
 *  - Orçamento 80% e 100%
 *  - Insight crítico novo
 *  - Meta próxima de bater (90%+)
 * Cada notificação é marcada pelo id (não repete).
 */

const NOTIF_KEY = "fa_v3_notifs_sent";

function loadSent() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}; } catch { return {}; }
}
function saveSent(s) { localStorage.setItem(NOTIF_KEY, JSON.stringify(s)); }

async function requestPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}

async function show(id, title, body, tag) {
  if (Notification.permission !== "granted") return;
  const sent = loadSent();
  if (sent[id]) return;
  sent[id] = new Date().toISOString();
  saveSent(sent);
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.showNotification) {
      reg.showNotification(title, { body, tag, icon: "./icon.svg", badge: "./icon.svg" });
    } else {
      new Notification(title, { body, icon: "./icon.svg" });
    }
  } catch { /* noop */ }
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr);
  return Math.round((d - today) / 86400000);
}

function scan() {
  if (!window.Store || !Store.currentUserId) return;
  const prefs = Store.data.settings.notifications || {
    bills: true, budgets: true, insights: true, goals: true
  };

  // Cartões - vencimento
  if (prefs.bills) {
    for (const c of Store.cards()) {
      const inv = Store.cardInvoice(c.id);
      if (inv.total === 0) continue;
      const dleft = daysUntil(inv.due_date);
      for (const threshold of [3, 1, 0]) {
        if (dleft === threshold) {
          const id = `bill_${c.id}_${inv.due_date}_${threshold}`;
          const when = threshold === 0 ? "hoje" : threshold === 1 ? "amanhã" : `em ${threshold} dias`;
          show(id, `💳 Fatura ${c.name} vence ${when}`,
            `Valor: ${fmtBRLn(inv.total)} • vence em ${inv.due_date}`, id);
        }
      }
    }
  }

  // Orçamentos
  if (prefs.budgets) {
    const rep = Store.budgetReport();
    for (const b of rep) {
      const cat = Store.categoryById(b.category_id);
      if (b.pct >= 100) {
        const id = `bud_100_${b.id}`;
        show(id, `🧮 Orçamento estourado: ${cat?.name}`,
          `${fmtBRLn(b.spent)} gastos de ${fmtBRLn(b.planned)} planejados (${b.pct.toFixed(0)}%).`);
      } else if (b.pct >= 80) {
        const id = `bud_80_${b.id}_${b.month}`;
        show(id, `⚠️ Orçamento próximo do limite: ${cat?.name}`,
          `${b.pct.toFixed(0)}% do valor planejado.`);
      }
    }
  }

  // Insights críticos
  if (prefs.insights) {
    const ins = AI.insights(Store);
    for (const i of ins) {
      if (i.severity !== "danger") continue;
      const id = `ins_${btoa(i.title).slice(0,16)}_${new Date().toISOString().slice(0,10)}`;
      show(id, `🔔 ${i.title}`, i.msg);
    }
  }

  // Metas próximas
  if (prefs.goals) {
    for (const g of Store.goals()) {
      const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
      if (pct >= 90 && pct < 100) {
        const id = `goal_90_${g.id}`;
        show(id, `${g.icon} ${g.name}: quase lá!`,
          `${pct.toFixed(0)}% atingido — faltam ${fmtBRLn(g.target_amount - g.current_amount)}.`);
      } else if (pct >= 100) {
        const id = `goal_100_${g.id}`;
        show(id, `🎉 Meta conquistada: ${g.name}`,
          `Você atingiu ${fmtBRLn(g.current_amount)} — parabéns!`);
      }
    }
  }
}

function fmtBRLn(v) { return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function start() {
  scan();
  setInterval(scan, 1000 * 60 * 30); // a cada 30 min
}

function status() {
  if (!("Notification" in window)) return "Navegador sem suporte";
  return { default: "Pendente", granted: "Ativadas", denied: "Bloqueadas" }[Notification.permission] || "—";
}

function resetHistory() { localStorage.removeItem(NOTIF_KEY); }

window.Notifs = { requestPermission, start, status, resetHistory, scan };
