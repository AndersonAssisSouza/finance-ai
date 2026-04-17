/* Finance AI v3 — Aplicação principal
 * Router hash + views.
 */

const fmt = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtShort = v => {
  const n = +v || 0;
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + "k";
  return n.toFixed(0);
};
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v;
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
};
/* monthKey e addMonths já definidos em storage.js/ai_engine.js (scope global) */
function monthLabel(ym) {
  const [y,m] = ym.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const App = { charts: {}, currentMonth: monthKey() };

/* ============ ROUTER ============ */
const routes = {
  "dashboard":   { title: "Dashboard",    render: renderDashboard,  icon: "📊" },
  "accounts":    { title: "Contas",       render: renderAccounts,   icon: "🏦" },
  "cards":       { title: "Cartões",      render: renderCards,      icon: "💳" },
  "transactions":{ title: "Transações",   render: renderTransactions, icon: "📝" },
  "budgets":     { title: "Orçamentos",   render: renderBudgets,    icon: "🧮" },
  "calendar":    { title: "Calendário",   render: renderCalendar,   icon: "📅" },
  "goals":       { title: "Metas",        render: renderGoals,      icon: "🎯" },
  "debts":       { title: "Dívidas",      render: renderDebts,      icon: "📉" },
  "investments": { title: "Investimentos", render: renderInvestments, icon: "📈" },
  "net-worth":   { title: "Patrimônio",   render: renderNetWorth,   icon: "💎" },
  "savings":     { title: "Economizar",   render: renderSavings,    icon: "💰" },
  "fire":        { title: "Investir & FIRE", render: renderFire,    icon: "🔥" },
  "reports":     { title: "Relatórios",   render: renderReports,    icon: "📑" },
  "reconcile":   { title: "Conciliar",    render: renderReconcile,  icon: "🔄" },
  "family":      { title: "Família",      render: renderFamily,     icon: "👨‍👩‍👧" },
  "chat":        { title: "Chat IA",      render: renderChat,       icon: "🤖" },
  "settings":    { title: "Configurações",render: renderSettings,   icon: "⚙️" },
};

function navigate() {
  const hash = location.hash.replace("#/", "") || "dashboard";
  const [route] = hash.split("?");
  const def = routes[route] || routes.dashboard;
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.route === route));
  const main = $(".main");
  main.innerHTML = "";
  main.appendChild(h("div", { class: "fade-in" }, def.render()));
  $(".sidebar")?.classList.remove("open");
}
window.addEventListener("hashchange", navigate);

/* ============ BOOT / AUTH ============ */
function boot() {
  if (localStorage.getItem("fa_v3_theme") === "dark") document.documentElement.classList.add("dark");

  // Acesso direto: se não há usuário, cria um perfil "Eu" automaticamente
  if (!Store.currentUserId || !Store.user) {
    try {
      const defaultEmail = "eu@finance.local";
      if (Store.db.users[defaultEmail]) {
        Store.login({ email: defaultEmail, password: "local" });
      } else {
        Store.register({ email: defaultEmail, password: "local", name: "Eu" });
      }
    } catch (err) {
      console.error("Boot auto-login falhou:", err);
      renderAuth(); return;
    }
  }

  // Pareamento via QR Code / link: ?join=fa://ws/...
  const params = new URLSearchParams(location.search);
  const joinLink = params.get("join");
  if (joinLink && window.Cloud) {
    setTimeout(async () => {
      if (confirm("Entrar no workspace compartilhado?\n\nIsso substituirá seus dados locais pela versão da nuvem.")) {
        try {
          await Cloud.joinWorkspace(decodeURIComponent(joinLink));
          Cloud.enableAutoSync();
          alert("✅ Conectado ao workspace!");
          history.replaceState(null, "", location.pathname);
          location.reload();
          return;
        } catch (e) { alert("Erro ao entrar: " + e.message); }
      }
      history.replaceState(null, "", location.pathname);
    }, 300);
  }

  // Esconde tela de login e vai direto ao app
  $("#auth").classList.add("hidden");
  enterApp();
}

function renderAuth() {
  $("#auth").classList.remove("hidden");
  $("#app").classList.remove("active");
  let mode = "login";
  const form = $("#auth-form");
  const errEl = $("#auth-err");

  function showErr(msg) {
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
    errEl.style.display = "block";
  }
  function hideErr() {
    errEl.classList.add("hidden");
    errEl.style.display = "none";
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    hideErr();
    const email = $("#au-email").value.trim(), password = $("#au-pass").value, name = $("#au-name").value.trim();
    if (!email || !password) return showErr("Preencha email e senha");
    if (password.length < 4) return showErr("Senha precisa de pelo menos 4 caracteres");
    try {
      if (mode === "login") {
        try {
          Store.login({ email, password });
        } catch (err) {
          // Sem conta: oferecer criar automaticamente
          if (err.message.includes("inválidas") && !Store.db.users[email.toLowerCase()]) {
            if (confirm(`Não há conta com "${email}". Criar agora com esta senha?`)) {
              Store.register({ email, password, name: name || email.split("@")[0] });
            } else return;
          } else throw err;
        }
      } else {
        Store.register({ email, password, name });
      }
      enterApp();
    } catch (err) {
      showErr(err.message || "Erro ao autenticar");
    }
  };

  $("#au-tab-login").onclick = () => switchAuth("login");
  $("#au-tab-reg").onclick = () => switchAuth("register");
  function switchAuth(m) {
    mode = m;
    hideErr();
    $("#au-tab-login").classList.toggle("active", m === "login");
    $("#au-tab-reg").classList.toggle("active", m === "register");
    $("#au-name-wrap").classList.toggle("hidden", m !== "register");
    $("#au-submit").textContent = m === "login" ? "Entrar" : "Criar conta";
  }

  // Link "conta demo" — auto-cria se não existir e loga
  $("#demo-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideErr();
    const email = "demo@finance.ai", password = "demo1234";
    try {
      if (!Store.db.users[email]) {
        Store.register({ email, password, name: "Demo" });
      } else {
        Store.login({ email, password });
      }
      // Popular demo data se vazio
      if (!Store.data.transactions.length) Store.seedDemo();
      enterApp();
    } catch (err) {
      showErr(err.message);
    }
  });
}

function enterApp() {
  $("#auth").classList.add("hidden");
  $("#app").classList.add("active");
  renderSidebar();
  if (!location.hash) location.hash = "#/dashboard";
  else navigate();
}

function renderSidebar() {
  const sb = $(".sidebar");
  sb.innerHTML = "";
  const u = Store.user;
  const ws = window.Cloud ? Cloud.info() : null;
  sb.append(
    h("div", { class: "brand" },
      h("div", { class: "icon" }, "💎"),
      h("div", {}, "Finance AI"),
    ),
    h("div", { class: "text-sm text-muted", style: "padding: 0 11px 12px" },
      h("div", { class: "font-semi" }, `Olá, ${u.name || u.email.split("@")[0]}`),
      h("div", { class: "text-xs" }, u.email),
      ws && h("div", { class: "text-xs mt-2" },
        h("span", { class: "badge ok", style: "font-size:10px" },
          "☁️ ", ws.provider === "jsonbin" ? "JSONBin" : "Gist",
          ws.last_sync_at ? " • " + timeAgo(ws.last_sync_at) : ""
        )
      )
    ),
    h("div", { class: "nav-section" }, "Visão geral"),
    navItem("dashboard"),
    navItem("net-worth"),
    h("div", { class: "nav-section" }, "Dia a dia"),
    navItem("accounts"),
    navItem("cards"),
    navItem("transactions"),
    navItem("budgets"),
    navItem("calendar"),
    h("div", { class: "nav-section" }, "Futuro"),
    navItem("goals"),
    navItem("debts"),
    navItem("investments"),
    navItem("fire"),
    h("div", { class: "nav-section" }, "Inteligência"),
    navItem("savings"),
    navItem("reports"),
    navItem("reconcile"),
    navItem("chat"),
    h("div", { class: "nav-section" }, "Sistema"),
    navItem("settings"),
    h("button", { class: "nav-item", style: "margin-top: auto; color: var(--danger)", onClick: logout },
      h("span", { class: "ico" }, "🚪"), "Sair")
  );
}
function navItem(route) {
  const def = routes[route];
  return h("a", { class: "nav-item", "data-route": route, href: `#/${route}` },
    h("span", { class: "ico" }, def.icon), def.title);
}
function logout() { Store.logout(); location.hash = ""; location.reload(); }

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return Math.floor(diff/60) + "m atrás";
  if (diff < 86400) return Math.floor(diff/3600) + "h atrás";
  return Math.floor(diff/86400) + "d atrás";
}

/* ============ MAIN HEADER helper ============ */
function pageHead(title, sub, ...actions) {
  return h("div", { class: "main-head" },
    h("div", {},
      h("h1", {}, title),
      sub && h("div", { class: "sub" }, sub)
    ),
    h("div", { class: "flex gap-2 items-center" }, ...actions)
  );
}

/* ============ DASHBOARD ============ */
function renderDashboard() {
  const wrap = h("div", {});
  const nw = Store.netWorth();
  const ms = Store.monthSummary();
  const prev = Store.monthSummary(addMonths(App.currentMonth, -1));
  const score = AI.financialScore(Store);
  const ef = AI.emergencyFund(Store);
  const ins = AI.insights(Store);
  const top = AI.savingsOpportunities(Store).slice(0, 5);

  const insights = Store.listTransactions({ month: monthKey(), limit: 8 });
  const upcoming = upcomingBills();

  wrap.append(
    pageHead("Bom te ver! 👋", `Visão geral de ${monthLabel(monthKey())}`,
      h("button", { class: "btn btn-outline", onClick: () => { Store.seedDemo(); navigate(); } }, "Dados demo"),
      h("button", { class: "btn btn-gradient", onClick: openNewTx }, "+ Transação")
    )
  );

  // KPIs
  wrap.append(h("div", { class: "grid grid-4 mb-4" },
    kpiCard("Patrimônio líquido", fmt(nw.net), h("div", { class: "delta" },
      `Ativos ${fmt(nw.assets)} • Passivos ${fmt(nw.liabilities)}`), true),
    kpiCard("Saldo em contas", fmt(nw.breakdown.cash),
      h("div", { class: "delta" }, `${Store.accounts().length} conta(s)`)),
    kpiCard("Entradas (mês)", fmt(ms.income),
      h("div", { class: "delta" }, "💰")),
    kpiCard("Saídas (mês)", fmt(ms.expense),
      h("div", { class: "delta" }, prev.expense > 0
        ? `${ms.expense > prev.expense ? "+" : ""}${((ms.expense - prev.expense)/prev.expense*100).toFixed(0)}% vs mês ant.`
        : ""))
  ));

  // Score + reserva + insights
  wrap.append(h("div", { class: "grid grid-3 mb-4" },
    // Score
    h("div", { class: "card" },
      h("h3", {}, "Score financeiro", h("span", { class: "badge brand" }, "AI")),
      h("div", { class: "flex items-center gap-3" },
        h("div", { style: `font-size:36px; font-weight:700; background:var(--brand-grad); -webkit-background-clip:text; color:transparent` }, score),
        h("div", {},
          h("div", { class: "text-sm font-semi" }, scoreLabel(score)),
          h("div", { class: "text-xs text-muted" }, scoreHint(score))
        )
      ),
      h("div", { class: "progress gradient mt-3" }, h("div", { style: `width:${score}%` }))
    ),
    // Reserva emergência
    h("div", { class: "card" },
      h("h3", {}, "Reserva de emergência"),
      h("div", { class: "text-2xl font-bold" }, fmt(ef.current)),
      h("div", { class: "text-xs text-muted" }, `Meta: ${fmt(ef.target)} (6 meses)`),
      h("div", { class: `progress ${ef.status} mt-3` }, h("div", { style: `width:${Math.min(100, ef.current/ef.target*100)}%` })),
      h("div", { class: "text-xs mt-2" }, `${ef.monthsCovered} meses cobertos`)
    ),
    // Insights
    h("div", { class: "card" },
      h("h3", {}, "Insights da IA", h("a", { href: "#/chat", class: "badge brand pointer" }, "Chat →")),
      h("div", { class: "list" }, ...(ins.slice(0, 4).map(renderInsightItem)),
        ins.length === 0 && h("div", { class: "empty" }, h("div", { class: "icon" }, "✨"), "Adicione transações para ver insights"))
    )
  ));

  // Gráfico fluxo + top categorias
  wrap.append(h("div", { class: "grid grid-3 mb-4" },
    h("div", { class: "card col-span-2" },
      h("h3", {}, "Fluxo últimos 6 meses"),
      h("div", { style: "height:260px" }, h("canvas", { id: "chart-flow" }))
    ),
    h("div", { class: "card" },
      h("h3", {}, "Top categorias"),
      top.length ? h("div", { class: "list" }, ...top.map(t => h("div", { class: "list-item" },
        h("div", { class: "avatar", style: `background:${t.color}20; color:${t.color}` }, t.icon),
        h("div", { class: "grow" },
          h("div", { class: "title" }, t.category),
          h("div", { class: "sub" }, `${t.count} transações`)
        ),
        h("div", { class: "right amt neg" }, fmt(t.monthly))
      ))) : h("div", { class: "empty" }, "Sem gastos no mês")
    )
  ));

  // Metas + próximos vencimentos
  wrap.append(h("div", { class: "grid grid-2 mb-4" },
    h("div", { class: "card" },
      h("h3", {}, "Metas ativas", h("a", { href: "#/goals", class: "badge brand pointer" }, "Ver todas")),
      renderGoalsMini()
    ),
    h("div", { class: "card" },
      h("h3", {}, "Próximos vencimentos"),
      upcoming.length ? h("div", { class: "list" }, ...upcoming.slice(0, 5).map(u => h("div", { class: "list-item" },
        h("div", { class: "avatar" }, u.icon),
        h("div", { class: "grow" },
          h("div", { class: "title" }, u.title),
          h("div", { class: "sub" }, `${u.daysAway} dia(s) — ${u.date}`)
        ),
        h("div", { class: "right amt neg" }, fmt(u.amount))
      ))) : h("div", { class: "empty" }, "Sem vencimentos próximos")
    )
  ));

  // Transações recentes
  wrap.append(h("div", { class: "card" },
    h("h3", {}, "Transações recentes", h("a", { href: "#/transactions", class: "badge brand pointer" }, "Ver todas")),
    insights.length ? renderTxList(insights) : h("div", { class: "empty" }, h("div", { class: "icon" }, "📝"), "Sem transações")
  ));

  // Render chart after DOM
  setTimeout(() => drawFlowChart(), 0);
  return wrap;
}

function scoreLabel(s) {
  if (s >= 75) return "Excelente"; if (s >= 55) return "Bom"; if (s >= 35) return "Atenção"; return "Crítico";
}
function scoreHint(s) {
  if (s >= 75) return "Continue assim";
  if (s >= 55) return "Considere aumentar a taxa de poupança";
  if (s >= 35) return "Priorize reserva de emergência e redução de dívidas";
  return "Revise gastos urgentemente";
}

function kpiCard(label, value, delta, accent) {
  return h("div", { class: "kpi " + (accent ? "accent" : "") },
    h("div", { class: "label" }, label),
    h("div", { class: "value" }, value),
    delta
  );
}

function renderInsightItem(ins) {
  const sev = { danger:"danger", warn:"warn", ok:"ok", info:"info" }[ins.severity] || "info";
  return h("div", { class: "list-item" },
    h("div", { class: `badge ${sev}` }, ins.severity === "ok" ? "✓" : ins.severity === "danger" ? "!" : ins.severity === "warn" ? "⚠" : "i"),
    h("div", { class: "grow" },
      h("div", { class: "title" }, ins.title),
      h("div", { class: "sub" }, ins.msg),
    )
  );
}

function renderTxList(txs) {
  return h("div", { class: "list" }, ...txs.map(t => {
    const cat = Store.categoryById(t.category_id);
    const acc = Store.accountById(t.account_id);
    const card = t.card_id ? Store.cardById(t.card_id) : null;
    const isPos = t.amount > 0;
    return h("div", { class: "list-item" },
      h("div", { class: "avatar", style: `background:${cat?.color || "#64748b"}20; color:${cat?.color || "#64748b"}` }, cat?.icon || "📎"),
      h("div", { class: "grow" },
        h("div", { class: "title" }, t.description),
        h("div", { class: "sub" },
          `${t.date} • ${cat?.name || "—"}`,
          acc && ` • ${acc.icon} ${acc.name}`,
          card && ` • ${card.name}`,
          t.installment && ` • ${t.installment.index}/${t.installment.total}`
        )
      ),
      h("div", { class: "right" },
        h("div", { class: `amt ${isPos ? "pos" : "neg"}` }, (isPos ? "+" : "") + fmt(t.amount)),
        h("button", { class: "btn btn-ghost btn-icon", title: "Excluir",
          onClick: () => { if (confirm("Excluir esta transação?")) { Store.deleteTransaction(t.id); navigate(); } } },
          "✕")
      )
    );
  }));
}

function renderGoalsMini() {
  const goals = Store.goals().slice(0, 3);
  if (!goals.length) return h("div", { class: "empty" }, h("a", { href: "#/goals" }, "Criar primeira meta →"));
  return h("div", { class: "list" }, ...goals.map(g => {
    const pct = Math.min(100, (g.current_amount / g.target_amount) * 100);
    return h("div", { class: "list-item", style: "flex-direction:column; align-items:stretch" },
      h("div", { class: "flex items-center gap-3" },
        h("div", { class: "avatar", style: `background:${g.color}20; color:${g.color}` }, g.icon),
        h("div", { class: "grow" },
          h("div", { class: "title" }, g.name),
          h("div", { class: "sub" }, `${fmt(g.current_amount)} de ${fmt(g.target_amount)}`)
        ),
        h("div", { class: "right font-semi" }, `${pct.toFixed(0)}%`)
      ),
      h("div", { class: "progress gradient mt-2" }, h("div", { style: `width:${pct}%` }))
    );
  }));
}

function upcomingBills() {
  const out = [];
  const today = new Date();
  // Faturas de cartão
  for (const c of Store.cards()) {
    const inv = Store.cardInvoice(c.id);
    const due = new Date(inv.due_date);
    const days = Math.round((due - today) / 86400000);
    if (days >= 0 && days <= 20 && inv.total !== 0) {
      out.push({ title: `Fatura ${c.name}`, icon: "💳", amount: Math.abs(inv.total), date: inv.due_date, daysAway: days });
    }
  }
  // Transações parceladas futuras
  const txs = Store.data.transactions.filter(t => new Date(t.date) > today && t.type === "expense");
  txs.forEach(t => {
    const days = Math.round((new Date(t.date) - today) / 86400000);
    if (days <= 15) out.push({ title: t.description, icon: "🗓️", amount: Math.abs(t.amount), date: t.date, daysAway: days });
  });
  return out.sort((a,b) => a.daysAway - b.daysAway);
}

function drawFlowChart() {
  const ctx = document.getElementById("chart-flow");
  if (!ctx) return;
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(addMonths(monthKey(), -i));
  const data = months.map(m => Store.monthSummary(m));
  const isDark = document.documentElement.classList.contains("dark");
  const text = isDark ? "#cbd5e1" : "#475569";
  if (App.charts.flow) App.charts.flow.destroy();
  App.charts.flow = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months.map(monthLabel),
      datasets: [
        { label: "Entradas", data: data.map(d => d.income), backgroundColor: "#10b981" },
        { label: "Saídas", data: data.map(d => d.expense), backgroundColor: "#ef4444" },
        { label: "Saldo", data: data.map(d => d.net), type: "line", borderColor: "#6366f1", backgroundColor: "transparent", tension: 0.3, yAxisID: "y" }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: text }} },
      scales: {
        y: { ticks: { color: text, callback: v => fmtShort(v) }, grid: { color: "#e2e8f022" }},
        x: { ticks: { color: text }, grid: { display: false }}
      }
    }
  });
}

/* ============ ACCOUNTS ============ */
function renderAccounts() {
  const wrap = h("div", {});
  wrap.append(pageHead("Contas", "Saldos em tempo real — soma transações + saldo inicial",
    h("button", { class: "btn btn-gradient", onClick: openAccountModal }, "+ Nova conta")
  ));

  const accs = Store.accounts();
  if (!accs.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🏦"), "Nenhuma conta. Crie uma para começar."));
    return wrap;
  }

  const grid = h("div", { class: "grid grid-3" });
  for (const a of accs) {
    const bal = Store.accountBalance(a.id);
    grid.append(h("div", { class: "card" },
      h("div", { class: "flex items-center justify-between mb-2" },
        h("div", { class: "flex items-center gap-3" },
          h("div", { class: "avatar", style: `background:${a.color}20; color:${a.color}` }, a.icon),
          h("div", {},
            h("div", { class: "font-semi" }, a.name),
            h("div", { class: "text-xs text-muted" }, accountTypeLabel(a.type))
          )
        ),
        h("button", { class: "btn btn-ghost btn-icon", onClick: () => openAccountModal(a) }, "⚙️")
      ),
      h("div", { class: "text-2xl font-bold mt-2" }, fmt(bal)),
      h("div", { class: "text-xs text-muted" }, `Saldo inicial: ${fmt(a.initial_balance)}`),
      h("div", { class: "flex gap-2 mt-3" },
        h("button", { class: "btn btn-outline text-xs", onClick: () => { location.hash = `#/transactions?account=${a.id}`; } }, "Ver transações"),
        h("button", { class: "btn btn-ghost text-xs", style: "color:var(--danger)", onClick: () => {
          if (confirm(`Excluir "${a.name}" e todas as transações dela?`)) { Store.deleteAccount(a.id); navigate(); }
        } }, "Excluir")
      )
    ));
  }
  wrap.append(grid);
  return wrap;
}
function accountTypeLabel(t) {
  return { checking: "Conta corrente", savings: "Poupança", wallet: "Carteira", investment: "Investimento" }[t] || t;
}

/* ============ CARDS ============ */
function renderCards() {
  const wrap = h("div", {});
  wrap.append(pageHead("Cartões de crédito", "Limite, fatura e vencimento",
    h("button", { class: "btn btn-gradient", onClick: openCardModal }, "+ Novo cartão")
  ));

  const cards = Store.cards();
  if (!cards.length) return (wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "💳"), "Nenhum cartão cadastrado.")), wrap);

  const grid = h("div", { class: "grid grid-3" });
  for (const c of cards) {
    const used = Store.cardCurrentUsage(c.id);
    const inv = Store.cardInvoice(c.id);
    const pct = Math.min(100, (used / c.limit) * 100);
    const vis = h("div", { class: "ccard", style: `--_c1:${c.color_start}; --_c2:${c.color_end}` },
      h("div", {},
        h("div", { class: "text-xs", style: "opacity:.8" }, c.icon, " CRÉDITO"),
        h("div", { class: "name mt-2" }, c.name),
      ),
      h("div", {},
        h("div", { class: "text-xs", style: "opacity:.8" }, `Limite: ${fmt(c.limit)} • Usado: ${fmt(used)} (${pct.toFixed(0)}%)`),
        h("div", { class: "limit-bar" }, h("div", { style: `width:${pct}%` }))
      )
    );
    grid.append(h("div", { class: "card" },
      vis,
      h("div", { class: "mt-3 flex justify-between text-sm" },
        h("div", {}, h("div", { class: "text-xs text-muted" }, "Fatura atual"), h("div", { class: "font-semi" }, fmt(inv.total))),
        h("div", {}, h("div", { class: "text-xs text-muted" }, "Vencimento"), h("div", { class: "font-semi" }, inv.due_date))
      ),
      h("div", { class: "flex gap-2 mt-3" },
        h("button", { class: "btn btn-outline text-xs", onClick: () => { location.hash = `#/transactions?card=${c.id}`; } }, "Ver fatura"),
        h("button", { class: "btn btn-ghost text-xs", onClick: () => openCardModal(c) }, "Editar"),
        h("button", { class: "btn btn-ghost text-xs", style: "color:var(--danger)", onClick: () => {
          if (confirm(`Excluir "${c.name}"?`)) { Store.deleteCard(c.id); navigate(); }
        } }, "Excluir")
      )
    ));
  }
  wrap.append(grid);
  return wrap;
}

/* ============ TRANSACTIONS ============ */
function renderTransactions() {
  const wrap = h("div", {});
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  let filter = {
    month: params.get("month") || App.currentMonth,
    account_id: params.get("account") || "",
    card_id: params.get("card") || "",
    category_id: params.get("category") || "",
    type: params.get("type") || "",
    search: params.get("q") || ""
  };

  wrap.append(pageHead("Transações", "Todo o histórico financeiro",
    h("button", { class: "btn btn-outline", onClick: () => openImportModal() }, "📥 Importar"),
    h("button", { class: "btn btn-gradient", onClick: openNewTx }, "+ Nova")
  ));

  // Filter bar
  const filterBar = h("div", { class: "card mb-3" },
    h("div", { class: "grid grid-4 gap-2" },
      h("label", { class: "field" },
        h("span", { class: "lbl" }, "Mês"),
        h("input", { class: "input", type: "month", value: filter.month, onInput: e => { filter.month = e.target.value; refresh(); }})
      ),
      h("label", { class: "field" },
        h("span", { class: "lbl" }, "Conta"),
        selectAccount(filter.account_id, v => { filter.account_id = v; refresh(); }, true)
      ),
      h("label", { class: "field" },
        h("span", { class: "lbl" }, "Cartão"),
        selectCard(filter.card_id, v => { filter.card_id = v; refresh(); }, true)
      ),
      h("label", { class: "field" },
        h("span", { class: "lbl" }, "Buscar"),
        h("input", { class: "input", placeholder: "descrição...", value: filter.search, onInput: e => { filter.search = e.target.value; refresh(); }})
      ),
    )
  );
  wrap.append(filterBar);

  const listEl = h("div", { class: "card" });
  wrap.append(listEl);

  function refresh() {
    const txs = Store.listTransactions(filter);
    const total = txs.reduce((s,t) => s + t.amount, 0);
    listEl.innerHTML = "";
    listEl.append(
      h("div", { class: "flex justify-between mb-3" },
        h("div", { class: "text-sm text-muted" }, `${txs.length} transações`),
        h("div", { class: `font-semi ${total >= 0 ? "amt pos" : "amt neg"}` }, fmt(total))
      ),
      txs.length ? renderTxList(txs) : h("div", { class: "empty" }, h("div", { class: "icon" }, "📝"), "Nenhuma transação encontrada")
    );
  }
  refresh();
  return wrap;
}

/* ============ BUDGETS ============ */
function renderBudgets() {
  const wrap = h("div", {});
  wrap.append(pageHead("Orçamentos", `Limites por categoria — ${monthLabel(App.currentMonth)}`,
    monthPicker(),
    h("button", { class: "btn btn-gradient", onClick: openBudgetModal }, "+ Definir")
  ));

  const rep = Store.budgetReport(App.currentMonth);
  if (!rep.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🧮"),
      "Nenhum orçamento. Defina limites para cada categoria e receba alertas ao se aproximar."));
    return wrap;
  }

  const totalPlanned = rep.reduce((s,b) => s + b.planned, 0);
  const totalSpent = rep.reduce((s,b) => s + b.spent, 0);
  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Planejado", fmt(totalPlanned)),
    kpiCard("Gasto", fmt(totalSpent)),
    kpiCard("Restante", fmt(totalPlanned - totalSpent),
      h("div", { class: "delta" }, `${totalPlanned > 0 ? ((totalSpent/totalPlanned)*100).toFixed(0) : 0}% usado`))
  ));

  const card = h("div", { class: "card" });
  for (const b of rep) {
    const cat = Store.categoryById(b.category_id);
    const status = b.pct >= 100 ? "danger" : b.pct >= 80 ? "warning" : "success";
    card.append(h("div", { class: "list-item", style: "flex-direction:column; align-items:stretch" },
      h("div", { class: "flex items-center gap-3" },
        h("div", { class: "avatar", style: `background:${cat?.color || "#64748b"}20; color:${cat?.color || "#64748b"}` }, cat?.icon || "📎"),
        h("div", { class: "grow" },
          h("div", { class: "title" }, cat?.name || "—"),
          h("div", { class: "sub" }, `${fmt(b.spent)} de ${fmt(b.planned)} • ${fmt(b.remaining)} restante`)
        ),
        h("div", { class: `badge ${status}` }, `${b.pct.toFixed(0)}%`),
        h("button", { class: "btn btn-ghost btn-icon", onClick: () => { Store.deleteBudget(b.id); navigate(); } }, "✕")
      ),
      h("div", { class: `progress ${status} mt-2` }, h("div", { style: `width:${Math.min(100, b.pct)}%` }))
    ));
  }
  wrap.append(card);
  return wrap;
}

function monthPicker() {
  return h("input", { class: "input", type: "month", value: App.currentMonth, style: "width:auto",
    onChange: e => { App.currentMonth = e.target.value; navigate(); }});
}

/* ============ GOALS ============ */
function renderGoals() {
  const wrap = h("div", {});
  wrap.append(pageHead("Metas financeiras", "Objetivos de longo prazo",
    h("button", { class: "btn btn-gradient", onClick: openGoalModal }, "+ Nova meta")
  ));
  const goals = Store.goals();
  if (!goals.length) return (wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🎯"), "Nenhuma meta.")), wrap);

  const grid = h("div", { class: "grid grid-2" });
  for (const g of goals) {
    const pct = Math.min(100, (g.current_amount / g.target_amount) * 100);
    const monthsToGo = g.monthly_contribution > 0 ? Math.ceil((g.target_amount - g.current_amount) / g.monthly_contribution) : null;
    grid.append(h("div", { class: "card" },
      h("div", { class: "flex items-center gap-3" },
        h("div", { class: "avatar", style: `background:${g.color}20; color:${g.color}; width:48px; height:48px; font-size:24px` }, g.icon),
        h("div", { class: "grow" },
          h("div", { class: "font-semi text-lg" }, g.name),
          h("div", { class: "text-xs text-muted" }, `${fmt(g.current_amount)} de ${fmt(g.target_amount)}`)
        ),
        h("div", { class: "text-lg font-bold", style: `color:${g.color}` }, `${pct.toFixed(0)}%`)
      ),
      h("div", { class: "progress gradient mt-3" }, h("div", { style: `width:${pct}%` })),
      h("div", { class: "grid grid-2 mt-3 text-xs" },
        h("div", {}, h("div", { class: "text-muted" }, "Aporte mensal"), h("div", { class: "font-semi" }, fmt(g.monthly_contribution))),
        h("div", {}, h("div", { class: "text-muted" }, "Estimativa"), h("div", { class: "font-semi" }, monthsToGo ? `${monthsToGo} meses` : "—"))
      ),
      h("div", { class: "flex gap-2 mt-3" },
        h("button", { class: "btn btn-outline text-xs", onClick: () => {
          const v = prompt("Adicionar contribuição:", g.monthly_contribution);
          if (v !== null) Store.contributeGoal(g.id, +v); navigate();
        }}, "+ Aportar"),
        h("button", { class: "btn btn-ghost text-xs", onClick: () => openGoalModal(g) }, "Editar"),
        h("button", { class: "btn btn-ghost text-xs", style: "color:var(--danger)",
          onClick: () => { if (confirm("Excluir meta?")) { Store.deleteGoal(g.id); navigate(); }} }, "Excluir")
      )
    ));
  }
  wrap.append(grid);
  return wrap;
}

/* ============ DEBTS ============ */
function renderDebts() {
  const wrap = h("div", {});
  wrap.append(pageHead("Dívidas", "Estratégia de quitação otimizada",
    h("button", { class: "btn btn-gradient", onClick: openDebtModal }, "+ Nova dívida")
  ));

  const debts = Store.debts();
  if (!debts.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🎉"), "Sem dívidas cadastradas. Parabéns!"));
    return wrap;
  }

  const totalBalance = debts.reduce((s,d) => s + d.balance, 0);
  const strat = AI.debtStrategy(Store);
  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Total devido", fmt(totalBalance)),
    kpiCard("Estratégia recomendada", strat?.recommended === "avalanche" ? "Avalanche" : "Snowball",
      h("div", { class: "delta" }, strat ? `Economiza ${fmt(strat.savings)} em juros` : "")),
    kpiCard("Quitação", strat ? `${Math.ceil(strat[strat.recommended].months / 12)} anos` : "—",
      h("div", { class: "delta" }, strat ? `${strat[strat.recommended].months} meses` : ""))
  ));

  const card = h("div", { class: "card" });
  for (const d of debts) {
    const paid = d.installments_total ? (d.installments_paid / d.installments_total) * 100 : 0;
    card.append(h("div", { class: "list-item", style: "flex-direction:column; align-items:stretch" },
      h("div", { class: "flex items-center gap-3" },
        h("div", { class: "avatar", style: "background:rgba(239,68,68,.15); color:var(--danger)" }, "📉"),
        h("div", { class: "grow" },
          h("div", { class: "title" }, d.name),
          h("div", { class: "sub" }, `Saldo ${fmt(d.balance)} • Juros ${d.interest_rate}% a.m. ${d.installments_total ? `• ${d.installments_paid}/${d.installments_total} parcelas` : ""}`)
        ),
        h("button", { class: "btn btn-ghost btn-icon", onClick: () => { if (confirm("Excluir?")) { Store.deleteDebt(d.id); navigate(); }} }, "✕")
      ),
      d.installments_total && h("div", { class: "progress mt-2" }, h("div", { style: `width:${paid}%` }))
    ));
  }
  wrap.append(card);

  if (strat) {
    wrap.append(h("div", { class: "card mt-3" },
      h("h3", {}, "Comparação de estratégias"),
      h("div", { class: "grid grid-2" },
        h("div", { class: "kpi" + (strat.recommended === "avalanche" ? " accent" : "") },
          h("div", { class: "label" }, "Avalanche (maior juros primeiro)"),
          h("div", { class: "value" }, `${strat.avalanche.months} meses`),
          h("div", { class: "delta" }, `Juros totais: ${fmt(strat.avalanche.totalInterest)}`)
        ),
        h("div", { class: "kpi" + (strat.recommended === "snowball" ? " accent" : "") },
          h("div", { class: "label" }, "Bola de neve (menor saldo primeiro)"),
          h("div", { class: "value" }, `${strat.snowball.months} meses`),
          h("div", { class: "delta" }, `Juros totais: ${fmt(strat.snowball.totalInterest)}`)
        )
      )
    ));
  }
  return wrap;
}

/* ============ INVESTMENTS ============ */
function renderInvestments() {
  const wrap = h("div", {});
  wrap.append(pageHead("Investimentos", "Carteira e rentabilidade",
    h("button", { class: "btn btn-gradient", onClick: openInvestmentModal }, "+ Novo ativo")
  ));

  const inv = Store.investments();
  if (!inv.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "📈"),
      "Sem investimentos. Comece pela reserva de emergência (Tesouro Selic / CDB liquidez diária)."));
    return wrap;
  }

  const totalCurrent = inv.reduce((s,i) => s + i.quantity * i.current_price, 0);
  const totalInvested = inv.reduce((s,i) => s + i.quantity * i.avg_price, 0);
  const profit = totalCurrent - totalInvested;
  const pct = totalInvested > 0 ? (profit / totalInvested * 100) : 0;

  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Carteira atual", fmt(totalCurrent), h("div", { class: "delta" }, "Posição de mercado"), true),
    kpiCard("Total investido", fmt(totalInvested)),
    kpiCard("Rentabilidade", `${pct.toFixed(1)}%`,
      h("div", { class: "delta " + (profit >= 0 ? "pos" : "neg") }, `${profit >= 0 ? "+" : ""}${fmt(profit)}`))
  ));

  const table = h("div", { class: "card" },
    h("table", { class: "table" },
      h("thead", {}, h("tr", {},
        h("th", {}, "Ativo"),
        h("th", {}, "Qtd"),
        h("th", {}, "Preço médio"),
        h("th", {}, "Atual"),
        h("th", {}, "Posição"),
        h("th", {}, "%"),
        h("th", {})
      )),
      h("tbody", {}, ...inv.map(i => {
        const pos = i.quantity * i.current_price;
        const invPos = i.quantity * i.avg_price;
        const p = invPos > 0 ? ((pos - invPos) / invPos * 100) : 0;
        return h("tr", {},
          h("td", {}, h("div", { class: "font-semi" }, i.name),
                      h("div", { class: "text-xs text-muted" }, `${i.ticker} • ${typeLabel(i.type)}`)),
          h("td", {}, i.quantity),
          h("td", {}, fmt(i.avg_price)),
          h("td", {}, fmt(i.current_price)),
          h("td", {}, fmt(pos)),
          h("td", { class: p >= 0 ? "amt pos" : "amt neg" }, `${p.toFixed(1)}%`),
          h("td", {}, h("button", { class: "btn btn-ghost btn-icon", onClick: () => { if (confirm("Excluir?")) { Store.deleteInvestment(i.id); navigate(); } } }, "✕"))
        );
      }))
    )
  );
  wrap.append(table);
  return wrap;
}
function typeLabel(t) { return { renda_fixa: "Renda fixa", acoes: "Ações", fii: "FII", cripto: "Cripto", etf: "ETF" }[t] || t; }

/* ============ NET WORTH ============ */
function renderNetWorth() {
  const wrap = h("div", {});
  wrap.append(pageHead("Patrimônio líquido", "Ativos - Passivos = riqueza real"));

  const nw = Store.netWorth();
  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Patrimônio líquido", fmt(nw.net), h("div", { class: "delta" }, "Hoje"), true),
    kpiCard("Ativos totais", fmt(nw.assets), h("div", { class: "delta" }, "O que você tem")),
    kpiCard("Passivos totais", fmt(nw.liabilities), h("div", { class: "delta" }, "O que você deve"))
  ));

  wrap.append(h("div", { class: "grid grid-2" },
    h("div", { class: "card" },
      h("h3", {}, "Composição de ativos"),
      h("div", { class: "list" },
        breakdownRow("Contas e carteiras", nw.breakdown.cash, "#10b981", "💵"),
        breakdownRow("Investimentos", nw.breakdown.investments, "#0ea5e9", "📈"),
      ),
      h("div", { class: "flex justify-between mt-3 font-semi" },
        "Total ativos", h("span", {}, fmt(nw.assets))
      )
    ),
    h("div", { class: "card" },
      h("h3", {}, "Composição de passivos"),
      h("div", { class: "list" },
        breakdownRow("Dívidas", nw.breakdown.debts, "#ef4444", "📉"),
        breakdownRow("Cartões em aberto", nw.breakdown.cards_open, "#f59e0b", "💳"),
      ),
      h("div", { class: "flex justify-between mt-3 font-semi" },
        "Total passivos", h("span", {}, fmt(nw.liabilities))
      )
    )
  ));

  return wrap;
}
function breakdownRow(title, amount, color, icon) {
  return h("div", { class: "list-item" },
    h("div", { class: "avatar", style: `background:${color}20; color:${color}` }, icon),
    h("div", { class: "grow" }, h("div", { class: "title" }, title)),
    h("div", { class: "right font-semi" }, fmt(amount))
  );
}

/* ============ SAVINGS (Economizar) ============ */
function renderSavings() {
  const wrap = h("div", {});
  wrap.append(pageHead("Economizar", "Onde sua IA vê oportunidades de corte"));

  const ops = AI.savingsOpportunities(Store);
  const subs = AI.subscriptions(Store);
  const ef = AI.emergencyFund(Store);

  // Top opportunities
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Top oportunidades de economia", h("span", { class: "badge brand" }, "AI")),
    ops.length ? h("div", { class: "list" }, ...ops.slice(0, 8).map(o => h("div", { class: "list-item" },
      h("div", { class: "avatar", style: `background:${o.color}20; color:${o.color}` }, o.icon),
      h("div", { class: "grow" },
        h("div", { class: "title" }, o.category),
        h("div", { class: "sub" }, `Gasto mensal: ${fmt(o.monthly)} (${o.count} transações)`)
      ),
      h("div", { class: "right" },
        h("div", { class: "text-xs text-muted" }, "Corte 30% →"),
        h("div", { class: "amt pos" }, `+${fmt(o.savings30)}/mês`)
      )
    ))) : h("div", { class: "empty" }, "Sem dados do mês ainda")
  ));

  // Subscriptions
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "🔁 Assinaturas detectadas",
      subs.length && h("span", { class: "badge info" }, `${fmt(subs.reduce((s,x) => s + x.monthly, 0))}/mês`)),
    subs.length ? h("div", { class: "list" }, ...subs.map(s => {
      const cat = Store.categoryById(s.category_id);
      return h("div", { class: "list-item" },
        h("div", { class: "avatar", style: `background:${cat?.color || "#64748b"}20; color:${cat?.color || "#64748b"}` }, cat?.icon || "🔁"),
        h("div", { class: "grow" },
          h("div", { class: "title" }, s.description),
          h("div", { class: "sub" }, `Última cobrança: ${s.last_date} • ${s.count} meses`)
        ),
        h("div", { class: "right" },
          h("div", { class: "font-semi" }, fmt(s.monthly)),
          h("div", { class: "text-xs text-muted" }, `${fmt(s.annual)}/ano`)
        )
      );
    })) : h("div", { class: "empty" }, "Nenhuma assinatura recorrente detectada")
  ));

  // Emergency fund
  wrap.append(h("div", { class: "card" },
    h("h3", {}, "🛡️ Reserva de emergência"),
    h("div", { class: "grid grid-3" },
      kpiCard("Atual", fmt(ef.current)),
      kpiCard("Alvo (6 meses)", fmt(ef.target)),
      kpiCard("Cobertura", `${ef.monthsCovered} meses`,
        h("div", { class: `delta ${ef.status === "ok" ? "pos" : "neg"}` },
          ef.gap > 0 ? `Falta ${fmt(ef.gap)}` : "Meta atingida"))
    ),
    h("div", { class: `progress ${ef.status} mt-3` },
      h("div", { style: `width:${Math.min(100, ef.current/ef.target*100)}%` })),
    h("div", { class: "text-sm mt-3 text-muted" },
      "Mantenha em liquidez diária (Tesouro Selic, CDB 100% CDI com resgate imediato).")
  ));

  return wrap;
}

/* ============ FIRE (Investir) ============ */
function renderFire() {
  const wrap = h("div", {});
  wrap.append(pageHead("Investir & FIRE", "Independência financeira e simulador de juros compostos"));

  // FIRE
  const fireTab = h("div", {});
  const fireData = AI.fireProjection(Store);

  fireTab.append(h("div", { class: "card mb-3" },
    h("h3", {}, "🔥 Independência financeira (regra 4%)"),
    h("div", { class: "grid grid-4 mb-3" },
      kpiCard("Seu número FIRE", fmt(fireData.fireNumber),
        h("div", { class: "delta" }, "25× despesa anual")),
      kpiCard("Hoje investido", fmt(fireData.currentInvest),
        h("div", { class: "delta" }, `${fireData.progress}% do alvo`)),
      kpiCard("Aporte mensal", fmt(fireData.monthlyContribution),
        h("div", { class: "delta" }, `${(fireData.annualReturn*100).toFixed(0)}% a.a.`)),
      kpiCard("Tempo estimado", fireData.achievable ? `${fireData.yearsToFire} anos` : "50+ anos",
        h("div", { class: "delta" }, fireData.achievable ? "Mantendo o ritmo" : "Aumente aportes"), true)
    ),
    h("div", { class: "progress gradient" }, h("div", { style: `width:${Math.min(100, fireData.progress)}%` })),
    h("div", { style: "height:260px; margin-top:16px" }, h("canvas", { id: "chart-fire" }))
  ));

  // Simulator
  const simState = { initial: 10000, monthly: 1000, rate: 10, years: 15 };
  const simCard = h("div", { class: "card mb-3" },
    h("h3", {}, "🧮 Simulador de juros compostos"),
    h("div", { class: "grid grid-4" },
      numField("Inicial (R$)", simState.initial, v => { simState.initial = +v; drawSim(); }),
      numField("Aporte mensal (R$)", simState.monthly, v => { simState.monthly = +v; drawSim(); }),
      numField("Taxa anual (%)", simState.rate, v => { simState.rate = +v; drawSim(); }, 0.1),
      numField("Anos", simState.years, v => { simState.years = +v; drawSim(); })
    ),
    h("div", { id: "sim-result", class: "grid grid-3 mt-3" }),
    h("div", { style: "height:260px; margin-top:16px" }, h("canvas", { id: "chart-sim" }))
  );
  fireTab.append(simCard);

  // Tips
  fireTab.append(h("div", { class: "card" },
    h("h3", {}, "💡 Princípios de investimento"),
    h("ul", { class: "text-sm", style: "line-height:1.8; padding-left:20px" },
      h("li", {}, h("b", {}, "1. Reserva de emergência primeiro."), " Tesouro Selic / CDB líquido."),
      h("li", {}, h("b", {}, "2. Diversifique."), " Renda fixa + ações + FIIs + internacional."),
      h("li", {}, h("b", {}, "3. Aportes regulares ganham de timing."), " Automatize."),
      h("li", {}, h("b", {}, "4. Taxas matam rentabilidade."), " Prefira ETFs e Tesouro Direto."),
      h("li", {}, h("b", {}, "5. Invista em renda passiva."), " Dividendos + FIIs geram caixa mensal."),
      h("li", {}, h("b", {}, "6. Reinvestir é o segredo."), " Juros sobre juros: tempo é seu maior aliado."),
    )
  ));

  wrap.append(fireTab);

  setTimeout(() => { drawFire(fireData); drawSim(simState); }, 0);
  return wrap;
}
function numField(label, value, onChange, step = 1) {
  return h("label", { class: "field" },
    h("span", { class: "lbl" }, label),
    h("input", { class: "input", type: "number", step, value, onInput: e => onChange(e.target.value) })
  );
}
function drawFire(f) {
  const ctx = document.getElementById("chart-fire"); if (!ctx) return;
  if (App.charts.fire) App.charts.fire.destroy();
  App.charts.fire = new Chart(ctx, {
    type: "line",
    data: {
      labels: f.timeline.map(p => `Ano ${p.year}`),
      datasets: [{ label: "Patrimônio", data: f.timeline.map(p => p.balance),
        borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,.1)", fill: true, tension: .3 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }},
      scales: { y: { ticks: { callback: v => fmtShort(v) }}}}
  });
}
function drawSim(s) {
  if (s && s.initial !== undefined) window._simState = s;
  const st = window._simState || { initial: 10000, monthly: 1000, rate: 10, years: 15 };
  const r = AI.compoundSimulator({ initial: st.initial, monthly: st.monthly, annual_rate: st.rate / 100, years: st.years });
  const resEl = document.getElementById("sim-result");
  if (resEl) resEl.innerHTML = "";
  if (resEl) {
    resEl.appendChild(kpiCard("Valor final", fmt(r.final), h("div", { class: "delta" }, "Depois de " + st.years + " anos"), true));
    resEl.appendChild(kpiCard("Total investido", fmt(r.invested)));
    resEl.appendChild(kpiCard("Juros ganhos", fmt(r.profit),
      h("div", { class: "delta" }, `${r.invested > 0 ? (r.profit/r.invested*100).toFixed(0) : 0}% sobre aportes`)));
  }
  const ctx = document.getElementById("chart-sim"); if (!ctx) return;
  if (App.charts.sim) App.charts.sim.destroy();
  App.charts.sim = new Chart(ctx, {
    type: "line",
    data: {
      labels: r.timeline.map(p => `${p.year}a`),
      datasets: [
        { label: "Patrimônio", data: r.timeline.map(p => p.balance), borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,.12)", fill: true, tension: .3 },
        { label: "Aportado", data: r.timeline.map(p => p.invested), borderColor: "#94a3b8", fill: false, borderDash: [4,4] }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false,
      scales: { y: { ticks: { callback: v => fmtShort(v) }}}}
  });
}

/* ============ RECONCILE (Conciliação) ============ */
function renderReconcile() {
  const wrap = h("div", {});
  wrap.append(pageHead("Conciliação bancária", "Importe extratos, detecte duplicatas, categorize automaticamente"));

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "📥 Importar extrato"),
    h("div", { class: "grid grid-3 gap-3 mb-3" },
      h("div", {},
        h("div", { class: "font-semi" }, "CSV simples"),
        h("div", { class: "text-xs text-muted mb-2" }, "Formato: data,descrição,valor"),
        h("input", { type: "file", accept: ".csv", class: "input", onChange: e => handleCsv(e.target.files[0]) })
      ),
      h("div", {},
        h("div", { class: "font-semi" }, "JSON Pluggy"),
        h("div", { class: "text-xs text-muted mb-2" }, "Cole o resultado de /transactions"),
        h("button", { class: "btn btn-outline", onClick: openPluggyPaste }, "Colar JSON")
      ),
      h("div", {},
        h("div", { class: "font-semi" }, "Backend Pluggy"),
        h("div", { class: "text-xs text-muted mb-2" }, "Requer backend rodando com credenciais"),
        h("button", { class: "btn btn-outline", onClick: openPluggyBackend }, "Sincronizar")
      )
    ),
    h("div", { class: "text-xs text-muted" },
      "A conciliação detecta duplicatas (mesma descrição + valor em até 2 dias) e sugere categoria para transações novas.")
  ));

  // Não-categorizadas
  const uncat = Store.data.transactions.filter(t => t.category_id === "cat_other" || !t.category_id);
  if (uncat.length) {
    wrap.append(h("div", { class: "card mb-3" },
      h("h3", {}, `🏷️ ${uncat.length} transações sem categoria definida`),
      h("div", { class: "list scroll-y", style: "max-height:400px" }, ...uncat.slice(0, 50).map(t => {
        const suggestion = AI.suggestCategory(t.description);
        const suggestCat = suggestion ? Store.categoryById(suggestion) : null;
        return h("div", { class: "list-item" },
          h("div", { class: "avatar" }, "❓"),
          h("div", { class: "grow" },
            h("div", { class: "title" }, t.description),
            h("div", { class: "sub" }, `${t.date} • ${fmt(t.amount)}`)
          ),
          suggestCat && h("button", { class: "btn btn-outline text-xs",
            onClick: () => { Store.updateTransaction(t.id, { category_id: suggestCat.id }); navigate(); }
          }, `Aplicar ${suggestCat.icon} ${suggestCat.name}`),
          selectCategory(t.category_id || "", v => { Store.updateTransaction(t.id, { category_id: v }); navigate(); }),
        );
      }))
    ));
  }

  return wrap;
}
async function handleCsv(file) {
  if (!file) return;
  const text = await file.text();
  const accounts = Store.accounts();
  if (!accounts.length) return alert("Crie uma conta primeiro");
  const aid = accounts[0].id;
  const imported = Store.importCsv(text, aid);
  alert(`${imported} transações importadas na conta "${accounts[0].name}"`);
  navigate();
}
function openPluggyPaste() {
  openModal("Colar JSON Pluggy", h("div", {},
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "Cole o JSON retornado por /transactions (array de objetos com date, description, amount)"),
      h("textarea", { id: "pluggy-json", class: "textarea", rows: 10, style: "width:100%" })
    ),
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "Destino"),
      selectAccount("", () => {}, false, "pluggy-account")
    )
  ), [
    { label: "Importar", class: "btn-gradient", onClick: () => {
      try {
        const data = JSON.parse($("#pluggy-json").value);
        const items = Array.isArray(data) ? data : (data.results || data.transactions || []);
        const acc = $("#pluggy-account").value;
        if (!acc) return alert("Selecione conta");
        const incoming = items.map(i => ({
          date: i.date.slice(0,10),
          description: i.description || i.descriptionRaw || "",
          amount: +i.amount,
          external_id: i.id
        }));
        const r = AI.reconcile(Store.data.transactions, incoming);
        for (const n of r.new) {
          Store.addTransaction({
            date: n.date, description: n.description, amount: n.amount,
            account_id: acc, category_id: n.suggested_category,
            type: n.amount >= 0 ? "income" : "expense"
          });
        }
        closeModal();
        alert(`${r.new.length} nova(s), ${r.duplicates.length} duplicata(s) ignorada(s)`);
        navigate();
      } catch (e) { alert("JSON inválido: " + e.message); }
    }}
  ]);
}
async function openPluggyBackend() {
  const base = prompt("URL do backend Pluggy (rodando localmente):", localStorage.getItem("fa_pluggy_url") || "http://localhost:8000");
  if (!base) return;
  localStorage.setItem("fa_pluggy_url", base);

  // Opção 1: Connect Widget oficial do Pluggy (se disponível)
  const useWidget = window.PluggyConnect && confirm(
    "Abrir Pluggy Connect Widget para escolher o banco e autenticar?\n\n" +
    "OK = abre o widget oficial do Pluggy\n" +
    "Cancelar = usar fluxo manual (item_id direto)"
  );
  let itemId;
  if (useWidget) {
    try {
      const tokenRes = await fetch(base + "/pluggy/connect-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error("Backend /pluggy/connect-token falhou. Configure credenciais Pluggy.");
      const { accessToken } = await tokenRes.json();

      itemId = await new Promise((resolve, reject) => {
        const widget = new PluggyConnect({
          connectToken: accessToken,
          includeSandbox: true,
          onSuccess: (itemData) => { resolve(itemData.item.id); },
          onError: (err) => reject(err),
          onClose: () => reject(new Error("Widget fechado"))
        });
        widget.init();
      });
    } catch (e) {
      if (e.message === "Widget fechado") return;
      alert("Erro no Widget: " + e.message + "\n\nTentando fluxo manual...");
      itemId = prompt("Pluggy Item ID:");
    }
  } else {
    itemId = prompt("Pluggy Item ID:");
  }
  if (!itemId) return;

  try {
    const res = await fetch(base + "/pluggy/fetch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    const accs = Store.accounts();
    if (!accs.length) return alert("Crie pelo menos uma conta antes de sincronizar.");
    const pick = prompt(
      `Pluggy retornou ${data.transactions.length} transações em ${data.accounts.length} conta(s).\n\n` +
      `Em qual conta local importar?\n` +
      accs.map((a, i) => `${i+1}. ${a.icon} ${a.name}`).join("\n"),
      "1"
    );
    const idx = (+pick || 1) - 1;
    const acc = accs[idx];
    if (!acc) return;

    const incoming = data.transactions.map(t => ({
      date: t.date, description: t.description,
      amount: t.amount, external_id: t.id
    }));
    const r = AI.reconcile(Store.data.transactions, incoming);
    for (const n of r.new) {
      Store.addTransaction({
        date: n.date, description: n.description, amount: n.amount,
        account_id: acc.id, category_id: n.suggested_category,
        type: n.amount >= 0 ? "income" : "expense"
      });
    }
    alert(`✅ Importado: ${r.new.length} nova(s)\n🔁 Ignoradas (duplicatas): ${r.duplicates.length}`);
    navigate();
  } catch (e) { alert("Erro: " + e.message); }
}

/* ============ CHAT IA ============ */
function renderChat() {
  const wrap = h("div", {});
  wrap.append(pageHead("Chat IA financeira", "Pergunte em linguagem natural"));
  const msgsEl = h("div", { class: "chat-msgs", id: "chat-msgs" });
  const inputEl = h("input", { class: "input", id: "chat-input", placeholder: "Ex: Quanto gastei com alimentação?" });
  const sendBtn = h("button", { class: "btn btn-gradient", onClick: send }, "Enviar");

  const card = h("div", { class: "card", style: "padding:0; overflow:hidden" },
    h("div", { class: "chat-wrap" },
      msgsEl,
      h("div", { class: "chat-input-wrap" }, inputEl, sendBtn)
    )
  );
  wrap.append(card);

  addMsg("bot", "Olá! Sou sua IA financeira. Posso responder sobre saldos, gastos, economia, investimentos, metas, assinaturas, dívidas e mais.\n\nTente: *\"Onde posso economizar?\"*");

  // suggestions
  const suggestions = h("div", { class: "flex gap-2 mt-3", style: "flex-wrap:wrap" },
    ...["Qual meu saldo?", "Onde posso economizar?", "Quais minhas assinaturas?",
        "Quando atinjo a independência financeira?", "Como estão meus cartões?",
        "Qual meu patrimônio?"].map(q =>
      h("button", { class: "btn btn-outline text-xs", onClick: () => { inputEl.value = q; send(); } }, q))
  );
  wrap.append(suggestions);

  function addMsg(role, text) {
    const msg = h("div", { class: "chat-msg " + role, style: "white-space:pre-wrap" }, text);
    msgsEl.appendChild(msg);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function send() {
    const q = inputEl.value.trim(); if (!q) return;
    addMsg("user", q);
    inputEl.value = "";
    setTimeout(() => { addMsg("bot", AI.chat(Store, q)); }, 200);
  }
  inputEl.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  return wrap;
}

/* ============ SETTINGS ============ */
function renderSettings() {
  const wrap = h("div", {});
  wrap.append(pageHead("Configurações"));

  // === PERFIS ===
  const profiles = Object.values(Store.db.users);
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "👤 Perfil atual"),
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "Nome"),
      h("input", { class: "input", id: "set-name", value: Store.user.name })
    ),
    h("div", { class: "flex gap-2" },
      h("button", { class: "btn btn-primary", onClick: () => {
        Store.user.name = $("#set-name").value;
        Store.data.settings.first_name = $("#set-name").value;
        Store._save(); renderSidebar(); alert("Perfil atualizado");
      }}, "Salvar nome"),
      profiles.length > 1 && h("select", { class: "select", onChange: e => {
        Store._saveSession(e.target.value); location.reload();
      }},
        ...profiles.map(u => h("option", { value: u.id, selected: u.id === Store.currentUserId }, u.name + " (" + u.email + ")")))
    ),
    h("div", { class: "flex gap-2 mt-3" },
      h("button", { class: "btn btn-outline", onClick: () => {
        const name = prompt("Nome do novo perfil:", "Meu perfil");
        if (!name) return;
        const email = prompt("Email identificador:", name.toLowerCase().replace(/\s/g, "") + "@finance.local");
        if (!email) return;
        try {
          Store.register({ email, password: "local", name });
          location.reload();
        } catch (e) { alert(e.message); }
      }}, "+ Novo perfil"),
      profiles.length > 1 && h("button", { class: "btn btn-ghost", style: "color:var(--danger)", onClick: () => {
        if (!confirm(`Excluir perfil "${Store.user.name}" e seus dados?`)) return;
        delete Store.db.users[Store.user.email];
        delete Store.db.data[Store.currentUserId];
        Store._saveSession(null);
        Store._save();
        location.reload();
      }}, "Excluir perfil")
    )
  ));

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "🎨 Aparência"),
    h("button", { class: "btn btn-outline", onClick: () => {
      document.documentElement.classList.toggle("dark");
      localStorage.setItem("fa_v3_theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
      if (App.charts.flow) drawFlowChart();
    }}, "Alternar tema 🌓")
  ));

  // === NOTIFICAÇÕES ===
  wrap.append(renderNotifSection());

  // === CLOUD SYNC & FAMÍLIA ===
  wrap.append(renderCloudSection());

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Regras de categorização"),
    h("div", { class: "text-xs text-muted mb-3" },
      "Quando a descrição contiver a palavra-chave, a categoria será aplicada automaticamente."),
    h("div", { class: "grid grid-3 mb-3" },
      h("input", { id: "rule-kw", class: "input", placeholder: "Palavra-chave" }),
      selectCategory("", null, "rule-cat"),
      h("button", { class: "btn btn-gradient", onClick: () => {
        const kw = $("#rule-kw").value, cat = $("#rule-cat").value;
        if (kw && cat) { Store.addRule({ keyword: kw, category_id: cat }); navigate(); }
      }}, "+ Adicionar")
    ),
    h("div", { class: "list" }, ...Store.rules().map(r => {
      const cat = Store.categoryById(r.category_id);
      return h("div", { class: "list-item" },
        h("div", { class: "avatar" }, "⚡"),
        h("div", { class: "grow" }, h("div", { class: "title" }, `"${r.keyword}" → ${cat?.icon} ${cat?.name}`)),
        h("button", { class: "btn btn-ghost btn-icon", onClick: () => { Store.deleteRule(r.id); navigate(); }}, "✕")
      );
    }))
  ));

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Exportar / Importar"),
    h("div", { class: "flex gap-2" },
      h("button", { class: "btn btn-outline", onClick: () => {
        const blob = new Blob([Store.exportJson()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `finance-ai-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
      }}, "⬇ Exportar JSON"),
      h("button", { class: "btn btn-outline", onClick: async () => {
        const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
        input.onchange = async e => {
          const text = await e.target.files[0].text();
          if (confirm("Substituir TODOS os dados atuais?")) { Store.importJson(text); alert("Importado"); navigate(); }
        };
        input.click();
      }}, "⬆ Importar JSON")
    )
  ));

  wrap.append(h("div", { class: "card" },
    h("h3", { style: "color:var(--danger)" }, "Zona de perigo"),
    h("button", { class: "btn btn-danger", onClick: () => {
      if (confirm("ISTO APAGA TUDO (contas, cartões, transações, metas). Confirmar?")) {
        Store.resetAll(); navigate(); alert("Dados resetados");
      }
    }}, "🗑️ Zerar todos os dados")
  ));

  return wrap;
}

/* ============ MODALS ============ */
function openModal(title, body, actions = []) {
  closeModal();
  const bd = h("div", { class: "modal-backdrop", id: "modal-bd", onClick: e => { if (e.target.id === "modal-bd") closeModal(); } },
    h("div", { class: "modal" },
      h("div", { class: "modal-head" },
        h("h3", {}, title),
        h("button", { class: "btn btn-ghost btn-icon", onClick: closeModal }, "✕")
      ),
      h("div", { class: "modal-body" }, body),
      h("div", { class: "modal-foot" },
        h("button", { class: "btn btn-ghost", onClick: closeModal }, "Cancelar"),
        ...actions.map(a => h("button", { class: "btn " + (a.class || "btn-primary"), onClick: a.onClick }, a.label))
      )
    )
  );
  document.body.appendChild(bd);
}
function closeModal() { document.getElementById("modal-bd")?.remove(); }

function openNewTx() {
  const form = h("div", {},
    h("div", { class: "tabs", id: "tx-type-tabs" },
      h("button", { class: "active", "data-t": "expense" }, "Despesa"),
      h("button", { "data-t": "income" }, "Receita"),
      h("button", { "data-t": "transfer" }, "Transferência"),
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Descrição"),
      h("input", { id: "tx-desc", class: "input", placeholder: "Ex: Mercado" })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Valor"),
        h("input", { id: "tx-amt", class: "input", type: "number", step: ".01" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Data"),
        h("input", { id: "tx-date", class: "input", type: "date", value: new Date().toISOString().slice(0,10) }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Conta"),
      selectAccount("", () => {}, false, "tx-acc")),
    h("label", { class: "field", id: "tx-card-wrap" }, h("span", { class: "lbl" }, "Cartão (opcional)"),
      selectCard("", () => {}, true, "tx-card")),
    h("label", { class: "field", id: "tx-cat-wrap" }, h("span", { class: "lbl" }, "Categoria"),
      selectCategory("", null, "tx-cat")),
    h("label", { class: "field", id: "tx-inst-wrap" }, h("span", { class: "lbl" }, "Parcelas (se cartão)"),
      h("input", { id: "tx-inst", class: "input", type: "number", min: 1, value: 1 })),
    h("label", { class: "field hidden", id: "tx-to-wrap" }, h("span", { class: "lbl" }, "Conta destino"),
      selectAccount("", () => {}, false, "tx-to"))
  );
  openModal("+ Nova transação", form, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const t = $("#tx-type-tabs .active").dataset.t;
      const desc = $("#tx-desc").value, amt = +$("#tx-amt").value, date = $("#tx-date").value;
      if (!desc || !amt) return alert("Preencha descrição e valor");
      const payload = {
        date, description: desc,
        amount: t === "expense" ? -Math.abs(amt) : Math.abs(amt),
        account_id: $("#tx-acc").value,
        type: t,
        installments: +$("#tx-inst").value || 1,
        card_id: $("#tx-card").value || null,
        category_id: $("#tx-cat").value || null,
        transfer_to_account: t === "transfer" ? $("#tx-to").value : null
      };
      try { Store.addTransaction(payload); closeModal(); navigate(); }
      catch (e) { alert(e.message); }
    }
  }]);
  $$("#tx-type-tabs button").forEach(b => b.onclick = () => {
    $$("#tx-type-tabs button").forEach(x => x.classList.toggle("active", x === b));
    const t = b.dataset.t;
    $("#tx-to-wrap").classList.toggle("hidden", t !== "transfer");
    $("#tx-card-wrap").classList.toggle("hidden", t === "transfer");
    $("#tx-cat-wrap").classList.toggle("hidden", t === "transfer");
  });
}

function openAccountModal(existing) {
  const s = existing || { name: "", type: "checking", initial_balance: 0, color: "#6366f1", icon: "🏦", include_in_net_worth: true };
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"), h("input", { id: "ac-name", class: "input", value: s.name })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Tipo"),
        h("select", { id: "ac-type", class: "select" },
          h("option", { value: "checking", selected: s.type === "checking" }, "Corrente"),
          h("option", { value: "savings", selected: s.type === "savings" }, "Poupança"),
          h("option", { value: "wallet", selected: s.type === "wallet" }, "Carteira"),
          h("option", { value: "investment", selected: s.type === "investment" }, "Investimento"),
        )
      ),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Ícone"), h("input", { id: "ac-icon", class: "input", value: s.icon }))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Saldo inicial"),
        h("input", { id: "ac-bal", class: "input", type: "number", step: ".01", value: s.initial_balance })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Cor"),
        h("input", { id: "ac-color", class: "input", type: "color", value: s.color }))
    )
  );
  openModal((existing ? "Editar" : "+ Nova") + " conta", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const data = {
        name: $("#ac-name").value, type: $("#ac-type").value,
        initial_balance: +$("#ac-bal").value, color: $("#ac-color").value,
        icon: $("#ac-icon").value, include_in_net_worth: true
      };
      if (existing) Store.updateAccount(existing.id, data);
      else Store.addAccount(data);
      closeModal(); navigate();
    }
  }]);
}

function openCardModal(existing) {
  const s = existing || { name: "", limit: 1000, closing_day: 25, due_day: 5, color_start: "#6366f1", color_end: "#ec4899", icon: "💳" };
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"), h("input", { id: "ca-name", class: "input", value: s.name })),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Limite"), h("input", { id: "ca-lim", class: "input", type: "number", value: s.limit })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Fechamento (dia)"), h("input", { id: "ca-close", class: "input", type: "number", min: 1, max: 31, value: s.closing_day })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Vencimento (dia)"), h("input", { id: "ca-due", class: "input", type: "number", min: 1, max: 31, value: s.due_day }))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Cor início"), h("input", { id: "ca-c1", class: "input", type: "color", value: s.color_start })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Cor fim"), h("input", { id: "ca-c2", class: "input", type: "color", value: s.color_end }))
    )
  );
  openModal((existing ? "Editar" : "+ Novo") + " cartão", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const data = {
        name: $("#ca-name").value, limit: +$("#ca-lim").value,
        closing_day: +$("#ca-close").value, due_day: +$("#ca-due").value,
        color_start: $("#ca-c1").value, color_end: $("#ca-c2").value,
        icon: "💳"
      };
      if (existing) Store.updateCard(existing.id, data);
      else Store.addCard(data);
      closeModal(); navigate();
    }
  }]);
}

function openBudgetModal() {
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Mês"),
      h("input", { id: "bu-month", class: "input", type: "month", value: App.currentMonth })),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Categoria"),
      selectCategory("", null, "bu-cat")),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Valor planejado"),
      h("input", { id: "bu-amt", class: "input", type: "number", step: ".01" }))
  );
  openModal("Definir orçamento", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      Store.setBudget({
        month: $("#bu-month").value, category_id: $("#bu-cat").value,
        planned: +$("#bu-amt").value
      });
      closeModal(); navigate();
    }
  }]);
}

function openGoalModal(existing) {
  const s = existing || { name: "", target_amount: 10000, current_amount: 0, monthly_contribution: 500, icon: "🎯", color: "#6366f1" };
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"), h("input", { id: "go-name", class: "input", value: s.name })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Alvo (R$)"), h("input", { id: "go-target", class: "input", type: "number", value: s.target_amount })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Atual (R$)"), h("input", { id: "go-current", class: "input", type: "number", value: s.current_amount }))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Aporte mensal"), h("input", { id: "go-monthly", class: "input", type: "number", value: s.monthly_contribution })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Ícone"), h("input", { id: "go-icon", class: "input", value: s.icon }))
    )
  );
  openModal((existing ? "Editar" : "+ Nova") + " meta", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const data = {
        name: $("#go-name").value, target_amount: +$("#go-target").value,
        current_amount: +$("#go-current").value, monthly_contribution: +$("#go-monthly").value,
        icon: $("#go-icon").value, color: s.color
      };
      if (existing) Store.updateGoal(existing.id, data);
      else Store.addGoal(data);
      closeModal(); navigate();
    }
  }]);
}

function openDebtModal() {
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"), h("input", { id: "de-name", class: "input" })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Valor total"), h("input", { id: "de-total", class: "input", type: "number" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Saldo atual"), h("input", { id: "de-bal", class: "input", type: "number" }))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Juros mensal (%)"), h("input", { id: "de-rate", class: "input", type: "number", step: ".01", value: 1 })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Parcelas total"), h("input", { id: "de-total-inst", class: "input", type: "number" }))
    )
  );
  openModal("+ Nova dívida", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      Store.addDebt({
        name: $("#de-name").value, total_amount: +$("#de-total").value,
        balance: +$("#de-bal").value, interest_rate: +$("#de-rate").value,
        installments_total: +$("#de-total-inst").value || null
      });
      closeModal(); navigate();
    }
  }]);
}

function openInvestmentModal() {
  const body = h("div", {},
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"), h("input", { id: "in-name", class: "input" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Ticker"), h("input", { id: "in-ticker", class: "input" }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Tipo"),
      h("select", { id: "in-type", class: "select" },
        h("option", { value: "renda_fixa" }, "Renda fixa"),
        h("option", { value: "acoes" }, "Ações"),
        h("option", { value: "fii" }, "FII"),
        h("option", { value: "etf" }, "ETF"),
        h("option", { value: "cripto" }, "Cripto")
      )
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Quantidade"), h("input", { id: "in-qty", class: "input", type: "number", step: ".0001" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Preço médio"), h("input", { id: "in-avg", class: "input", type: "number", step: ".01" }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Preço atual"),
      h("input", { id: "in-cur", class: "input", type: "number", step: ".01" }))
  );
  openModal("+ Novo investimento", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      Store.addInvestment({
        name: $("#in-name").value, ticker: $("#in-ticker").value, type: $("#in-type").value,
        quantity: +$("#in-qty").value, avg_price: +$("#in-avg").value, current_price: +$("#in-cur").value
      });
      closeModal(); navigate();
    }
  }]);
}

function openImportModal() { location.hash = "#/reconcile"; }

/* ============ SELECT HELPERS ============ */
function selectAccount(value, onChange, allowEmpty = false, id = "") {
  const sel = h("select", { class: "select", id });
  if (allowEmpty) sel.appendChild(h("option", { value: "" }, "— todas —"));
  for (const a of Store.accounts()) sel.appendChild(h("option", { value: a.id, selected: a.id === value }, `${a.icon} ${a.name}`));
  if (onChange) sel.onchange = e => onChange(e.target.value);
  return sel;
}
function selectCard(value, onChange, allowEmpty = true, id = "") {
  const sel = h("select", { class: "select", id });
  if (allowEmpty) sel.appendChild(h("option", { value: "" }, "— nenhum —"));
  for (const c of Store.cards()) sel.appendChild(h("option", { value: c.id, selected: c.id === value }, c.name));
  if (onChange) sel.onchange = e => onChange(e.target.value);
  return sel;
}
function selectCategory(value, onChange, id = "") {
  const sel = h("select", { class: "select", id });
  const groups = {};
  for (const c of Store.categories()) (groups[c.group] = groups[c.group] || []).push(c);
  for (const [g, cats] of Object.entries(groups)) {
    const og = h("optgroup", { label: g });
    for (const c of cats) og.appendChild(h("option", { value: c.id, selected: c.id === value }, `${c.icon} ${c.name}`));
    sel.appendChild(og);
  }
  if (onChange) sel.onchange = e => onChange(e.target.value);
  return sel;
}

/* ============ CALENDAR view ============ */
function renderCalendar() {
  const wrap = h("div", {});
  const [year, month] = App.currentMonth.split("-").map(Number);
  wrap.append(pageHead("Calendário", monthLabel(App.currentMonth) + " — transações e vencimentos",
    monthPicker(),
    h("button", { class: "btn btn-outline", onClick: () => {
      const d = new Date(year, month - 2, 1);
      App.currentMonth = d.toISOString().slice(0,7); navigate();
    }}, "◀"),
    h("button", { class: "btn btn-outline", onClick: () => {
      const d = new Date(year, month, 1);
      App.currentMonth = d.toISOString().slice(0,7); navigate();
    }}, "▶"),
  ));

  // Summary
  const ms = Store.monthSummary(App.currentMonth);
  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Entradas", fmt(ms.income)),
    kpiCard("Saídas", fmt(ms.expense)),
    kpiCard("Saldo do mês", fmt(ms.net),
      h("div", { class: `delta ${ms.net >= 0 ? "pos" : "neg"}` }, ms.net >= 0 ? "Positivo" : "Negativo"),
      true)
  ));

  // Grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startOffset = firstDay.getDay(); // 0 = dom
  const grid = h("div", { class: "cal-grid" });

  // Headers
  ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].forEach(d =>
    grid.appendChild(h("div", { class: "text-xs text-muted font-semi", style: "text-align:center; padding:6px 0" }, d)));

  // Prev month pad
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month - 1, -startOffset + i + 1);
    grid.appendChild(calCell(d, true));
  }
  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    grid.appendChild(calCell(new Date(year, month - 1, d), false));
  }
  // Next month pad
  const total = startOffset + lastDay.getDate();
  const pad = Math.ceil(total / 7) * 7 - total;
  for (let i = 1; i <= pad; i++) {
    grid.appendChild(calCell(new Date(year, month, i), true));
  }

  wrap.append(h("div", { class: "card" }, grid));
  return wrap;
}
function calCell(date, isOther) {
  const dStr = date.toISOString().slice(0,10);
  const today = new Date().toISOString().slice(0,10);
  const txs = Store.data.transactions.filter(t => t.date === dStr);
  const cards = Store.cards();
  const billsToday = cards.filter(c => {
    const inv = Store.cardInvoice(c.id);
    return inv.due_date === dStr && inv.total !== 0;
  });

  const cell = h("div", { class: "cal-cell " + (isOther ? "other" : "") + (dStr === today ? " today" : ""),
    onClick: () => { if (txs.length) { location.hash = `#/transactions?month=${dStr.slice(0,7)}`; } }},
    h("div", { class: "cal-day" }, date.getDate()),
    ...txs.slice(0, 3).map(t => h("div", {
      class: "cal-tx " + (t.amount > 0 ? "pos" : "neg"),
      title: t.description + " " + fmt(t.amount)
    }, (t.amount > 0 ? "+" : "") + fmtShort(Math.abs(t.amount)) + " " + t.description.slice(0, 12))),
    txs.length > 3 && h("div", { class: "text-xs text-muted" }, `+${txs.length - 3}`),
    ...billsToday.map(c => h("div", { class: "cal-tx bill", title: c.name + " vence" },
      "💳 " + c.name.slice(0, 10)))
  );
  return cell;
}

/* ============ REPORTS view ============ */
function renderReports() {
  const wrap = h("div", {});
  wrap.append(pageHead("Relatórios", "Análises detalhadas da sua vida financeira", monthPicker()));

  const months = [];
  for (let i = 11; i >= 0; i--) months.push(addMonths(App.currentMonth, -i));
  const summaries = months.map(m => ({ month: m, ...Store.monthSummary(m) }));

  // Cards KPIs do período
  const totalIn = summaries.reduce((s,x) => s + x.income, 0);
  const totalOut = summaries.reduce((s,x) => s + x.expense, 0);
  const avgIn = totalIn / 12, avgOut = totalOut / 12;
  wrap.append(h("div", { class: "grid grid-4 mb-3" },
    kpiCard("Receita 12m", fmt(totalIn), h("div", { class: "delta" }, `Média ${fmt(avgIn)}/mês`)),
    kpiCard("Despesa 12m", fmt(totalOut), h("div", { class: "delta" }, `Média ${fmt(avgOut)}/mês`)),
    kpiCard("Saldo 12m", fmt(totalIn - totalOut),
      h("div", { class: "delta " + (totalIn > totalOut ? "pos" : "neg") },
        `Taxa poupança ${totalIn > 0 ? (((totalIn - totalOut)/totalIn)*100).toFixed(0) : 0}%`), true),
    kpiCard("Transações", Store.data.transactions.length,
      h("div", { class: "delta" }, `${Store.accounts().length} contas`))
  ));

  // Gráfico evolução anual
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Evolução 12 meses"),
    h("div", { style: "height:280px" }, h("canvas", { id: "chart-yearly" }))
  ));

  // Heatmap categorias mês a mês
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Gastos por categoria nos últimos 6 meses"),
    h("div", { class: "table-wrap" }, renderCategoryHeatmap())
  ));

  // Comparação MoM
  const cur = Store.monthSummary(App.currentMonth);
  const prev = Store.monthSummary(addMonths(App.currentMonth, -1));
  wrap.append(h("div", { class: "grid grid-2 mb-3" },
    h("div", { class: "card" },
      h("h3", {}, "Mês atual vs anterior"),
      compareBar("Receita", cur.income, prev.income, "#10b981"),
      compareBar("Despesa", cur.expense, prev.expense, "#ef4444"),
      compareBar("Saldo", cur.net, prev.net, "#6366f1"),
    ),
    h("div", { class: "card" },
      h("h3", {}, "Por dia da semana (últimos 90d)"),
      h("div", { style: "height:200px" }, h("canvas", { id: "chart-dow" }))
    )
  ));

  // Top pagadores (descrições mais frequentes)
  const txs = Store.data.transactions.filter(t => t.type === "expense");
  const byDesc = {};
  for (const t of txs.slice(-500)) {
    const k = (t.description || "").toLowerCase().trim();
    (byDesc[k] = byDesc[k] || { desc: t.description, count: 0, total: 0 }).count++;
    byDesc[k].total += Math.abs(t.amount);
  }
  const top = Object.values(byDesc).sort((a,b) => b.total - a.total).slice(0, 10);
  wrap.append(h("div", { class: "card" },
    h("h3", {}, "Top 10 maiores recebedores (onde seu dinheiro vai)"),
    h("div", { class: "list" }, ...top.map((x, i) => h("div", { class: "list-item" },
      h("div", { class: "avatar" }, `${i+1}`),
      h("div", { class: "grow" },
        h("div", { class: "title" }, x.desc),
        h("div", { class: "sub" }, `${x.count} transações • ${fmt(x.total / x.count)} em média`)
      ),
      h("div", { class: "right amt neg" }, fmt(x.total))
    )))
  ));

  setTimeout(() => { drawYearlyChart(summaries); drawDowChart(); }, 0);
  return wrap;
}

function renderCategoryHeatmap() {
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(addMonths(App.currentMonth, -i));
  const cats = Store.categories().filter(c => c.type !== "income" && c.type !== "transfer");
  const byCat = {};
  for (const c of cats) {
    byCat[c.id] = { cat: c, months: months.map(m =>
      Store.listTransactions({ month: m, category_id: c.id })
        .filter(t => t.type === "expense")
        .reduce((s,t) => s + Math.abs(t.amount), 0)
    )};
  }
  const rows = Object.values(byCat).filter(r => r.months.some(v => v > 0))
    .sort((a,b) => b.months.reduce((s,v)=>s+v,0) - a.months.reduce((s,v)=>s+v,0));
  const maxV = Math.max(1, ...rows.flatMap(r => r.months));

  const tbl = h("table", { class: "table" },
    h("thead", {}, h("tr", {},
      h("th", {}, "Categoria"),
      ...months.map(m => h("th", {}, monthLabel(m).slice(0,3))),
      h("th", {}, "Total")
    )),
    h("tbody", {}, ...rows.slice(0, 15).map(r => h("tr", {},
      h("td", {}, `${r.cat.icon} ${r.cat.name}`),
      ...r.months.map(v => {
        const intensity = v / maxV;
        const bg = `rgba(239,68,68,${0.05 + intensity * 0.4})`;
        return h("td", { style: `background:${bg}; text-align:right` },
          v > 0 ? fmt(v) : "—");
      }),
      h("td", { class: "font-semi" }, fmt(r.months.reduce((s,v) => s+v, 0)))
    )))
  );
  return tbl;
}

function compareBar(label, cur, prev, color) {
  const max = Math.max(Math.abs(cur), Math.abs(prev), 1);
  const diff = prev > 0 ? ((cur - prev) / prev * 100) : 0;
  return h("div", { class: "mt-3" },
    h("div", { class: "flex justify-between text-sm mb-2" },
      h("div", {}, label),
      h("div", {}, fmt(cur), " ", h("span", { class: `badge ${diff >= 0 ? "ok" : "danger"}`, style: "margin-left:6px" },
        `${diff >= 0 ? "+" : ""}${diff.toFixed(0)}% vs anterior`))
    ),
    h("div", { class: "flex gap-2 items-center" },
      h("div", { style: "width:70px; text-align:right; font-size:11px; color:var(--text-muted)" }, "Atual"),
      h("div", { class: "progress", style: "flex:1" }, h("div", { style: `width:${Math.abs(cur)/max*100}%; background:${color}` })),
      h("div", { style: "width:90px; text-align:right; font-size:11px" }, fmt(cur))
    ),
    h("div", { class: "flex gap-2 items-center mt-2" },
      h("div", { style: "width:70px; text-align:right; font-size:11px; color:var(--text-muted)" }, "Anterior"),
      h("div", { class: "progress", style: "flex:1" }, h("div", { style: `width:${Math.abs(prev)/max*100}%; background:${color}88` })),
      h("div", { style: "width:90px; text-align:right; font-size:11px" }, fmt(prev))
    )
  );
}

function drawYearlyChart(summaries) {
  const ctx = document.getElementById("chart-yearly"); if (!ctx) return;
  const isDark = document.documentElement.classList.contains("dark");
  const text = isDark ? "#cbd5e1" : "#475569";
  if (App.charts.yearly) App.charts.yearly.destroy();
  App.charts.yearly = new Chart(ctx, {
    type: "line",
    data: {
      labels: summaries.map(s => monthLabel(s.month).slice(0,3)),
      datasets: [
        { label: "Receita", data: summaries.map(s => s.income), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,.12)", fill: true, tension: .3 },
        { label: "Despesa", data: summaries.map(s => s.expense), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,.12)", fill: true, tension: .3 },
        { label: "Saldo", data: summaries.map(s => s.net), borderColor: "#6366f1", fill: false, tension: .3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: text } }},
      scales: { y: { ticks: { color: text, callback: v => fmtShort(v) }}, x: { ticks: { color: text }}}
    }
  });
}
function drawDowChart() {
  const ctx = document.getElementById("chart-dow"); if (!ctx) return;
  const dows = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const totals = [0,0,0,0,0,0,0];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  for (const t of Store.data.transactions) {
    const d = new Date(t.date);
    if (d >= cutoff && t.amount < 0) totals[d.getDay()] += Math.abs(t.amount);
  }
  const isDark = document.documentElement.classList.contains("dark");
  const text = isDark ? "#cbd5e1" : "#475569";
  if (App.charts.dow) App.charts.dow.destroy();
  App.charts.dow = new Chart(ctx, {
    type: "bar",
    data: { labels: dows, datasets: [{ data: totals, backgroundColor: "#8b5cf6" }]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }},
      scales: { y: { ticks: { color: text, callback: v => fmtShort(v) }}, x: { ticks: { color: text }}}}
  });
}

/* ============ ALLOCATION (in investments view) ============ */
function renderAllocation() {
  const inv = Store.investments();
  if (!inv.length) return null;
  const total = inv.reduce((s,i) => s + i.quantity * i.current_price, 0);
  const byType = {};
  for (const i of inv) {
    const pos = i.quantity * i.current_price;
    byType[i.type] = (byType[i.type] || 0) + pos;
  }
  const typeColors = { renda_fixa: "#0ea5e9", acoes: "#10b981", fii: "#f59e0b", etf: "#8b5cf6", cripto: "#ef4444" };
  const typeLabels = { renda_fixa: "Renda fixa", acoes: "Ações", fii: "FII", etf: "ETF", cripto: "Cripto" };
  return h("div", { class: "card mb-3" },
    h("h3", {}, "🥧 Alocação por tipo de ativo"),
    h("div", { class: "grid grid-2" },
      h("div", { style: "height:220px" }, h("canvas", { id: "chart-alloc" })),
      h("div", { class: "list" }, ...Object.entries(byType)
        .sort(([,a],[,b]) => b - a)
        .map(([t, v]) => h("div", { class: "list-item" },
          h("div", { class: "avatar", style: `background:${typeColors[t]}22; color:${typeColors[t]}` }, "●"),
          h("div", { class: "grow" },
            h("div", { class: "title" }, typeLabels[t] || t),
            h("div", { class: "progress mt-2" }, h("div", { style: `width:${v/total*100}%; background:${typeColors[t]}` }))
          ),
          h("div", { class: "right" },
            h("div", { class: "font-semi" }, `${(v/total*100).toFixed(1)}%`),
            h("div", { class: "text-xs text-muted" }, fmt(v))
          )
        )))
    )
  );
}

/* ============ GLOBAL SEARCH (Ctrl+K) ============ */
function openSearch() {
  const modal = document.getElementById("search-modal");
  modal.classList.remove("hidden");
  modal.className = "search-modal";
  modal.innerHTML = "";
  const box = h("div", { class: "search-box" },
    h("input", { id: "srch-input", class: "search-input", placeholder: "Buscar transações, contas, categorias, páginas… (Esc para sair)", autofocus: true }),
    h("div", { id: "srch-results", class: "search-results" })
  );
  modal.appendChild(box);
  modal.onclick = (e) => { if (e.target === modal) closeSearch(); };
  const input = box.querySelector("#srch-input");
  input.oninput = () => updateSearch(input.value);
  input.onkeydown = (e) => {
    if (e.key === "Escape") closeSearch();
    if (e.key === "Enter") {
      const first = modal.querySelector(".search-result");
      if (first) first.click();
    }
  };
  updateSearch("");
  setTimeout(() => input.focus(), 20);
}
function closeSearch() {
  const modal = document.getElementById("search-modal");
  modal.className = "hidden";
  modal.innerHTML = "";
}
function updateSearch(q) {
  const qn = (q || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const el = document.getElementById("srch-results");
  el.innerHTML = "";

  // Páginas
  const pages = Object.entries(routes).filter(([_, r]) =>
    !q || r.title.toLowerCase().includes(q.toLowerCase()));
  if (pages.length) {
    el.appendChild(h("div", { class: "search-section" }, "Navegar"));
    for (const [key, r] of pages.slice(0, 5)) {
      el.appendChild(h("div", { class: "search-result",
        onClick: () => { closeSearch(); location.hash = `#/${key}`; }},
        h("div", {}, r.icon, " ", r.title)
      ));
    }
  }

  // Transações
  if (q) {
    const txs = Store.listTransactions({ search: q, limit: 8 });
    if (txs.length) {
      el.appendChild(h("div", { class: "search-section" }, "Transações"));
      for (const t of txs) {
        const cat = Store.categoryById(t.category_id);
        el.appendChild(h("div", { class: "search-result",
          onClick: () => { closeSearch(); location.hash = `#/transactions?q=${encodeURIComponent(q)}`; }},
          h("div", { class: "avatar", style: "width:28px; height:28px" }, cat?.icon || "📎"),
          h("div", { class: "grow" },
            h("div", {}, t.description),
            h("div", { class: "text-xs text-muted" }, `${t.date} • ${cat?.name || "—"}`)
          ),
          h("div", { class: "font-semi " + (t.amount > 0 ? "amt pos" : "amt neg") }, fmt(t.amount))
        ));
      }
    }
    // Contas
    const accs = Store.accounts().filter(a => a.name.toLowerCase().includes(q.toLowerCase()));
    if (accs.length) {
      el.appendChild(h("div", { class: "search-section" }, "Contas"));
      for (const a of accs) {
        el.appendChild(h("div", { class: "search-result",
          onClick: () => { closeSearch(); location.hash = `#/transactions?account=${a.id}`; }},
          h("div", {}, a.icon, " ", a.name, " — ", fmt(Store.accountBalance(a.id)))
        ));
      }
    }
    // Categorias
    const cats = Store.categories().filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
    if (cats.length) {
      el.appendChild(h("div", { class: "search-section" }, "Categorias"));
      for (const c of cats.slice(0, 5)) {
        el.appendChild(h("div", { class: "search-result",
          onClick: () => { closeSearch(); location.hash = `#/transactions?category=${c.id}`; }},
          h("div", {}, c.icon, " ", c.name, h("span", { class: "text-xs text-muted" }, " — ", c.group))
        ));
      }
    }
  }
}

/* ============ NOTIFICATIONS (bell) ============ */
function openNotifs() {
  closeNotifs();
  const ins = AI.insights(Store);
  const drawer = h("div", { class: "notif-drawer", id: "notif-drawer" },
    h("div", { class: "flex justify-between mb-2" },
      h("div", { class: "font-semi" }, "Notificações"),
      h("button", { class: "btn btn-ghost btn-icon", onClick: closeNotifs }, "✕")
    ),
    ins.length ? h("div", { class: "list" }, ...ins.map(renderInsightItem))
      : h("div", { class: "empty" }, "Tudo em ordem por aqui ✨")
  );
  document.body.appendChild(drawer);
  setTimeout(() => { document.addEventListener("click", notifOutsideClick); }, 50);
}
function notifOutsideClick(e) {
  const dr = document.getElementById("notif-drawer");
  if (dr && !dr.contains(e.target) && !e.target.closest("#notif-btn")) closeNotifs();
}
function closeNotifs() {
  document.getElementById("notif-drawer")?.remove();
  document.removeEventListener("click", notifOutsideClick);
}
function updateNotifDot() {
  const ins = Store.currentUserId ? AI.insights(Store) : [];
  const dot = document.getElementById("notif-dot");
  if (!dot) return;
  const hasCritical = ins.some(i => i.severity === "danger" || i.severity === "warn");
  dot.classList.toggle("hidden", !hasCritical);
}

/* ============ OFX IMPORT ============ */
async function handleOfx(file) {
  if (!file) return;
  const text = await file.text();
  const accs = Store.accounts();
  if (!accs.length) return alert("Crie uma conta primeiro");
  const pick = prompt("Em qual conta importar?\n" + accs.map((a,i) => `${i+1}. ${a.icon} ${a.name}`).join("\n"), "1");
  const acc = accs[(+pick || 1) - 1];
  if (!acc) return;

  // Parse simples OFX
  const txs = [];
  const rx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  const getTag = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  let m;
  while ((m = rx.exec(text)) !== null) {
    const block = m[1];
    const d = getTag(block, "DTPOSTED").slice(0, 8);
    const date = d ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : "";
    const amount = +getTag(block, "TRNAMT").replace(",", ".");
    const memo = getTag(block, "MEMO") || getTag(block, "NAME");
    const fitid = getTag(block, "FITID");
    if (date && amount) txs.push({ date, description: memo || "(sem descrição)", amount, external_id: fitid });
  }
  if (!txs.length) return alert("Não encontrei transações no OFX.");

  const r = AI.reconcile(Store.data.transactions, txs);
  for (const n of r.new) {
    Store.addTransaction({
      date: n.date, description: n.description, amount: n.amount,
      account_id: acc.id, category_id: n.suggested_category,
      type: n.amount >= 0 ? "income" : "expense"
    });
  }
  alert(`✅ ${r.new.length} novas • 🔁 ${r.duplicates.length} duplicatas ignoradas`);
  navigate();
}

/* ============ ONBOARDING ============ */
function maybeOnboard() {
  if (localStorage.getItem("fa_v3_onboarded")) return;
  if (Store.data.transactions.length) { localStorage.setItem("fa_v3_onboarded", "1"); return; }
  const steps = [
    {
      icon: "👋", title: `Bem-vindo, ${Store.user.name}!`,
      body: "Vamos configurar sua gestão financeira em 4 passos rápidos. Você pode pular e fazer depois.",
      cta: "Começar", next: 1
    },
    {
      icon: "🏦", title: "Adicione sua primeira conta",
      body: "Qual conta você mais usa? Pode ser corrente, poupança ou carteira. Informe o saldo atual.",
      cta: "Criar conta", next: 2, action: () => openAccountModal()
    },
    {
      icon: "💳", title: "Tem cartão de crédito? (opcional)",
      body: "Cadastre seu principal cartão para acompanhar fatura, limite e vencimento.",
      cta: "Adicionar cartão", skip: "Pular", next: 3, action: () => openCardModal()
    },
    {
      icon: "🎯", title: "Defina uma meta",
      body: "Reserva de emergência, viagem, aposentadoria… Qual é seu próximo objetivo?",
      cta: "Criar meta", skip: "Pular", next: 4, action: () => openGoalModal()
    },
    {
      icon: "🚀", title: "Pronto!",
      body: "Seu Finance AI está configurado. Experimente a Conciliação para importar extratos e o Chat IA para perguntas.",
      cta: "Ir para o Dashboard", next: null
    }
  ];
  showOnboard(steps, 0);
}
function showOnboard(steps, idx) {
  document.getElementById("onboard-bd")?.remove();
  if (idx === null || idx >= steps.length) {
    localStorage.setItem("fa_v3_onboarded", "1");
    return;
  }
  const s = steps[idx];
  const bd = h("div", { class: "onboard-backdrop", id: "onboard-bd" },
    h("div", { class: "onboard-card" },
      h("div", { class: "onboard-steps" }, ...steps.map((_, i) => h("div", { class: i <= idx ? "done" : "" }))),
      h("div", { style: "font-size:56px; text-align:center; margin-bottom:10px" }, s.icon),
      h("h2", { style: "text-align:center; font-size:22px" }, s.title),
      h("p", { class: "text-muted mt-3", style: "text-align:center" }, s.body),
      h("div", { class: "flex gap-2 mt-4", style: "justify-content:center" },
        s.skip && h("button", { class: "btn btn-ghost", onClick: () => {
          bd.remove();
          showOnboard(steps, s.next);
        }}, s.skip),
        h("button", { class: "btn btn-gradient", onClick: () => {
          bd.remove();
          if (s.action) s.action();
          setTimeout(() => showOnboard(steps, s.next), s.action ? 800 : 0);
        }}, s.cta),
        idx === steps.length - 1 && h("button", { class: "btn btn-ghost", onClick: () => {
          localStorage.setItem("fa_v3_onboarded", "1");
          bd.remove();
          location.hash = "#/dashboard";
        }}, "Fechar")
      ),
      h("div", { class: "text-xs text-muted mt-3", style: "text-align:center" },
        h("a", { href: "#", onClick: (e) => { e.preventDefault(); localStorage.setItem("fa_v3_onboarded", "1"); bd.remove(); } }, "pular onboarding"))
    )
  );
  document.body.appendChild(bd);
}

/* ============ FAMILY ============ */
function renderFamily() {
  const wrap = h("div", {});
  wrap.append(pageHead("Família & Compartilhamento", "Um orçamento compartilhado com outros dispositivos e membros"));

  const ws = window.Cloud ? Cloud.info() : null;
  if (!ws) {
    wrap.append(h("div", { class: "card" },
      h("h3", {}, "🏠 Comece configurando o workspace compartilhado"),
      h("p", { class: "text-sm text-muted mb-3" },
        "Um workspace sincroniza os mesmos dados em todos os dispositivos (celular, desktop, tablet) e permite que outras pessoas entrem com o link compartilhado."),
      h("div", { class: "grid grid-2 gap-3" },
        h("div", { class: "card", style: "background:var(--bg-subtle)" },
          h("div", { class: "font-semi mb-2" }, "☁️ JSONBin (recomendado — sem cadastro)"),
          h("div", { class: "text-xs text-muted mb-3" },
            "Criação instantânea. Privado por default. Aguenta famílias pequenas."),
          h("button", { class: "btn btn-gradient w-full", onClick: async () => {
            try {
              await Cloud.initJsonbin({ key: null });
              Cloud.enableAutoSync();
              alert("✅ Workspace criado! Copie o link em Configurações e compartilhe.");
              navigate();
            } catch (e) { alert("Erro: " + e.message); }
          }}, "Criar workspace agora")
        ),
        h("div", { class: "card", style: "background:var(--bg-subtle)" },
          h("div", { class: "font-semi mb-2" }, "🐙 GitHub Gist (mais privacidade)"),
          h("div", { class: "text-xs text-muted mb-3" },
            "Dados em gist privado na sua conta GitHub. Requer Personal Access Token."),
          h("button", { class: "btn btn-outline w-full", onClick: async () => {
            const token = prompt("Personal Access Token (scope 'gist')\n\nGere em: https://github.com/settings/tokens");
            if (!token) return;
            try {
              await Cloud.initGist({ token });
              Cloud.enableAutoSync();
              alert("✅ Gist criado!");
              navigate();
            } catch (e) { alert("Erro: " + e.message); }
          }}, "Conectar GitHub")
        )
      ),
      h("div", { class: "card mt-3", style: "background:var(--bg-subtle)" },
        h("div", { class: "font-semi mb-2" }, "🔗 Já tem um workspace? Entre com o link"),
        h("div", { class: "text-xs text-muted mb-3" },
          "Cole o link fa://ws/... que outro membro da família enviou"),
        h("button", { class: "btn btn-primary", onClick: async () => {
          const link = prompt("Cole o link:");
          if (!link) return;
          try {
            await Cloud.joinWorkspace(link);
            Cloud.enableAutoSync();
            alert("✅ Conectado ao workspace!");
            location.reload();
          } catch (e) { alert("Erro: " + e.message); }
        }}, "Entrar com link"))
    ));
    return wrap;
  }

  // Workspace ativo
  const link = Cloud.shareLink();
  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Status", "Conectado",
      h("div", { class: "delta pos" }, `via ${ws.provider === "jsonbin" ? "JSONBin" : "GitHub Gist"}`), true),
    kpiCard("Última sincronização",
      ws.last_sync_at ? new Date(ws.last_sync_at).toLocaleString("pt-BR").slice(0, 17) : "—"),
    kpiCard("Sync automático", "5 min",
      h("div", { class: "delta" }, "Mudanças enviadas em background"))
  ));

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "🔗 Link para convidar família"),
    h("p", { class: "text-xs text-muted mb-2" },
      "Qualquer pessoa com este link verá os mesmos dados. Envie apenas para quem confia."),
    h("div", { class: "flex gap-2 mb-3" },
      h("input", { class: "input", value: link, readOnly: true, onClick: e => e.target.select() }),
      h("button", { class: "btn btn-primary", onClick: () => {
        navigator.clipboard?.writeText(link);
        alert("Link copiado para a área de transferência!");
      }}, "📋 Copiar"),
      h("button", { class: "btn btn-outline", onClick: () => {
        if (navigator.share) navigator.share({ title: "Finance AI — Workspace", text: "Entre no meu workspace de finanças:", url: link });
        else alert("Compartilhamento nativo não disponível. Copie o link.");
      }}, "📤 Compartilhar")
    ),
    h("div", { class: "grid grid-2 gap-3" },
      h("div", {},
        h("div", { class: "font-semi mb-2" }, "📱 Pareamento instantâneo por QR Code"),
        h("div", { class: "text-xs text-muted mb-2" }, "No celular, abra a câmera e aponte para o QR. O workspace conecta automaticamente."),
        h("canvas", { id: "ws-qrcode", style: "max-width:220px; border:1px solid var(--border); border-radius:10px; background:white; padding:8px" })
      ),
      h("div", {},
        h("div", { class: "font-semi mb-2" }, "🌐 Link web direto"),
        h("div", { class: "text-xs text-muted mb-2" }, "Este link abre o Finance AI e já conecta no workspace:"),
        h("input", { class: "input", value: location.origin + location.pathname + "?join=" + encodeURIComponent(link), readOnly: true, onClick: e => e.target.select() })
      )
    )
  ));

  setTimeout(() => {
    const joinUrl = location.origin + location.pathname + "?join=" + encodeURIComponent(link);
    const canvas = document.getElementById("ws-qrcode");
    if (canvas && window.QRCode) {
      QRCode.toCanvas(canvas, joinUrl, { width: 220, margin: 1, color: { dark: "#0f172a", light: "#ffffff" }});
    }
  }, 50);

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "⚡ Ações manuais"),
    h("div", { class: "flex gap-2" },
      h("button", { class: "btn btn-primary", onClick: async () => {
        try { const r = await Cloud.push(); alert(r.skipped ? "Nada para enviar — já sincronizado" : "✅ Enviado!"); navigate(); }
        catch (e) { alert("Erro: " + e.message); }
      }}, "⬆ Enviar agora"),
      h("button", { class: "btn btn-outline", onClick: async () => {
        if (!confirm("Isso substituirá seus dados locais pela versão da nuvem. Continuar?")) return;
        try { await Cloud.pull(); alert("✅ Baixado da nuvem!"); location.reload(); }
        catch (e) { alert("Erro: " + e.message); }
      }}, "⬇ Baixar agora"),
      h("button", { class: "btn btn-ghost", style: "color:var(--danger)", onClick: () => {
        if (confirm("Desconectar da nuvem? Dados locais permanecem.")) { Cloud.disconnect(); navigate(); }
      }}, "❌ Desconectar")
    )
  ));

  wrap.append(h("div", { class: "card" },
    h("h3", {}, "👥 Perfis neste dispositivo"),
    h("p", { class: "text-xs text-muted mb-3" },
      "Cada perfil tem dados próprios. Pai, mãe e filhos podem compartilhar o mesmo dispositivo com perfis separados."),
    h("div", { class: "list" }, ...Object.values(Store.db.users).map(u =>
      h("div", { class: "list-item" },
        h("div", { class: "avatar" }, "👤"),
        h("div", { class: "grow" },
          h("div", { class: "title" }, u.name, u.id === Store.currentUserId ? h("span", { class: "badge brand", style: "margin-left:8px" }, "atual") : null),
          h("div", { class: "sub" }, u.email)
        ),
        u.id !== Store.currentUserId && h("button", { class: "btn btn-outline text-xs", onClick: () => {
          Store._saveSession(u.id); location.reload();
        }}, "Trocar")
      )
    )),
    h("button", { class: "btn btn-gradient mt-3", onClick: () => { location.hash = "#/settings"; } },
      "+ Gerenciar perfis em Configurações")
  ));

  return wrap;
}

/* ============ NOTIF SECTION ============ */
function renderNotifSection() {
  const prefs = Store.data.settings.notifications || { bills: true, budgets: true, insights: true, goals: true };
  Store.data.settings.channels = Store.data.settings.channels || {};
  const ch = Store.data.settings.channels;
  const status = window.Notifs ? Notifs.status() : "—";

  const card = h("div", { class: "card mb-3" },
    h("h3", {}, "🔔 Notificações"),
    h("div", { class: "text-sm mb-3" },
      "Navegador: ", h("span", { class: `badge ${status === "Ativadas" ? "ok" : status === "Bloqueadas" ? "danger" : "warn"}` }, status)
    ),
    h("div", { class: "font-semi mb-2" }, "Tipos de alerta"),
    h("div", { class: "grid grid-2 mb-3" },
      notifToggle("bills", "Vencimento de cartões", prefs.bills),
      notifToggle("budgets", "Orçamentos 80% / 100%", prefs.budgets),
      notifToggle("insights", "Alertas críticos da IA", prefs.insights),
      notifToggle("goals", "Metas próximas ou atingidas", prefs.goals),
    ),
    h("div", { class: "flex gap-2 mb-4" },
      h("button", { class: "btn btn-primary", onClick: async () => {
        const ok = await Notifs.requestPermission();
        alert(ok ? "✅ Notificações ativadas" : "❌ Permissão negada. Ajuste no navegador.");
        navigate();
      }}, "Pedir permissão do navegador"),
      h("button", { class: "btn btn-outline", onClick: () => {
        Notifs.resetHistory();
        Notifs.scan();
        alert("Histórico limpo + varredura executada");
      }}, "Varredura manual"),
    ),

    // === Canais externos ===
    h("div", { class: "font-semi mb-2" }, "📲 Canais externos (opcional — múltiplos simultâneos)"),
    h("div", { class: "text-xs text-muted mb-3" },
      "Receba alertas no celular mesmo com o navegador fechado."),

    // WhatsApp
    channelCard("whatsapp", "💬 WhatsApp (via CallMeBot, grátis)",
      `Para ativar: 1) Salve <b>+34 644 52 65 22</b> como "CallMeBot". 2) Envie "<b>I allow callmebot to send me messages</b>" para este contato. 3) Aguarde resposta com sua APIKey. 4) Cole abaixo.`,
      ch.whatsapp, [
        { key: "phone", label: "Seu número (ex: +5511999999999)", placeholder: "+5511..." },
        { key: "apikey", label: "APIKey do CallMeBot", placeholder: "123456789" }
      ]),

    // Telegram
    channelCard("telegram", "✈️ Telegram Bot (100% grátis, oficial)",
      `Para ativar: 1) Abra @BotFather no Telegram. 2) <code>/newbot</code> e siga os passos. 3) Copie o token. 4) Fale "/start" com seu novo bot. 5) Acesse <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> no navegador e copie o <b>chat.id</b>. 6) Preencha abaixo.`,
      ch.telegram, [
        { key: "token", label: "Bot Token", placeholder: "123:ABC..." },
        { key: "chat_id", label: "Chat ID", placeholder: "123456789" }
      ]),

    // ntfy.sh
    channelCard("ntfy", "📱 ntfy.sh (app no celular)",
      `1) Instale o app "ntfy" (Android/iOS). 2) Crie um tópico único e difícil de adivinhar. 3) Subscreva no app. 4) Preencha abaixo.`,
      ch.ntfy, [
        { key: "topic", label: "Nome do tópico", placeholder: "minhas-financas-xyz123" }
      ]),

    // Discord/Slack Webhook
    channelCard("webhook", "🔗 Discord / Slack / Webhook genérico",
      `Cole a URL do webhook. Suporta Discord, Slack, IFTTT, Zapier, n8n.`,
      ch.webhook, [
        { key: "url", label: "URL do webhook", placeholder: "https://discord.com/api/webhooks/..." }
      ])
  );
  return card;
}
function notifToggle(key, label, checked) {
  return h("label", { class: "flex items-center gap-2 text-sm", style: "padding:8px; border:1px solid var(--border); border-radius:8px; cursor:pointer" },
    h("input", { type: "checkbox", checked: checked ? true : undefined, onChange: e => {
      Store.data.settings.notifications = Store.data.settings.notifications || {};
      Store.data.settings.notifications[key] = e.target.checked;
      Store._save();
    }}),
    label
  );
}
function channelCard(key, title, help, cfg, fields) {
  cfg = cfg || { enabled: false };
  const body = h("div", { class: "mt-3", style: "padding:12px; border:1px solid var(--border); border-radius:10px" },
    h("div", { class: "flex justify-between items-center mb-2" },
      h("div", { class: "font-semi" }, title),
      h("label", { class: "flex items-center gap-2 text-xs" },
        h("input", { type: "checkbox", checked: cfg.enabled ? true : undefined, onChange: e => {
          const c = Store.data.settings.channels[key] = Store.data.settings.channels[key] || {};
          c.enabled = e.target.checked;
          Store._save();
        }}),
        "Ativar"
      )
    ),
    h("div", { class: "text-xs text-muted mb-3", html: help }),
    ...fields.map(f => h("label", { class: "field", style: "margin-bottom:8px" },
      h("span", { class: "lbl" }, f.label),
      h("input", { class: "input", type: "text", placeholder: f.placeholder, value: cfg[f.key] || "",
        onChange: e => {
          const c = Store.data.settings.channels[key] = Store.data.settings.channels[key] || {};
          c[f.key] = e.target.value.trim();
          Store._save();
        }})
    )),
    h("button", { class: "btn btn-outline text-xs", onClick: async () => {
      try {
        await Notifs.testChannel(key);
        alert(`✅ Teste enviado via ${key}. Verifique o app.`);
      } catch (e) { alert("Erro: " + e.message); }
    }}, "🧪 Testar este canal")
  );
  return body;
}

/* ============ CLOUD SYNC SECTION ============ */
function renderCloudSection() {
  const ws = window.Cloud ? Cloud.info() : null;
  const card = h("div", { class: "card mb-3" },
    h("h3", {}, "☁️ Sync na nuvem + Família"));

  if (ws) {
    const link = Cloud.shareLink();
    card.append(
      h("div", { class: "text-sm mb-3" },
        "Conectado via ",
        h("span", { class: "badge brand" }, ws.provider === "jsonbin" ? "JSONBin" : "GitHub Gist"),
        " • última sync: ", ws.last_sync_at ? new Date(ws.last_sync_at).toLocaleString("pt-BR") : "—"
      ),
      h("label", { class: "field" },
        h("span", { class: "lbl" }, "Link para compartilhar (família/outros dispositivos)"),
        h("input", { class: "input", value: link, readOnly: true, onClick: e => e.target.select() })
      ),
      h("div", { class: "flex gap-2" },
        h("button", { class: "btn btn-primary", onClick: async () => {
          try { await Cloud.push(); alert("✅ Enviado para a nuvem"); navigate(); }
          catch (e) { alert("Erro: " + e.message); }
        }}, "⬆ Enviar agora"),
        h("button", { class: "btn btn-outline", onClick: async () => {
          try {
            await Cloud.pull();
            alert("✅ Baixado da nuvem");
            location.reload();
          } catch (e) { alert("Erro: " + e.message); }
        }}, "⬇ Baixar agora"),
        h("button", { class: "btn btn-ghost", style: "color:var(--danger)", onClick: () => {
          if (confirm("Desconectar da nuvem? Dados locais permanecem.")) { Cloud.disconnect(); navigate(); }
        }}, "Desconectar")
      )
    );
  } else {
    card.append(
      h("div", { class: "text-sm text-muted mb-3" },
        "Sincronize seus dados entre dispositivos (celular, desktop) e compartilhe com a família via link."
      ),
      h("div", { class: "grid grid-3 gap-2" },
        h("button", { class: "btn btn-gradient", onClick: async () => {
          const key = prompt("Master Key do JSONBin (opcional — deixe em branco se não tiver conta):") || null;
          try {
            await Cloud.initJsonbin({ key });
            Cloud.enableAutoSync();
            alert("✅ Workspace criado na nuvem. Use Settings para ver o link de compartilhamento.");
            navigate();
          } catch (e) { alert("Erro: " + e.message); }
        }}, "☁️ JSONBin (sem conta)"),
        h("button", { class: "btn btn-outline", onClick: async () => {
          const token = prompt("Personal Access Token do GitHub (scope 'gist'):\n\nGere em https://github.com/settings/tokens");
          if (!token) return;
          try {
            await Cloud.initGist({ token });
            Cloud.enableAutoSync();
            alert("✅ Gist privado criado. Dados sincronizados.");
            navigate();
          } catch (e) { alert("Erro: " + e.message); }
        }}, "🐙 GitHub Gist"),
        h("button", { class: "btn btn-outline", onClick: async () => {
          const link = prompt("Cole o link do workspace (fa://ws/...):");
          if (!link) return;
          try {
            await Cloud.joinWorkspace(link);
            Cloud.enableAutoSync();
            alert("✅ Conectado ao workspace compartilhado!");
            location.reload();
          } catch (e) { alert("Erro: " + e.message); }
        }}, "👨‍👩‍👧 Entrar com link")
      ),
      h("div", { class: "text-xs text-muted mt-3" },
        h("b", {}, "JSONBin:"), " grátis, criação instantânea, sem cadastro. ",
        h("b", {}, "GitHub Gist:"), " privado via token pessoal. ",
        h("b", {}, "Entrar com link:"), " use um link compartilhado por outro dispositivo/membro da família.")
    );
  }
  return card;
}

/* ============ BINDINGS GLOBAIS ============ */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    if (document.getElementById("app").classList.contains("active")) openSearch();
  }
});

// Mobile bar + notification button
setTimeout(() => {
  document.getElementById("menu-btn")?.addEventListener("click", () => {
    document.querySelector(".sidebar")?.classList.toggle("open");
  });
  document.getElementById("search-btn")?.addEventListener("click", openSearch);
  document.getElementById("notif-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (document.getElementById("notif-drawer")) closeNotifs();
    else openNotifs();
  });
}, 50);

// Hook on navigate to update dot and run onboarding
const _origNavigate = navigate;
window.navigate = function() { _origNavigate(); setTimeout(updateNotifDot, 50); };

// Hook enterApp
const _origEnter = enterApp;
window.enterApp = function() {
  _origEnter();
  setTimeout(() => {
    updateNotifDot();
    maybeOnboard();
    if (window.Notifs) Notifs.start();
    if (window.Cloud && Cloud.info()) Cloud.enableAutoSync();
  }, 150);
};

// Hook allocation in investments
const _origInv = renderInvestments;
window.renderInvestments = function() {
  const w = _origInv();
  const alloc = renderAllocation();
  if (alloc) {
    w.appendChild(alloc);
    setTimeout(() => {
      const ctx = document.getElementById("chart-alloc");
      if (!ctx) return;
      const inv = Store.investments();
      const byType = {};
      for (const i of inv) {
        const pos = i.quantity * i.current_price;
        byType[i.type] = (byType[i.type] || 0) + pos;
      }
      const colors = { renda_fixa: "#0ea5e9", acoes: "#10b981", fii: "#f59e0b", etf: "#8b5cf6", cripto: "#ef4444" };
      const labels = { renda_fixa: "Renda fixa", acoes: "Ações", fii: "FII", etf: "ETF", cripto: "Cripto" };
      if (App.charts.alloc) App.charts.alloc.destroy();
      App.charts.alloc = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: Object.keys(byType).map(t => labels[t] || t),
          datasets: [{ data: Object.values(byType), backgroundColor: Object.keys(byType).map(t => colors[t]) }]
        },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" }}}
      });
    }, 0);
  }
  return w;
};

// Add OFX to reconcile view
const _origReconcile = renderReconcile;
window.renderReconcile = function() {
  const w = _origReconcile();
  const card = w.querySelector(".card");
  if (card) {
    const ofxRow = h("div", { style: "margin-top:16px; padding-top:16px; border-top:1px solid var(--border)" },
      h("div", { class: "font-semi mb-2" }, "🏛️ Arquivo OFX (bancos brasileiros)"),
      h("div", { class: "text-xs text-muted mb-2" }, "Padrão OFX exportado pelo internet banking"),
      h("input", { type: "file", accept: ".ofx,.OFX", class: "input", onChange: e => handleOfx(e.target.files[0]) })
    );
    card.appendChild(ofxRow);
  }
  return w;
};

// Re-wire routes after hooks
Object.assign(routes.investments, { render: renderInvestments });
Object.assign(routes.reconcile, { render: renderReconcile });

boot();
