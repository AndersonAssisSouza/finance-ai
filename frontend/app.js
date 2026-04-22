/* Finance AI v3 — Aplicação principal
 * Router hash + views.
 */

const fmt = v => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/* Parser de valor BR: aceita "65215,79", "65.215,79", "R$ 65.215,79", "65215.79" */
const num = v => {
  if (typeof v === "number") return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    // Formato BR: 65.215,79 ou 65215,79
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.match(/,\d{3}/)) {
    // Formato EN: 65,215.79
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
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
  "recurrences": { title: "Recorrências", render: renderRecurrences, icon: "🔁" },
  "goals":       { title: "Metas",        render: renderGoals,      icon: "🎯" },
  "debts":       { title: "Dívidas",      render: renderDebts,      icon: "📉" },
  "investments": { title: "Investimentos", render: renderInvestments, icon: "📈" },
  "net-worth":   { title: "Patrimônio",   render: renderNetWorth,   icon: "💎" },
  "savings":     { title: "Economizar",   render: renderSavings,    icon: "💰" },
  "fire":        { title: "Investir & FIRE", render: renderFire,    icon: "🔥" },
  "automations": { title: "Automações",   render: renderAutomations, icon: "⚡" },
  "reports":     { title: "Relatórios",   render: renderReports,    icon: "📑" },
  "statements":  { title: "DRE & Balanço", render: renderStatements, icon: "📚" },
  "irpf":        { title: "IRPF",          render: renderIRPF,       icon: "📑" },
  "reconcile":   { title: "Conciliar",    render: renderReconcile,  icon: "🔄" },
  "family":      { title: "Família",      render: renderFamily,     icon: "👨‍👩‍👧" },
  "cost-centers":{ title: "Centros de Custo", render: renderCostCenters, icon: "🏢" },
  "chat":        { title: "Chat IA",      render: renderChat,       icon: "🤖" },
  "settings":    { title: "Configurações",render: renderSettings,   icon: "⚙️" },
  "import":      { title: "Importar dados", render: renderImportPage, icon: "📥" },
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

  // Materializa recorrências atrasadas
  try { Store.materializeRecurrences(); } catch (e) { console.warn("recurrences:", e); }

  // Pré-carrega cotações (se multi-moeda)
  if (window.FX) FX.preloadRates().catch(() => {});

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
  // Sempre abre no Dashboard ao carregar o app (em vez de restaurar URL anterior)
  // Exceção: se tiver ?join= pra pareamento de workspace, deixa passar
  const hasJoin = new URLSearchParams(location.search).has("join");
  if (!hasJoin) {
    if (location.hash !== "#/dashboard") {
      location.hash = "#/dashboard";
    } else {
      navigate();
    }
  } else {
    navigate();
  }
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
    navItem("recurrences"),
    h("div", { class: "nav-section" }, "Futuro"),
    navItem("goals"),
    navItem("debts"),
    navItem("investments"),
    navItem("fire"),
    h("div", { class: "nav-section" }, "Inteligência"),
    navItem("savings"),
    navItem("automations"),
    navItem("reports"),
    Store.isBusinessMode() && navItem("statements"),
    navItem("irpf"),
    navItem("reconcile"),
    navItem("family"),
    Store.isBusinessMode() && navItem("cost-centers"),
    navItem("chat"),
    h("div", { class: "nav-section" }, "Sistema"),
    navItem("import"),
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
      h("button", { class: "btn btn-gradient", onClick: () => openNewTx() }, "+ Transação")
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
    h("button", { class: "btn btn-gradient", onClick: () => openAccountModal() }, "+ Nova conta")
  ));

  const accs = Store.accounts();
  if (!accs.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🏦"), "Nenhuma conta. Crie uma para começar."));
    return wrap;
  }

  const grid = h("div", { class: "grid grid-3" });
  const baseCur = FX.userCurrency();
  for (const a of accs) {
    const bal = Store.accountBalance(a.id);
    const cur = a.currency || baseCur;
    const converted = cur !== baseCur ? FX.convertSync(bal, cur, baseCur) : null;
    grid.append(h("div", { class: "card" },
      h("div", { class: "flex items-center justify-between mb-2" },
        h("div", { class: "flex items-center gap-3" },
          h("div", { class: "avatar", style: `background:${a.color}20; color:${a.color}` }, a.icon),
          h("div", {},
            h("div", { class: "font-semi" }, a.name),
            h("div", { class: "text-xs text-muted" },
              accountTypeLabel(a.type), " • ", h("span", { class: "badge", style: "font-size:10px" }, cur))
          )
        ),
        h("button", { class: "btn btn-ghost btn-icon", onClick: () => openAccountModal(a) }, "⚙️")
      ),
      h("div", { class: "text-2xl font-bold mt-2" }, FX.format(bal, cur)),
      converted !== null && h("div", { class: "text-xs text-muted" }, "≈ ", FX.format(converted, baseCur)),
      h("div", { class: "text-xs text-muted" }, `Saldo inicial: ${FX.format(a.initial_balance, cur)}`),
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
    h("button", { class: "btn btn-gradient", onClick: () => openCardModal() }, "+ Novo cartão")
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
    h("button", { class: "btn btn-gradient", onClick: () => openNewTx() }, "+ Nova")
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
    h("button", { class: "btn btn-gradient", onClick: () => openBudgetModal() }, "+ Definir")
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
    h("button", { class: "btn btn-gradient", onClick: () => openGoalModal() }, "+ Nova meta")
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
    h("button", { class: "btn btn-gradient", onClick: () => openDebtModal() }, "+ Nova dívida")
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
    h("button", { class: "btn btn-outline", onClick: async () => {
      try {
        const n = await updateStockPrices();
        alert(`✅ ${n} ativo(s) com cotação atualizada`);
        navigate();
      } catch (e) { alert("Erro: " + e.message); }
    }}, "🔄 Atualizar cotações"),
    h("button", { class: "btn btn-gradient", onClick: () => openInvestmentModal() }, "+ Novo ativo")
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
          h("td", { style: "white-space:nowrap" },
            h("button", { class: "btn btn-ghost btn-icon", title: "Editar",
              onClick: () => openInvestmentModal(i) }, "⚙️"),
            h("button", { class: "btn btn-ghost btn-icon", title: "Excluir",
              onClick: () => { if (confirm("Excluir?")) { Store.deleteInvestment(i.id); navigate(); } }
            }, "✕"))
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

  const hasPluggyCreds = !!(localStorage.getItem("fa_pluggy_client_id") && localStorage.getItem("fa_pluggy_client_secret"));
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "📥 Importar extrato"),
    h("div", { class: "grid grid-4 gap-3 mb-3", style: "grid-template-columns:repeat(auto-fit,minmax(200px,1fr))" },
      h("div", { style: "border:1px solid var(--primary, #6366f1); border-radius:8px; padding:10px" },
        h("div", { class: "font-semi" }, "⚡ Pluggy direto ",
          h("span", { class: "text-xs", style: "background:var(--primary);color:#fff;padding:2px 6px;border-radius:4px;margin-left:4px" }, "RECOMENDADO")),
        h("div", { class: "text-xs text-muted mb-2" }, hasPluggyCreds ? "Credenciais configuradas no browser ✓" : "Sem backend. Credenciais no localStorage."),
        h("div", { class: "flex gap-2", style: "flex-wrap:wrap" },
          h("button", { class: "btn btn-gradient text-xs", onClick: () => openPluggyDirect(false) }, "Conectar banco"),
          h("button", { class: "btn btn-outline text-xs", onClick: () => openPluggyDirect(true), title: "Pluggy Bank — funciona em conta trial" }, "🧪 Sandbox"),
          hasPluggyCreds && h("button", { class: "btn btn-ghost text-xs", title: "Limpar credenciais do browser", onClick: () => {
            if (!confirm("Remover credenciais Pluggy deste navegador?")) return;
            localStorage.removeItem("fa_pluggy_client_id");
            localStorage.removeItem("fa_pluggy_client_secret");
            localStorage.removeItem("fa_pluggy_api_key");
            localStorage.removeItem("fa_pluggy_api_key_exp");
            navigate();
          }}, "🗑️")
        )
      ),
      h("div", {},
        h("div", { class: "font-semi" }, "CSV simples"),
        h("div", { class: "text-xs text-muted mb-2" }, "Formato: data,descrição,valor"),
        h("input", { type: "file", accept: ".csv", class: "input", onChange: e => handleCsv(e.target.files[0]) })
      ),
      h("div", {},
        h("div", { class: "font-semi" }, "JSON Pluggy"),
        h("div", { class: "text-xs text-muted mb-2" }, "Cole o resultado de /transactions"),
        h("button", { class: "btn btn-outline", onClick: () => openPluggyPaste() }, "Colar JSON")
      ),
      h("div", {},
        h("div", { class: "font-semi" }, "Backend Pluggy"),
        h("div", { class: "text-xs text-muted mb-2" }, "Requer backend rodando (localhost)"),
        h("div", { class: "flex gap-2", style: "flex-wrap:wrap" },
          h("button", { class: "btn btn-outline text-xs", onClick: () => openPluggyBackend(false) }, "Conectar"),
          h("button", { class: "btn btn-outline text-xs", onClick: () => openPluggyBackend(true) }, "🧪 Sandbox")
        )
      )
    ),
    h("div", { class: "text-xs text-muted" },
      "A conciliação detecta duplicatas (mesma descrição + valor em até 2 dias) e sugere categoria para transações novas."),
    h("div", { class: "text-xs text-muted mt-2", style: "border-left:3px solid var(--warn, #f59e0b); padding-left:8px" },
      h("b", {}, "⚠️ Conta Pluggy trial? "), "Só consegue conectar o conector ",
      h("b", {}, "Pluggy Bank (sandbox)"), ". Para bancos reais (Inter, Nubank, Itaú...), ",
      h("a", { href: "https://dashboard.pluggy.ai/applications", target: "_blank", class: "link" },
        "solicite acesso a dados reais"), " no dashboard Pluggy.")
  ));

  // Não-categorizadas
  const isEmptyDesc = d => {
    const s = (d || "").trim();
    return !s || /^[-._\s·•–—]+$/.test(s);
  };
  const uncat = Store.data.transactions.filter(t => !t.category_id);
  const explicitOther = Store.data.transactions.filter(t => t.category_id === "cat_other");
  const viewList = uncat.length ? uncat : explicitOther;
  if (uncat.length || explicitOther.length) {
    const suggestedCount = viewList.filter(t => {
      const s = AI.suggestCategory(t.description);
      return s && s !== t.category_id;
    }).length;
    const emptyDescCount = viewList.filter(t => isEmptyDesc(t.description)).length;
    wrap.append(h("div", { class: "card mb-3" },
      h("div", { class: "flex gap-2 items-center", style: "flex-wrap:wrap; justify-content:space-between" },
        h("h3", { style: "margin:0" },
          uncat.length
            ? `🏷️ ${uncat.length} transações sem categoria definida`
            : `📎 ${explicitOther.length} transações marcadas como "Outros"`
        ),
        h("div", { class: "flex gap-2", style: "flex-wrap:wrap" },
          h("button", { class: "btn btn-gradient text-xs", style: "background:linear-gradient(135deg,#8b5cf6,#6366f1)",
            title: "Pipeline completo: categoriza com IA + detecta duplicatas + marca ajustes de saldo",
            onClick: () => runSanitizePipeline(viewList)
          }, "🧹 Sanear tudo"),
          emptyDescCount > 0 && h("button", { class: "btn btn-outline text-xs", title: "Preenche descrições vazias com tipo e valor",
            onClick: () => {
              if (!confirm(`Preencher ${emptyDescCount} descrições vazias com "Transação <valor>"?`)) return;
              let applied = 0;
              for (const t of viewList) {
                if (!isEmptyDesc(t.description)) continue;
                const label = `${t.amount >= 0 ? "Recebimento" : "Pagamento"} R$ ${Math.abs(t.amount).toFixed(2)}`;
                Store.updateTransaction(t.id, { description: label });
                applied++;
              }
              alert(`✏️ ${applied} descrições preenchidas`);
              navigate();
            }
          }, `✏️ Preencher ${emptyDescCount} vazias`),
          emptyDescCount > 0 && h("button", { class: "btn btn-outline text-xs", style: "color:#ef4444; border-color:#ef4444",
            title: "Exclui permanentemente as transações sem descrição",
            onClick: () => {
              if (!confirm(`⚠️ EXCLUIR ${emptyDescCount} transações sem descrição?\n\nAção irreversível. Use se foram importadas por engano (ex: Pluggy sandbox).`)) return;
              if (!confirm(`Tem certeza? Isso vai remover ${emptyDescCount} transações do banco local.`)) return;
              const ids = viewList.filter(t => isEmptyDesc(t.description)).map(t => t.id);
              Store.data.transactions = Store.data.transactions.filter(t => !ids.includes(t.id));
              Store._save();
              alert(`🗑️ ${ids.length} transações excluídas`);
              navigate();
            }
          }, `🗑️ Excluir ${emptyDescCount} vazias`),
          suggestedCount > 0 && h("button", { class: "btn btn-gradient text-xs", onClick: () => {
            if (!confirm(`Aplicar categorização automática da IA em ${suggestedCount} transações?`)) return;
            let applied = 0;
            for (const t of viewList) {
              const sug = AI.suggestCategory(t.description);
              if (sug && sug !== t.category_id) { Store.updateTransaction(t.id, { category_id: sug }); applied++; }
            }
            alert(`✅ ${applied} transações categorizadas automaticamente`);
            navigate();
          }}, `🤖 Categorizar ${suggestedCount} com IA`)
        )
      ),
      emptyDescCount > 0 && h("div", { class: "text-xs", style: "color:var(--warn,#f59e0b); margin-top:6px" },
        `⚠️ ${emptyDescCount} transações sem descrição — clique no campo tracejado para preencher manualmente, ou use o botão ✏️ acima para preencher todas de uma vez.`),
      h("div", { class: "text-xs text-muted mt-2 mb-2" }, "Mostrando as 50 primeiras. Use o botão acima para aplicar a categorização em massa."),
      h("div", { class: "list scroll-y", style: "max-height:400px" }, ...(uncat.length ? uncat : explicitOther).slice(0, 50).map(t => {
        const suggestion = AI.suggestCategory(t.description);
        // Só considera sugestão se for DIFERENTE da categoria atual (evita "Aplicar Outros" em tx já em Outros)
        const suggestCat = (suggestion && suggestion !== t.category_id) ? Store.categoryById(suggestion) : null;
        const desc = (t.description || "").trim();
        // Considera descrição vazia também quando é só separadores/traços/pontos
        const emptyDesc = !desc || /^[-._\s·•–—]+$/.test(desc);
        return h("div", { class: "list-item" },
          h("div", { class: "avatar" }, emptyDesc ? "✏️" : "❓"),
          h("div", { class: "grow" },
            emptyDesc
              ? h("input", {
                  class: "input",
                  style: "padding:4px 8px; font-size:13px; background:transparent; border:1px dashed var(--border,#666)",
                  placeholder: "Sem descrição — clique e digite",
                  onBlur: (e) => {
                    const v = e.target.value.trim();
                    if (v) { Store.updateTransaction(t.id, { description: v }); navigate(); }
                  },
                  onKeyDown: (e) => { if (e.key === "Enter") e.target.blur(); }
                })
              : h("div", { class: "title" }, desc),
            h("div", { class: "sub" }, `${t.date} • ${fmt(t.amount)}${t.type ? " • " + t.type : ""}`)
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

/* Pipeline de saneamento: categoriza com IA + detecta duplicatas + identifica ajustes */
function runSanitizePipeline(uncatInitial) {
  const isEmptyDesc = d => { const s = (d || "").trim(); return !s || /^[-._\s·•–—]+$/.test(s); };

  // ETAPA 1: categorização automática (usa AI.suggestCategory expandido)
  let categorized = 0;
  for (const t of uncatInitial) {
    const sug = AI.suggestCategory(t.description);
    if (sug) { Store.updateTransaction(t.id, { category_id: sug }); categorized++; }
  }

  // ETAPA 2: detectar duplicatas em TODAS as transações (mesmo desc+amount+date+conta)
  const seen = new Map();
  const dupIds = [];
  for (const t of Store.data.transactions) {
    const k = `${t.date}|${(t.description||"").trim().toLowerCase()}|${t.amount}|${t.account_id||""}`;
    if (seen.has(k)) dupIds.push(t.id);
    else seen.set(k, t.id);
  }

  // ETAPA 3: identificar "Ajuste de Saldo" e similares (transações de reconciliação manual)
  const ajusteIds = Store.data.transactions.filter(t =>
    /^ajuste\s*(de)?\s*saldo\s*$/i.test((t.description||"").trim())
  ).map(t => t.id);

  // ETAPA 4: restantes ainda sem categoria (depois da etapa 1)
  const stillUncat = Store.data.transactions.filter(t =>
    (t.category_id === "cat_other" || !t.category_id) && !dupIds.includes(t.id) && !ajusteIds.includes(t.id)
  );

  // Relatório antes de qualquer exclusão
  const parts = [
    `📊 Relatório de saneamento\n`,
    `✅ Categorizadas pela IA: ${categorized}`,
    `🔁 Duplicatas detectadas: ${dupIds.length}`,
    `⚖️ "Ajuste de Saldo" encontrados: ${ajusteIds.length}`,
    `❓ Ainda sem categoria (manual): ${stillUncat.length}`,
    ``,
    `Deseja EXCLUIR as ${dupIds.length} duplicatas + ${ajusteIds.length} ajustes de saldo?`,
    `(As demais são mantidas para você revisar manualmente)`
  ];
  const deleteCount = dupIds.length + ajusteIds.length;

  if (deleteCount > 0 && confirm(parts.join("\n"))) {
    if (confirm(`⚠️ Confirma exclusão definitiva de ${deleteCount} transações?\nEssa ação é irreversível.`)) {
      const toDelete = new Set([...dupIds, ...ajusteIds]);
      Store.data.transactions = Store.data.transactions.filter(t => !toDelete.has(t.id));
      Store._save();
      alert(`🧹 Saneamento concluído!\n\n✅ ${categorized} categorizadas\n🗑️ ${toDelete.size} excluídas\n❓ ${stillUncat.length} para revisar manualmente`);
    } else {
      alert(`🧹 Categorização aplicada.\n\n✅ ${categorized} categorizadas\n❓ ${stillUncat.length + dupIds.length + ajusteIds.length} para revisar manualmente`);
    }
  } else {
    alert(`🧹 Categorização aplicada.\n\n✅ ${categorized} categorizadas\n❓ ${stillUncat.length + dupIds.length + ajusteIds.length} para revisar manualmente`);
  }
  navigate();
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
/* ============ Pluggy DIRETO (sem backend) — credenciais no localStorage ============ */
async function pluggyGetApiKey() {
  // Cache de 90min (token expira em 2h)
  const cached = localStorage.getItem("fa_pluggy_api_key");
  const exp = +localStorage.getItem("fa_pluggy_api_key_exp") || 0;
  if (cached && exp > Date.now()) return cached;

  let clientId = localStorage.getItem("fa_pluggy_client_id");
  let clientSecret = localStorage.getItem("fa_pluggy_client_secret");
  if (!clientId || !clientSecret) {
    clientId = prompt("Cole seu Pluggy Client ID:\n(obtenha em dashboard.pluggy.ai/applications)");
    if (!clientId) throw new Error("Client ID obrigatório");
    clientSecret = prompt("Cole seu Pluggy Client Secret:\n(fica salvo só no seu navegador)");
    if (!clientSecret) throw new Error("Client Secret obrigatório");
    localStorage.setItem("fa_pluggy_client_id", clientId.trim());
    localStorage.setItem("fa_pluggy_client_secret", clientSecret.trim());
  }

  const r = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    // Credenciais inválidas — limpa cache
    localStorage.removeItem("fa_pluggy_client_id");
    localStorage.removeItem("fa_pluggy_client_secret");
    throw new Error("Auth Pluggy falhou: " + (txt || r.status));
  }
  const { apiKey } = await r.json();
  localStorage.setItem("fa_pluggy_api_key", apiKey);
  localStorage.setItem("fa_pluggy_api_key_exp", String(Date.now() + 90 * 60 * 1000));
  return apiKey;
}
async function pluggyApi(path, apiKey, opts = {}) {
  const r = await fetch("https://api.pluggy.ai" + path, {
    ...opts,
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Pluggy ${path}: ${r.status} ${txt}`);
  }
  return r.json();
}
async function openPluggyDirect(sandboxOnly = false) {
  if (!window.PluggyConnect) return alert("Widget Pluggy não carregou. Verifique sua conexão e recarregue a página.");
  try {
    const apiKey = await pluggyGetApiKey();
    const ct = await pluggyApi("/connect_token", apiKey, {
      method: "POST",
      body: JSON.stringify({ options: { clientUserId: "finance-ai-browser" } })
    });
    const accessToken = ct.accessToken;

    const itemId = await new Promise((resolve, reject) => {
      const opts = {
        connectToken: accessToken,
        includeSandbox: true,
        onSuccess: (d) => resolve(d.item.id),
        onError: (err) => reject(err),
        onClose: () => reject(new Error("Widget fechado"))
      };
      if (sandboxOnly) {
        opts.connectorIds = [0, 1, 2];
        opts.countries = ["BR"];
      }
      const w = new PluggyConnect(opts);
      w.init();
    });

    // Busca contas e transações direto da API
    const accsRes = await pluggyApi(`/accounts?itemId=${encodeURIComponent(itemId)}`, apiKey);
    const pluggyAccs = accsRes.results || [];
    let allTx = [];
    for (const pa of pluggyAccs) {
      const txRes = await pluggyApi(`/transactions?accountId=${encodeURIComponent(pa.id)}&pageSize=500`, apiKey);
      allTx = allTx.concat(txRes.results || []);
    }

    const localAccs = Store.accounts();
    if (!localAccs.length) return alert("Crie pelo menos uma conta local antes de sincronizar.");
    const pick = prompt(
      `Pluggy retornou ${allTx.length} transações em ${pluggyAccs.length} conta(s).\n\n` +
      `Em qual conta local importar?\n` +
      localAccs.map((a, i) => `${i+1}. ${a.icon} ${a.name}`).join("\n"),
      "1"
    );
    const idx = (+pick || 1) - 1;
    const acc = localAccs[idx];
    if (!acc) return;

    const incoming = allTx.map(t => ({
      date: (t.date || "").slice(0, 10),
      description: t.description || t.descriptionRaw || "",
      amount: +t.amount,
      external_id: t.id
    }));
    const r = AI.reconcile(Store.data.transactions, incoming);
    for (const n of r.new) {
      Store.addTransaction({
        date: n.date, description: n.description, amount: n.amount,
        account_id: acc.id, category_id: n.suggested_category,
        type: n.amount >= 0 ? "income" : "expense"
      });
    }
    localStorage.setItem("fa_pluggy_last_item", itemId);
    alert(`✅ Importado: ${r.new.length} nova(s)\n🔁 Ignoradas (duplicatas): ${r.duplicates.length}`);
    navigate();
  } catch (e) {
    if (e?.message === "Widget fechado") return;
    const errStr = String(e?.code || e?.message || e);
    if (errStr.includes("TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED")) {
      const retry = confirm(
        "⚠️ Sua conta Pluggy está em modo TRIAL.\n\n" +
        "Contas trial só podem conectar o conector SANDBOX (Pluggy Bank).\n" +
        "Para bancos reais (Inter, Nubank, Itaú...), solicite acesso em:\n" +
        "dashboard.pluggy.ai/applications\n\n" +
        "Deseja testar agora com Pluggy Bank (sandbox)?"
      );
      if (retry) return openPluggyDirect(true);
      return;
    }
    alert("Erro Pluggy: " + errStr);
  }
}

async function openPluggyBackend(sandboxOnly = false) {
  const base = prompt("URL do backend Pluggy (rodando localmente):", localStorage.getItem("fa_pluggy_url") || "http://localhost:8000");
  if (!base) return;
  localStorage.setItem("fa_pluggy_url", base);

  // Opção 1: Connect Widget oficial do Pluggy (se disponível)
  const useWidget = window.PluggyConnect && confirm(
    (sandboxOnly ? "🧪 MODO SANDBOX — só conectores de teste (Pluggy Bank).\n\n" : "") +
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
        const widgetOpts = {
          connectToken: accessToken,
          includeSandbox: true,
          onSuccess: (itemData) => { resolve(itemData.item.id); },
          onError: (err) => reject(err),
          onClose: () => reject(new Error("Widget fechado"))
        };
        // Em modo sandbox, força apenas o conector Pluggy Bank (id 0 e 1 são sandbox)
        if (sandboxOnly) {
          widgetOpts.connectorIds = [0, 1, 2];
          widgetOpts.countries = ["BR"];
        }
        const widget = new PluggyConnect(widgetOpts);
        widget.init();
      });
    } catch (e) {
      if (e.message === "Widget fechado") return;
      // Trata erro específico de conta trial tentando conectar banco real
      const errCode = e?.code || e?.message || "";
      const errStr = String(errCode);
      if (errStr.includes("TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED")) {
        const retry = confirm(
          "⚠️ Sua conta Pluggy está em modo TRIAL.\n\n" +
          "Contas trial só podem conectar o conector SANDBOX (Pluggy Bank).\n" +
          "Para bancos reais (Inter, Nubank, Itaú...), solicite acesso a dados reais em:\n" +
          "dashboard.pluggy.ai/applications\n\n" +
          "Deseja tentar agora com Pluggy Bank (sandbox)?"
        );
        if (retry) return openPluggyBackend(true);
        return;
      }
      alert("Erro no Widget: " + errStr + "\n\nTentando fluxo manual...");
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

  const llmOn = window.LLM?.isConfigured();
  const greet = llmOn
    ? `Olá! Estou conectada ao ${window.LLM.PROVIDERS[window.LLM.loadConfig().provider]?.name || "LLM externo"} e tenho acesso ao seu contexto financeiro completo. Pergunte qualquer coisa!`
    : "Olá! Sou sua IA financeira. Posso responder sobre saldos, gastos, economia, investimentos, metas, assinaturas, dívidas e mais.\n\nTente: *\"Onde posso economizar?\"*\n\n💡 Ative um LLM externo em Configurações para respostas mais inteligentes.";
  addMsg("bot", greet);

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
  async function send() {
    const q = inputEl.value.trim(); if (!q) return;
    addMsg("user", q);
    inputEl.value = "";
    const thinking = h("div", { class: "chat-msg bot" }, "⏳ pensando...");
    msgsEl.appendChild(thinking); msgsEl.scrollTop = msgsEl.scrollHeight;
    try {
      const answer = window.LLM?.isConfigured()
        ? await window.LLM.ask(Store, q)
        : AI.chat(Store, q);
      thinking.remove();
      addMsg("bot", answer);
    } catch (err) {
      thinking.remove();
      addMsg("bot", `Erro: ${err.message}`);
    }
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

  // === MODO EMPRESARIAL ===
  const mode = Store.data.settings.mode || "personal";
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "💼 Modo de uso"),
    h("p", { class: "text-xs text-muted mb-3" },
      "Modo pessoal: finanças do dia a dia. Modo empresarial: centros de custo, DRE, segmentação por projeto/filial."),
    h("div", { class: "flex gap-2" },
      h("button", {
        class: "btn " + (mode === "personal" ? "btn-gradient" : "btn-outline"),
        onClick: () => { Store.setMode("personal"); navigate(); renderSidebar(); }
      }, "👤 Pessoal"),
      h("button", {
        class: "btn " + (mode === "business" ? "btn-gradient" : "btn-outline"),
        onClick: () => { Store.setMode("business"); navigate(); renderSidebar(); }
      }, "🏢 Empresarial")
    )
  ));

  // === MOEDA BASE ===
  wrap.append(renderCurrencySection());

  // === LLM EXTERNO ===
  wrap.append(renderLlmSection());

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
        h("input", { id: "tx-amt", class: "input", type: "text", inputmode: "decimal", step: ".01" })),
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
      const desc = $("#tx-desc").value, amt = num($("#tx-amt").value), date = $("#tx-date").value;
      if (!desc || !amt) return alert("Preencha descrição e valor");
      const payload = {
        date, description: desc,
        amount: t === "expense" ? -Math.abs(amt) : Math.abs(amt),
        account_id: $("#tx-acc").value,
        type: t,
        installments: num($("#tx-inst").value) || 1,
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
  const s = existing || { name: "", type: "checking", initial_balance: 0, currency: FX.userCurrency(), color: "#6366f1", icon: "🏦", include_in_net_worth: true };
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
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Moeda"),
        h("select", { id: "ac-currency", class: "select" },
          ...FX.SUPPORTED.map(c => h("option", { value: c.code, selected: c.code === (s.currency || FX.userCurrency()) }, `${c.symbol}  ${c.code}`))))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Saldo inicial"),
        h("input", { id: "ac-bal", class: "input", type: "text", inputmode: "decimal", step: ".01", value: s.initial_balance })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Ícone"),
        h("input", { id: "ac-icon", class: "input", value: s.icon }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Cor"),
      h("input", { id: "ac-color", class: "input", type: "color", value: s.color }))
  );
  openModal((existing ? "Editar" : "+ Nova") + " conta", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const data = {
        name: $("#ac-name").value, type: $("#ac-type").value,
        initial_balance: num($("#ac-bal").value), currency: $("#ac-currency").value,
        color: $("#ac-color").value, icon: $("#ac-icon").value, include_in_net_worth: true
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
        name: $("#ca-name").value, limit: num($("#ca-lim").value),
        closing_day: num($("#ca-close").value), due_day: num($("#ca-due").value),
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
      h("input", { id: "bu-amt", class: "input", type: "text", inputmode: "decimal", step: ".01" }))
  );
  openModal("Definir orçamento", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      Store.setBudget({
        month: $("#bu-month").value, category_id: $("#bu-cat").value,
        planned: num($("#bu-amt").value)
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
        name: $("#go-name").value, target_amount: num($("#go-target").value),
        current_amount: num($("#go-current").value), monthly_contribution: num($("#go-monthly").value),
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
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Juros mensal (%)"), h("input", { id: "de-rate", class: "input", type: "text", inputmode: "decimal", step: ".01", value: 1 })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Parcelas total"), h("input", { id: "de-total-inst", class: "input", type: "number" }))
    )
  );
  openModal("+ Nova dívida", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      Store.addDebt({
        name: $("#de-name").value, total_amount: num($("#de-total").value),
        balance: num($("#de-bal").value), interest_rate: num($("#de-rate").value),
        installments_total: num($("#de-total-inst").value) || null
      });
      closeModal(); navigate();
    }
  }]);
}

function openInvestmentModal(existing) {
  const s = existing || { name: "", ticker: "", type: "renda_fixa", quantity: 1, avg_price: "", current_price: "" };
  const typeOpt = (val, label) =>
    h("option", { value: val, selected: s.type === val }, label);

  const body = h("div", {},
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"),
        h("input", { id: "in-name", class: "input", value: s.name })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Ticker"),
        h("input", { id: "in-ticker", class: "input", value: s.ticker || "" }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Tipo"),
      h("select", { id: "in-type", class: "select" },
        typeOpt("renda_fixa", "Renda fixa"),
        typeOpt("acoes", "Ações"),
        typeOpt("fii", "FII"),
        typeOpt("etf", "ETF"),
        typeOpt("cripto", "Cripto")
      )
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Quantidade"),
        h("input", { id: "in-qty", class: "input", type: "number", step: ".0001", value: s.quantity })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Preço médio / Total aportado"),
        h("input", { id: "in-avg", class: "input", type: "text", inputmode: "decimal", value: s.avg_price }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Preço atual / Saldo"),
      h("input", { id: "in-cur", class: "input", type: "text", inputmode: "decimal", value: s.current_price }))
  );
  const title = existing ? "Editar investimento" : "+ Novo investimento";
  openModal(title, body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const data = {
        name: $("#in-name").value.trim(),
        ticker: $("#in-ticker").value.trim(),
        type: $("#in-type").value,
        quantity: num($("#in-qty").value) || 1,
        avg_price: num($("#in-avg").value),
        current_price: num($("#in-cur").value)
      };
      if (!data.name) return alert("⚠️ Informe o nome");
      if (!data.current_price) return alert("⚠️ Informe o preço atual / saldo");
      if (existing) Store.updateInvestment(existing.id, data);
      else Store.addInvestment(data);
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

  // Legenda de cores
  wrap.append(h("div", { class: "card" },
    h("div", { class: "flex gap-3 items-center text-xs", style: "flex-wrap:wrap" },
      h("span", { class: "font-semi" }, "Legenda:"),
      h("span", { class: "flex items-center gap-1" },
        h("span", { style: "width:10px;height:10px;background:rgba(16,185,129,.25);border-radius:2px;display:inline-block" }),
        " Entrada"),
      h("span", { class: "flex items-center gap-1" },
        h("span", { style: "width:10px;height:10px;background:rgba(239,68,68,.25);border-radius:2px;display:inline-block" }),
        " Saída"),
      h("span", { class: "flex items-center gap-1" },
        h("span", { style: "width:10px;height:10px;background:rgba(245,158,11,.25);border-radius:2px;display:inline-block" }),
        " 💳 Fatura cartão"),
      h("span", { class: "flex items-center gap-1" },
        h("span", { style: "width:10px;height:10px;border:1px dashed currentColor;border-radius:2px;display:inline-block" }),
        " 🔁 Recorrência prevista"),
      h("span", { class: "flex items-center gap-1" },
        h("span", { style: "width:10px;height:10px;border:2px solid var(--brand);border-radius:2px;display:inline-block" }),
        " Hoje")
    ),
    h("div", { style: "height:8px" }),
    grid
  ));

  // Próximos vencimentos (30 dias)
  wrap.append(renderUpcomingList());

  return wrap;
}

/** Lista "Próximos 30 dias" com vencimentos críticos destacados */
function renderUpcomingList() {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const hojeStr = hoje.toISOString().slice(0,10);
  const limiteDate = new Date(hoje); limiteDate.setDate(limiteDate.getDate() + 30);
  const limiteStr = limiteDate.toISOString().slice(0,10);

  const itens = [];

  // Transações futuras já lançadas (parcelamentos)
  for (const t of Store.data.transactions) {
    if (t.date > hojeStr && t.date <= limiteStr && t.type !== 'transfer') {
      itens.push({
        data: t.date,
        tipo: t.installment ? 'parcela' : 'lancamento',
        desc: t.description,
        valor: t.amount,
        icone: t.installment ? '🔢' : (t.amount < 0 ? '💸' : '💰')
      });
    }
  }

  // Faturas de cartão
  for (const c of Store.cards()) {
    const inv = Store.cardInvoice(c.id);
    if (inv.due_date > hojeStr && inv.due_date <= limiteStr && inv.total !== 0) {
      itens.push({
        data: inv.due_date,
        tipo: 'fatura',
        desc: `Fatura ${c.name}`,
        valor: -Math.abs(inv.total),
        icone: '💳',
        critico: true
      });
    }
  }

  // Recorrências previstas
  const previstas = Store.upcomingFromRecurrences(30);
  for (const u of previstas) {
    itens.push({
      data: u.date,
      tipo: 'recorrente',
      desc: u.description,
      valor: u.amount,
      icone: '🔁'
    });
  }

  itens.sort((a, b) => a.data.localeCompare(b.data));

  const totalSaidas = itens.filter(i => i.valor < 0).reduce((s, i) => s + Math.abs(i.valor), 0);
  const totalEntradas = itens.filter(i => i.valor > 0).reduce((s, i) => s + i.valor, 0);

  const wrap = h("div", { class: "card mt-3" },
    h("h3", {}, "📅 Próximos 30 dias — vencimentos e recorrências"),
    h("div", { class: "grid grid-3 mb-3" },
      kpiCard("Entradas previstas", fmt(totalEntradas),
        h("div", { class: "delta pos" }, `${itens.filter(i => i.valor > 0).length} item(ns)`)),
      kpiCard("Saídas previstas", fmt(totalSaidas),
        h("div", { class: "delta neg" }, `${itens.filter(i => i.valor < 0).length} item(ns)`)),
      kpiCard("Saldo previsto", fmt(totalEntradas - totalSaidas),
        h("div", { class: "delta" }, itens.length + " vencimentos"), true)
    )
  );

  if (!itens.length) {
    wrap.append(h("div", { class: "empty" }, "Nenhum vencimento nos próximos 30 dias."));
    return wrap;
  }

  // Agrupa por semana
  const byWeek = {};
  for (const i of itens) {
    const d = new Date(i.data);
    const diff = Math.floor((d - hoje) / 86400000);
    const wk = diff <= 7 ? 'Esta semana' : diff <= 14 ? 'Próxima semana' : diff <= 21 ? 'Em 2-3 semanas' : 'Em 3-4 semanas';
    (byWeek[wk] = byWeek[wk] || []).push(i);
  }

  for (const [semana, items] of Object.entries(byWeek)) {
    const total = items.reduce((s, i) => s + i.valor, 0);
    wrap.append(h("div", { class: "mt-3" },
      h("div", { class: "flex justify-between items-center mb-2" },
        h("div", { class: "font-semi text-sm" }, semana, " ",
          h("span", { class: "badge" }, items.length)),
        h("div", { class: "text-xs", style: `color:${total < 0 ? "var(--danger)" : "var(--success)"}` },
          total >= 0 ? "+" : "", fmt(total))
      ),
      h("div", { class: "list" }, ...items.map(i => {
        const valorAbs = Math.abs(i.valor);
        const destaque = valorAbs > 1000 || i.critico;
        return h("div", { class: "list-item", style: destaque ? "background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.3)" : "" },
          h("div", { class: "avatar" }, i.icone),
          h("div", { class: "grow" },
            h("div", { class: "title" }, i.desc,
              destaque ? h("span", { class: "badge danger", style: "margin-left:6px; font-size:10px" }, "ATENÇÃO") : null),
            h("div", { class: "sub" }, formatDayLabel(i.data), " • ", {
              parcela: "Parcela",
              lancamento: "Lançamento",
              fatura: "Fatura cartão",
              recorrente: "Recorrência"
            }[i.tipo] || i.tipo)
          ),
          h("div", { class: `right amt ${i.valor >= 0 ? "pos" : "neg"}` },
            (i.valor >= 0 ? "+" : "") + fmt(i.valor))
        );
      }))
    ));
  }

  return wrap;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = Math.floor((d - hoje) / 86400000);
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diaSem = dias[d.getDay()];
  const dataFormat = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  if (diff === 0) return `Hoje (${diaSem} ${dataFormat})`;
  if (diff === 1) return `Amanhã (${diaSem} ${dataFormat})`;
  if (diff < 7) return `Em ${diff}d (${diaSem} ${dataFormat})`;
  return `${diaSem} ${dataFormat}`;
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
  // recorrências previstas (futuras) neste dia
  const upcoming = (dStr > today)
    ? Store.upcomingFromRecurrences(120).filter(u => u.date === dStr)
    : [];

  // Calcula total do dia
  const total = txs.reduce((s, t) => s + t.amount, 0);
  // Detecta se é dia crítico (fatura ou soma > R$ 1000)
  const critico = billsToday.length > 0 || Math.abs(total) > 1000;

  const cell = h("div", {
    class: "cal-cell " + (isOther ? "other" : "") + (dStr === today ? " today" : "") + (critico && !isOther ? " critico" : ""),
    style: critico && !isOther ? "border-color: var(--warning); background: rgba(245,158,11,.05)" : "",
    onClick: () => { if (txs.length) { location.hash = `#/transactions?month=${dStr.slice(0,7)}`; } }},
    h("div", { class: "flex justify-between items-center" },
      h("div", { class: "cal-day" }, date.getDate()),
      txs.length > 0 && h("div", { class: "text-xs", style: `font-weight:600; color:${total >= 0 ? "var(--success)" : "var(--danger)"}` },
        total >= 0 ? "+" : "", fmtShort(Math.abs(total)))
    ),
    ...txs.slice(0, 3).map(t => h("div", {
      class: "cal-tx " + (t.amount > 0 ? "pos" : "neg"),
      title: t.description + " " + fmt(t.amount)
    }, (t.amount > 0 ? "+" : "") + fmtShort(Math.abs(t.amount)) + " " + t.description.slice(0, 12))),
    txs.length > 3 && h("div", { class: "text-xs text-muted" }, `+${txs.length - 3}`),
    ...billsToday.map(c => h("div", {
      class: "cal-tx bill",
      style: "background: rgba(245,158,11,.25) !important; border: 1px solid var(--warning); font-weight: 600",
      title: c.name + " vence hoje"
    }, "💳 " + c.name.slice(0, 10))),
    ...upcoming.slice(0, 2).map(u => h("div", {
      class: "cal-tx " + (u.amount > 0 ? "pos" : "neg"),
      style: "opacity:.55; border:1px dashed currentColor",
      title: "Previsto: " + u.description
    }, "🔁 " + u.description.slice(0, 10)))
  );
  return cell;
}

/* ============ REPORTS view ============ */
function renderReports() {
  const wrap = h("div", {});
  const year = new Date().getFullYear();
  wrap.append(pageHead("Relatórios", "Análises detalhadas da sua vida financeira",
    monthPicker(),
    h("button", { class: "btn btn-outline", onClick: async () => {
      const y = prompt("Ano do relatório:", year);
      if (y) {
        try { await downloadAnnualPdf(+y); }
        catch(e) { alert("Erro: " + e.message); }
      }
    }}, "📄 PDF anual")
  ));

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

/* ============ CURRENCY SECTION ============ */
function renderCurrencySection() {
  const base = FX.userCurrency();
  return h("div", { class: "card mb-3" },
    h("h3", {}, "💱 Moeda base e multi-moeda"),
    h("p", { class: "text-xs text-muted mb-3" },
      "Contas podem ter moedas diferentes. Os totais (patrimônio, dashboard) são convertidos para a moeda base."),
    h("div", { class: "flex gap-2 items-end mb-3" },
      h("label", { class: "field", style: "margin:0; flex:1" },
        h("span", { class: "lbl" }, "Moeda base"),
        h("select", { class: "select", onChange: e => {
          Store.data.settings.currency = e.target.value;
          Store._save();
          FX.preloadRates();
          alert("Moeda base alterada. Recarregue a página para recalcular os totais.");
        }},
          ...FX.SUPPORTED.map(c => h("option", { value: c.code, selected: c.code === base }, `${c.symbol}  ${c.name}`)))
      ),
      h("button", { class: "btn btn-outline", onClick: async () => {
        try {
          const data = await FX.fetchRates(base);
          alert(`✅ Cotações atualizadas (${data.source}, ${data.date})\n\nExemplos:\nUSD: ${FX.format(1/data.rates.USD, base)}\nEUR: ${FX.format(1/data.rates.EUR, base)}`);
        } catch (e) { alert("Erro: " + e.message); }
      }}, "🔄 Atualizar cotações")
    ),
    FX.isMultiCurrency() && h("div", { class: "badge info", style: "padding:10px; display:block" },
      `💡 Você tem contas em ${new Set(Store.accounts().map(a => a.currency || "BRL")).size} moedas diferentes. Patrimônio líquido é convertido automaticamente.`)
  );
}

/* ============ LLM SECTION ============ */
function renderLlmSection() {
  const cfg = window.LLM?.info();
  const card = h("div", { class: "card mb-3" },
    h("h3", {}, "🤖 Assistente IA avançado (LLM externo)"),
    h("p", { class: "text-xs text-muted mb-3" },
      "Opcional. Conecta o chat a um modelo externo (OpenAI, Claude, Groq) com contexto dos seus dados. Sua API key fica apenas neste navegador, nunca é enviada a terceiros exceto ao provedor escolhido.")
  );

  if (cfg) {
    const prov = window.LLM.PROVIDERS[cfg.provider];
    card.append(
      h("div", { class: "badge ok mb-3", style: "display:block; padding:10px" },
        `✅ Conectado via ${prov?.name || cfg.provider}${cfg.model ? ` • modelo: ${cfg.model}` : ""}`),
      h("div", { class: "flex gap-2" },
        h("button", { class: "btn btn-primary", onClick: async () => {
          try {
            const r = await window.LLM.ask(Store, "Dê uma análise rápida da minha situação financeira em 2 parágrafos.");
            alert("✅ Resposta:\n\n" + r.slice(0, 800));
          } catch (e) { alert("Erro: " + e.message); }
        }}, "🧪 Testar LLM"),
        h("button", { class: "btn btn-outline", onClick: () => {
          if (confirm("Desconectar e apagar API key?")) { window.LLM.disconnect(); navigate(); }
        }}, "Desconectar")
      )
    );
  } else {
    const providers = window.LLM?.PROVIDERS || {};
    const state = { provider: "groq", apiKey: "", model: "" };
    card.append(
      h("div", { class: "grid grid-2 gap-2 mb-3" },
        h("label", { class: "field", style: "margin:0" },
          h("span", { class: "lbl" }, "Provedor"),
          h("select", { id: "llm-provider", class: "select", onChange: e => {
            state.provider = e.target.value;
            document.getElementById("llm-help").innerHTML = llmHelpFor(state.provider);
            document.getElementById("llm-model").placeholder = providers[state.provider]?.defaultModel || "";
          }},
            ...Object.entries(providers).map(([k,p]) => h("option", { value: k, selected: k === state.provider }, p.name)))
        ),
        h("label", { class: "field", style: "margin:0" },
          h("span", { class: "lbl" }, "Modelo (opcional)"),
          h("input", { id: "llm-model", class: "input", placeholder: providers[state.provider].defaultModel })
        )
      ),
      h("label", { class: "field" },
        h("span", { class: "lbl" }, "API Key"),
        h("input", { id: "llm-apikey", class: "input", type: "password", placeholder: "sk-... ou sk-ant-..." })
      ),
      h("div", { id: "llm-help", class: "text-xs text-muted mb-3", html: llmHelpFor(state.provider) }),
      h("button", { class: "btn btn-gradient", onClick: () => {
        const apiKey = document.getElementById("llm-apikey").value.trim();
        if (!apiKey) return alert("Cole a API key");
        window.LLM.configure({
          provider: document.getElementById("llm-provider").value,
          apiKey,
          model: document.getElementById("llm-model").value.trim() || null
        });
        alert("✅ LLM configurado! O chat agora usa o modelo externo.");
        navigate();
      }}, "Conectar")
    );
  }
  return card;
}
function llmHelpFor(provider) {
  return {
    openai: `Crie uma API key em <a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--brand)">platform.openai.com/api-keys</a>. Custo: centavos por pergunta com GPT-4o-mini.`,
    anthropic: `Crie em <a href="https://console.anthropic.com/" target="_blank" style="color:var(--brand)">console.anthropic.com</a>. Claude Haiku custa aproximadamente $0.25 por 1M tokens.`,
    groq: `<b>🆓 100% gratuito.</b> Crie em <a href="https://console.groq.com/keys" target="_blank" style="color:var(--brand)">console.groq.com/keys</a>. Velocidade excelente com Llama 3.3 70B.`,
    custom: `Cole uma URL compatível OpenAI (Ollama local, LM Studio, LocalAI, vLLM…). Use campo "Endpoint" avançado.`
  }[provider] || "";
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

/* ============ STATEMENTS (DRE + Balanço) ============ */
function renderStatements() {
  const wrap = h("div", {});
  wrap.append(pageHead("DRE & Balanço Patrimonial", "Demonstrativos contábeis simplificados", monthPicker()));

  const month = App.currentMonth;
  const txs = Store.listTransactions({ month });
  const base = FX.userCurrency();

  // DRE
  const revenues = {};
  const expenses = {};
  for (const t of txs) {
    const cat = Store.categoryById(t.category_id);
    if (!cat) continue;
    if (t.amount > 0) revenues[cat.group] = (revenues[cat.group] || 0) + t.amount;
    else if (t.amount < 0) expenses[cat.group] = (expenses[cat.group] || 0) + Math.abs(t.amount);
  }
  const totalRev = Object.values(revenues).reduce((s,v) => s+v, 0);
  const totalExp = Object.values(expenses).reduce((s,v) => s+v, 0);
  const resultado = totalRev - totalExp;
  const margem = totalRev > 0 ? (resultado / totalRev * 100) : 0;

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "📈 DRE — Demonstração do Resultado"),
    h("div", { class: "table-wrap" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Conta"), h("th", { style: "text-align:right" }, "Valor"))),
        h("tbody", {},
          h("tr", { style: "background:rgba(16,185,129,.08)" },
            h("td", { class: "font-bold" }, "(+) RECEITAS"), h("td", { class: "font-bold", style: "text-align:right" }, fmt(totalRev))),
          ...Object.entries(revenues).map(([g,v]) => h("tr", {},
            h("td", { style: "padding-left:30px" }, g),
            h("td", { style: "text-align:right" }, fmt(v))
          )),
          h("tr", { style: "background:rgba(239,68,68,.08)" },
            h("td", { class: "font-bold" }, "(−) DESPESAS"), h("td", { class: "font-bold", style: "text-align:right" }, fmt(totalExp))),
          ...Object.entries(expenses).map(([g,v]) => h("tr", {},
            h("td", { style: "padding-left:30px" }, g),
            h("td", { style: "text-align:right" }, fmt(v))
          )),
          h("tr", { style: "background:var(--brand-grad); color:white" },
            h("td", { class: "font-bold" }, "(=) RESULTADO LÍQUIDO"),
            h("td", { class: "font-bold", style: "text-align:right" }, fmt(resultado))),
          h("tr", {},
            h("td", { class: "text-muted" }, "Margem líquida"),
            h("td", { class: "text-muted", style: "text-align:right" }, margem.toFixed(1) + "%"))
        )
      )
    )
  ));

  // Balanço Patrimonial
  const nw = Store.netWorth();
  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "⚖️ Balanço Patrimonial (posição atual)"),
    h("div", { class: "grid grid-2" },
      h("div", {},
        h("div", { class: "font-semi mb-2", style: "color:var(--success)" }, "ATIVO"),
        h("table", { class: "table" },
          h("tbody", {},
            balanceRow("Caixa e contas correntes", nw.breakdown.cash),
            balanceRow("Investimentos", nw.breakdown.investments),
            h("tr", { class: "font-bold" },
              h("td", {}, "Total do Ativo"),
              h("td", { style: "text-align:right" }, fmt(nw.assets))
            )
          )
        )
      ),
      h("div", {},
        h("div", { class: "font-semi mb-2", style: "color:var(--danger)" }, "PASSIVO + PATRIMÔNIO LÍQUIDO"),
        h("table", { class: "table" },
          h("tbody", {},
            balanceRow("Dívidas", nw.breakdown.debts),
            balanceRow("Cartões em aberto", nw.breakdown.cards_open),
            h("tr", {}, h("td", { class: "text-muted" }, "Passivo total"),
              h("td", { class: "text-muted", style: "text-align:right" }, fmt(nw.liabilities))),
            h("tr", { style: "background:var(--brand-grad); color:white" },
              h("td", { class: "font-bold" }, "Patrimônio Líquido"),
              h("td", { class: "font-bold", style: "text-align:right" }, fmt(nw.net))
            ),
            h("tr", { class: "font-bold" },
              h("td", {}, "Total Passivo + PL"),
              h("td", { style: "text-align:right" }, fmt(nw.net + nw.liabilities))
            )
          )
        )
      )
    ),
    h("div", { class: "text-xs text-muted mt-3" },
      `Expresso em ${base}. Todas as posições em outras moedas foram convertidas pela cotação mais recente.`)
  ));

  // Por centro de custo (se empresarial)
  if (Store.isBusinessMode() && Store.costCenters().length) {
    wrap.append(h("div", { class: "card" },
      h("h3", {}, "🏢 Resultado por Centro de Custo — " + monthLabel(month)),
      h("div", { class: "table-wrap" },
        h("table", { class: "table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Centro"), h("th", {}, "Receita"), h("th", {}, "Despesa"), h("th", {}, "Resultado"), h("th", {}, "Margem"))),
          h("tbody", {}, ...Store.costCenters().map(cc => {
            const ccTxs = txs.filter(t => t.cost_center_id === cc.id);
            const rev = ccTxs.filter(t => t.amount > 0).reduce((s,t) => s+t.amount, 0);
            const exp = Math.abs(ccTxs.filter(t => t.amount < 0).reduce((s,t) => s+t.amount, 0));
            const res = rev - exp;
            const mar = rev > 0 ? (res/rev*100) : 0;
            return h("tr", {},
              h("td", {}, cc.icon, " ", cc.name),
              h("td", { class: "amt pos" }, fmt(rev)),
              h("td", { class: "amt neg" }, fmt(exp)),
              h("td", { class: res >= 0 ? "amt pos font-semi" : "amt neg font-semi" }, fmt(res)),
              h("td", {}, mar.toFixed(1) + "%")
            );
          }))
        )
      )
    ));
  }
  return wrap;
}
function balanceRow(label, value) {
  return h("tr", {},
    h("td", {}, label),
    h("td", { style: "text-align:right" }, fmt(value))
  );
}

/* ============ IRPF ============ */
function renderIRPF() {
  const wrap = h("div", {});
  const currentYear = new Date().getFullYear();
  const year = App.irpfYear || currentYear - 1;
  wrap.append(pageHead("Assistente IRPF Completo", `Ano-base ${year} — Declaração ${year + 1}`,
    h("select", { class: "select", onChange: e => { App.irpfYear = +e.target.value; navigate(); }},
      ...[0,1,2,3].map(n => h("option", { value: currentYear - n, selected: (currentYear - n) === year }, currentYear - n))),
    h("button", { class: "btn btn-outline", onClick: () => exportIrpfCsv(year) }, "⬇ CSV"),
    h("button", { class: "btn btn-gradient", onClick: () => openIrpfSimulator(year) }, "🧮 Simular imposto")
  ));

  wrap.append(h("div", { class: "badge warn mb-3", style: "display:block; padding:10px" },
    "⚠️ Este relatório é uma referência. Confirme valores no informe de rendimentos oficial de cada fonte pagadora."));

  // Bens e direitos (contas + investimentos em 31/12)
  const base = FX.userCurrency();
  const accounts = Store.accounts();
  const investments = Store.investments();
  const debts = Store.debts();
  const nw = Store.netWorth();

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "📦 Bens e Direitos (posição em 31/12)"),
    h("div", { class: "table-wrap" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {},
          h("th", {}, "Código"), h("th", {}, "Descrição"), h("th", {}, "Tipo"), h("th", { style: "text-align:right" }, "Valor"))),
        h("tbody", {},
          ...accounts.map(a => h("tr", {},
            h("td", {}, a.type === "savings" ? "02" : "01"),
            h("td", {}, a.icon, " ", a.name, h("span", { class: "text-xs text-muted" }, " (CPF/CNPJ do banco)")),
            h("td", {}, a.type === "savings" ? "Poupança" : "Conta corrente"),
            h("td", { style: "text-align:right" }, fmt(Store.accountBalance(a.id)))
          )),
          ...investments.map(i => h("tr", {},
            h("td", {}, invCode(i.type)),
            h("td", {}, "📈 ", i.name, " (", i.ticker, ")"),
            h("td", {}, invTypeLabel(i.type)),
            h("td", { style: "text-align:right" }, fmt(i.quantity * i.current_price))
          )),
          h("tr", { class: "font-bold" },
            h("td", { colspan: 3 }, "TOTAL"),
            h("td", { style: "text-align:right" }, fmt(nw.assets))
          )
        )
      )
    )
  ));

  // Dívidas e Ônus
  if (debts.length) {
    wrap.append(h("div", { class: "card mb-3" },
      h("h3", {}, "📉 Dívidas e Ônus Reais"),
      h("div", { class: "table-wrap" },
        h("table", { class: "table" },
          h("thead", {}, h("tr", {},
            h("th", {}, "Código"), h("th", {}, "Descrição"), h("th", { style: "text-align:right" }, "Valor"))),
          h("tbody", {},
            ...debts.map(d => h("tr", {},
              h("td", {}, "11"),
              h("td", {}, d.name),
              h("td", { style: "text-align:right" }, fmt(d.balance))
            ))
          )
        )
      )
    ));
  }

  // Rendimentos tributáveis e isentos
  const yearTxs = Store.data.transactions.filter(t =>
    t.date && t.date.slice(0,4) === String(year) && t.amount > 0);

  const salarios = yearTxs.filter(t => t.category_id === "cat_salary").reduce((s,t) => s+t.amount, 0);
  const freelance = yearTxs.filter(t => t.category_id === "cat_freelance").reduce((s,t) => s+t.amount, 0);
  const rendimentos = yearTxs.filter(t => t.category_id === "cat_dividend").reduce((s,t) => s+t.amount, 0);
  const outros = yearTxs.filter(t => !["cat_salary","cat_freelance","cat_dividend","cat_transfer"].includes(t.category_id))
    .reduce((s,t) => s+t.amount, 0);

  wrap.append(h("div", { class: "grid grid-2 mb-3" },
    h("div", { class: "card" },
      h("h3", {}, "💰 Rendimentos Tributáveis"),
      h("table", { class: "table" },
        h("tbody", {},
          h("tr", {}, h("td", {}, "Salários (CLT)"), h("td", { style: "text-align:right" }, fmt(salarios))),
          h("tr", {}, h("td", {}, "Freelance / PJ"), h("td", { style: "text-align:right" }, fmt(freelance))),
          h("tr", {}, h("td", {}, "Aluguéis recebidos"), h("td", { style: "text-align:right" }, fmt(0))),
          h("tr", { class: "font-bold" },
            h("td", {}, "TOTAL"),
            h("td", { style: "text-align:right" }, fmt(salarios + freelance)))
        )
      )
    ),
    h("div", { class: "card" },
      h("h3", {}, "🟢 Rendimentos Isentos ou Tributados Exclusivamente na Fonte"),
      h("table", { class: "table" },
        h("tbody", {},
          h("tr", {}, h("td", {}, "Rendimentos poupança"), h("td", { style: "text-align:right" }, fmt(0))),
          h("tr", {}, h("td", {}, "Dividendos / JCP"), h("td", { style: "text-align:right" }, fmt(rendimentos))),
          h("tr", {}, h("td", {}, "FGTS / PIS / indenizações"), h("td", { style: "text-align:right" }, fmt(0))),
          h("tr", { class: "font-bold" },
            h("td", {}, "TOTAL"),
            h("td", { style: "text-align:right" }, fmt(rendimentos)))
        )
      )
    )
  ));

  // Quadro resumo
  wrap.append(h("div", { class: "card" },
    h("h3", {}, "📋 Resumo da Declaração"),
    h("div", { class: "grid grid-4" },
      kpiCard("Patrimônio em 31/12", fmt(nw.assets)),
      kpiCard("Passivos declaráveis", fmt(debts.reduce((s,d) => s+d.balance, 0))),
      kpiCard("Rendimentos tributáveis", fmt(salarios + freelance)),
      kpiCard("Rendimentos isentos", fmt(rendimentos))
    ),
    h("div", { class: "text-xs text-muted mt-3" },
      "Os códigos (01/02/...) referem-se à tabela oficial de Bens e Direitos da Receita Federal. Consulte informes das instituições para os valores exatos.")
  ));

  return wrap;
}
function invCode(type) {
  return { acoes: "31", fii: "73", etf: "74", renda_fixa: "04", cripto: "81" }[type] || "99";
}
function invTypeLabel(type) {
  return { acoes: "Ações", fii: "Fundo imobiliário", etf: "ETF", renda_fixa: "Renda fixa", cripto: "Criptoativo" }[type] || type;
}
function exportIrpfCsv(year) {
  const rows = [["Tipo","Descrição","Valor"]];
  Store.accounts().forEach(a => rows.push(["Conta", a.name, Store.accountBalance(a.id).toFixed(2)]));
  Store.investments().forEach(i => rows.push(["Investimento", `${i.name} (${i.ticker})`, (i.quantity * i.current_price).toFixed(2)]));
  Store.debts().forEach(d => rows.push(["Dívida", d.name, d.balance.toFixed(2)]));
  const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `finance-ai-irpf-${year}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ============ RECURRENCES VIEW ============ */
function renderRecurrences() {
  // Materializa automaticamente antes de mostrar
  const created = Store.materializeRecurrences();
  const wrap = h("div", {});

  wrap.append(pageHead("Recorrências", "Lançamentos automáticos — salário, aluguel, assinaturas, boletos fixos",
    h("button", { class: "btn btn-gradient", onClick: () => openRecurrenceModal() }, "+ Nova recorrência")));

  if (created > 0) {
    wrap.append(h("div", { class: "badge ok mb-3", style: "padding:10px; display:block" },
      `✅ ${created} lançamento(s) geradas automaticamente desde a última visita.`));
  }

  const recs = Store.recurrences();
  if (!recs.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🔁"),
      "Crie recorrências para automatizar lançamentos fixos (salário, aluguel, assinaturas)."));
    return wrap;
  }

  // KPIs
  const monthlyIn = recs.filter(r => r.active && r.template.amount > 0)
    .reduce((s,r) => s + r.template.amount, 0);
  const monthlyOut = Math.abs(recs.filter(r => r.active && r.template.amount < 0)
    .reduce((s,r) => s + r.template.amount, 0));
  wrap.append(h("div", { class: "grid grid-3 mb-3" },
    kpiCard("Receitas fixas/mês", fmt(monthlyIn),
      h("div", { class: "delta" }, `${recs.filter(r => r.template.amount > 0 && r.active).length} ativa(s)`)),
    kpiCard("Despesas fixas/mês", fmt(monthlyOut),
      h("div", { class: "delta" }, `${recs.filter(r => r.template.amount < 0 && r.active).length} ativa(s)`)),
    kpiCard("Saldo fixo/mês", fmt(monthlyIn - monthlyOut),
      h("div", { class: "delta" }, "Previsível mensal"), true)
  ));

  // Lista
  const card = h("div", { class: "card" });
  for (const r of recs) {
    const cat = Store.categoryById(r.template.category_id);
    const next = Store.nextOccurrences(r, null, 1)[0];
    card.append(h("div", { class: "list-item", style: "flex-direction:column; align-items:stretch" },
      h("div", { class: "flex items-center gap-3" },
        h("div", { class: "avatar", style: `background:${cat?.color || "#64748b"}20; color:${cat?.color || "#64748b"}` }, cat?.icon || "🔁"),
        h("div", { class: "grow" },
          h("div", { class: "title" }, r.template.description,
            !r.active && h("span", { class: "badge", style: "margin-left:6px" }, "pausada")),
          h("div", { class: "sub" },
            `${freqLabel(r)} • ${cat?.name || "—"}`,
            next && ` • próximo: ${next}`)
        ),
        h("div", { class: `right font-semi ${r.template.amount >= 0 ? "amt pos" : "amt neg"}` },
          fmt(r.template.amount)),
        h("button", { class: "btn btn-ghost btn-icon", title: r.active ? "Pausar" : "Ativar",
          onClick: () => { Store.updateRecurrence(r.id, { active: !r.active }); navigate(); } },
          r.active ? "⏸️" : "▶️"),
        h("button", { class: "btn btn-ghost btn-icon", title: "Editar",
          onClick: () => openRecurrenceModal(r) }, "⚙️"),
        h("button", { class: "btn btn-ghost btn-icon", title: "Excluir", style: "color:var(--danger)",
          onClick: () => {
            if (confirm(`Excluir "${r.template.description}"?\nTransações já geradas NÃO serão removidas.`))
              { Store.deleteRecurrence(r.id); navigate(); }
          } }, "✕")
      )
    ));
  }
  wrap.append(card);

  // Upcoming
  const upcoming = Store.upcomingFromRecurrences(60);
  if (upcoming.length) {
    wrap.append(h("div", { class: "card mt-3" },
      h("h3", {}, "📅 Próximos lançamentos previstos (60 dias)"),
      h("div", { class: "list" }, ...upcoming.slice(0, 15).map(u => {
        const cat = Store.categoryById(u.category_id);
        return h("div", { class: "list-item" },
          h("div", { class: "avatar", style: "opacity:.6" }, cat?.icon || "🔁"),
          h("div", { class: "grow" },
            h("div", { class: "title" }, u.description),
            h("div", { class: "sub" }, u.date + " • previsto")
          ),
          h("div", { class: `right ${u.amount >= 0 ? "amt pos" : "amt neg"}` }, fmt(u.amount))
        );
      }))
    ));
  }

  return wrap;
}
function freqLabel(r) {
  const days = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  return {
    daily: "Todo dia",
    weekly: `Semanal (${days[r.day] || "—"})`,
    monthly: `Mensal (dia ${r.day})`,
    yearly: `Anual`
  }[r.frequency] || r.frequency;
}
function openRecurrenceModal(existing) {
  const t = existing?.template || {};
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Descrição"),
      h("input", { id: "rc-desc", class: "input", value: t.description || "" })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Valor (negativo = despesa)"),
        h("input", { id: "rc-amt", class: "input", type: "text", inputmode: "decimal", step: ".01", value: t.amount || "" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Categoria"),
        selectCategory(t.category_id || "", null, "rc-cat"))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Conta"),
      selectAccount(t.account_id || "", () => {}, false, "rc-acc")),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Frequência"),
        h("select", { id: "rc-freq", class: "select" },
          h("option", { value: "monthly", selected: existing?.frequency === "monthly" || !existing }, "Mensal"),
          h("option", { value: "weekly", selected: existing?.frequency === "weekly" }, "Semanal"),
          h("option", { value: "daily", selected: existing?.frequency === "daily" }, "Diário"),
          h("option", { value: "yearly", selected: existing?.frequency === "yearly" }, "Anual")
        )),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Dia (1-31 / 0-6 se semanal)"),
        h("input", { id: "rc-day", class: "input", type: "number", value: existing?.day || new Date().getDate() }))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Início"),
        h("input", { id: "rc-start", class: "input", type: "date", value: existing?.start_date || new Date().toISOString().slice(0,10) })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Fim (opcional)"),
        h("input", { id: "rc-end", class: "input", type: "date", value: existing?.end_date || "" }))
    )
  );
  const saveRecurrence = () => {
    console.log("[REC] Click Salvar disparou");
    try {
      const descEl = document.getElementById("rc-desc");
      const amtEl = document.getElementById("rc-amt");
      const catEl = document.getElementById("rc-cat");
      const accEl = document.getElementById("rc-acc");
      const freqEl = document.getElementById("rc-freq");
      const dayEl = document.getElementById("rc-day");
      const startEl = document.getElementById("rc-start");
      const endEl = document.getElementById("rc-end");

      if (!descEl || !amtEl || !catEl || !accEl) {
        const faltando = [
          !descEl && "descrição",
          !amtEl && "valor",
          !catEl && "categoria",
          !accEl && "conta"
        ].filter(Boolean).join(", ");
        alert("❌ Elementos do formulário não encontrados: " + faltando + ". Recarregue a página (Ctrl+Shift+R).");
        return;
      }

      const desc = descEl.value.trim();
      const amt = num(amtEl.value);
      const cat = catEl.value;
      const acc = accEl.value;

      console.log("[REC] Valores:", { desc, amt, cat, acc });

      if (!desc) { alert("⚠️ Preencha a descrição."); return; }
      if (!amt || amt === 0) { alert("⚠️ Valor inválido. Use números como 15000 ou 1500,50. Negativo = despesa."); return; }
      if (!cat) { alert("⚠️ Selecione uma categoria. Se não há categorias, o import pode ter falhado."); return; }
      if (!acc) { alert("⚠️ Selecione uma conta. Se não há contas, crie uma primeiro em Contas."); return; }

      const payload = {
        template: {
          description: desc, amount: amt,
          category_id: cat, account_id: acc,
          type: amt >= 0 ? "income" : "expense"
        },
        frequency: freqEl?.value || "monthly",
        day: num(dayEl?.value) || 1,
        start_date: startEl?.value || new Date().toISOString().slice(0, 10),
        end_date: endEl?.value || null,
        active: true
      };
      console.log("[REC] Payload:", payload);

      if (existing) Store.updateRecurrence(existing.id, payload);
      else Store.addRecurrence(payload);

      console.log("[REC] Salvo OK. Total:", Store.recurrences().length);
      closeModal();
      navigate();
    } catch (err) {
      console.error("[REC] ERRO:", err);
      alert("❌ Erro ao salvar recorrência:\n\n" + err.message + "\n\nVeja detalhes no Console (F12).");
    }
  };

  openModal((existing ? "Editar" : "+ Nova") + " recorrência", body, [{
    label: "Salvar", class: "btn-gradient", onClick: saveRecurrence
  }]);
}

/* ============ COST CENTERS VIEW (modo empresarial) ============ */
function renderCostCenters() {
  const wrap = h("div", {});
  wrap.append(pageHead("Centros de Custo", "Agrupe transações por projeto, departamento ou unidade",
    h("button", { class: "btn btn-gradient", onClick: () => openCostCenterModal() }, "+ Novo")));

  const centers = Store.costCenters();
  if (!centers.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "🏢"),
      "Nenhum centro de custo. Crie um para segmentar despesas e receitas."));
    return wrap;
  }

  // DRE simplificada por centro
  const data = centers.map(c => {
    const txs = Store.data.transactions.filter(t => t.cost_center_id === c.id);
    const income = txs.filter(t => t.amount > 0).reduce((s,t) => s + t.amount, 0);
    const expense = Math.abs(txs.filter(t => t.amount < 0).reduce((s,t) => s + t.amount, 0));
    return { cc: c, income, expense, net: income - expense, count: txs.length };
  });

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "📊 DRE por centro de custo (total histórico)"),
    h("div", { class: "table-wrap" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {},
          h("th", {}, "Centro"), h("th", {}, "Transações"),
          h("th", {}, "Receitas"), h("th", {}, "Despesas"),
          h("th", {}, "Resultado"), h("th", {})
        )),
        h("tbody", {}, ...data.map(d => h("tr", {},
          h("td", {}, h("span", { style: `color:${d.cc.color}` }, d.cc.icon), " ", d.cc.name),
          h("td", {}, d.count),
          h("td", { class: "amt pos" }, fmt(d.income)),
          h("td", { class: "amt neg" }, fmt(d.expense)),
          h("td", { class: d.net >= 0 ? "amt pos font-semi" : "amt neg font-semi" }, fmt(d.net)),
          h("td", {},
            h("button", { class: "btn btn-ghost btn-icon", onClick: () => {
              if (confirm("Excluir centro? Transações mantém o histórico mas perdem o vínculo."))
                { Store.deleteCostCenter(d.cc.id); navigate(); }
            }}, "✕"))
        )))
      )
    )
  ));

  // Transações sem CC
  const uncategorized = Store.data.transactions.filter(t => !t.cost_center_id);
  if (uncategorized.length) {
    wrap.append(h("div", { class: "card" },
      h("h3", {}, `🏷️ ${uncategorized.length} transação(ões) sem centro de custo`),
      h("div", { class: "text-xs text-muted mb-3" }, "Atribua em massa um centro:"),
      h("div", { class: "flex gap-2 items-end" },
        h("div", { class: "grow" },
          h("div", { class: "text-xs text-muted mb-1" }, "Centro de custo"),
          h("select", { id: "bulk-cc", class: "select" },
            ...centers.map(c => h("option", { value: c.id }, c.icon + " " + c.name)))
        ),
        h("button", { class: "btn btn-primary", onClick: () => {
          const cc = $("#bulk-cc").value;
          uncategorized.forEach(t => t.cost_center_id = cc);
          Store._save();
          alert(`✅ ${uncategorized.length} transações atribuídas`);
          navigate();
        }}, "Aplicar em todas")
      )
    ));
  }

  return wrap;
}
function openCostCenterModal() {
  const body = h("div", {},
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Nome"),
      h("input", { id: "cc-name", class: "input", placeholder: "Ex: Matriz, Filial SP, Projeto X" })),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Ícone"),
        h("input", { id: "cc-icon", class: "input", value: "🏢" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Cor"),
        h("input", { id: "cc-color", class: "input", type: "color", value: "#6366f1" }))
    )
  );
  openModal("+ Novo centro de custo", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      Store.addCostCenter({
        name: $("#cc-name").value,
        icon: $("#cc-icon").value,
        color: $("#cc-color").value
      });
      closeModal(); navigate();
    }
  }]);
}

/* ============ OCR PDF IMPORT ============ */
async function handlePdfOcr(file) {
  if (!file) return;
  const accs = Store.accounts();
  if (!accs.length) return alert("Crie uma conta primeiro");
  const pick = prompt("Em qual conta importar?\n" + accs.map((a,i) => `${i+1}. ${a.icon} ${a.name}`).join("\n"), "1");
  const acc = accs[(+pick || 1) - 1];
  if (!acc) return;

  showOcrProgress("Carregando bibliotecas...");

  // Carrega pdf.js e Tesseract sob demanda
  await loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs", "module")
    .catch(() => loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js"));
  await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js");

  let pdfText = "";
  try {
    showOcrProgress("Extraindo texto do PDF...");
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
    if (pdfjsLib) {
      if (pdfjsLib.GlobalWorkerOptions)
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pdfText += content.items.map(it => it.str).join(" ") + "\n";
      }
    }
  } catch (e) {
    console.warn("pdf.js falhou, usando OCR:", e);
  }

  // Se texto extraído for pequeno, roda OCR
  if (pdfText.trim().length < 100 && window.Tesseract) {
    showOcrProgress("PDF scaneado — rodando OCR (pode demorar)...");
    try {
      const { createWorker } = window.Tesseract;
      const worker = await createWorker("por");
      const { data } = await worker.recognize(file);
      pdfText = data.text;
      await worker.terminate();
    } catch (e) { console.warn("OCR:", e); }
  }

  hideOcrProgress();
  if (!pdfText) return alert("Não foi possível extrair texto do PDF.");

  // Parser heurístico: linhas com data brasileira + valor
  const txs = parseStatementText(pdfText);
  if (!txs.length) {
    alert("Nenhuma transação detectada no PDF.\n\nTexto extraído:\n" + pdfText.slice(0, 500));
    return;
  }

  showOcrPreview(txs, acc);
}

function parseStatementText(text) {
  const out = [];
  // Regex: dd/mm[/yyyy] ... valor com -/+
  const lines = text.split(/\n|(?<=\d{2}\/\d{2}\/\d{2,4})/);
  const rx = /(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+([^\d-][^\n]*?)\s+(-?\d{1,3}(?:\.\d{3})*(?:,\d{2}))/g;
  const text2 = text.replace(/\s+/g, " ");
  let m;
  while ((m = rx.exec(text2)) !== null) {
    const [, dateRaw, desc, amtRaw] = m;
    const parts = dateRaw.split("/");
    const y = parts[2] ? (parts[2].length === 2 ? "20" + parts[2] : parts[2]) : new Date().getFullYear();
    const date = `${y}-${parts[1]}-${parts[0]}`;
    const amount = parseFloat(amtRaw.replace(/\./g, "").replace(",", "."));
    if (isNaN(amount) || Math.abs(amount) < 0.01) continue;
    out.push({ date, description: desc.trim().slice(0, 80), amount });
  }
  return out;
}

function showOcrProgress(msg) {
  let el = document.getElementById("ocr-progress");
  if (!el) {
    el = h("div", { id: "ocr-progress", class: "modal-backdrop" },
      h("div", { class: "modal", style: "text-align:center; padding:30px" },
        h("div", { style: "font-size:48px" }, "⏳"),
        h("div", { id: "ocr-msg", class: "font-semi mt-3" }, msg),
        h("div", { class: "text-xs text-muted mt-2" }, "Isso pode levar alguns segundos em PDFs grandes")
      )
    );
    document.body.appendChild(el);
  } else {
    document.getElementById("ocr-msg").textContent = msg;
  }
}
function hideOcrProgress() { document.getElementById("ocr-progress")?.remove(); }

function showOcrPreview(txs, acc) {
  const body = h("div", {},
    h("div", { class: "text-sm mb-3" },
      `${txs.length} transações detectadas para importar em `,
      h("b", {}, acc.icon, " ", acc.name)
    ),
    h("div", { class: "scroll-y", style: "max-height:400px" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Data"), h("th", {}, "Descrição"), h("th", {}, "Valor"))),
        h("tbody", {}, ...txs.map(t => h("tr", {},
          h("td", {}, t.date), h("td", {}, t.description),
          h("td", { class: t.amount >= 0 ? "amt pos" : "amt neg" }, fmt(t.amount))
        )))
      )
    )
  );
  openModal("Pré-visualização OCR", body, [{
    label: "Importar todas", class: "btn-gradient", onClick: () => {
      const r = AI.reconcile(Store.data.transactions, txs);
      for (const n of r.new) {
        Store.addTransaction({
          date: n.date, description: n.description, amount: n.amount,
          account_id: acc.id, category_id: n.suggested_category,
          type: n.amount >= 0 ? "income" : "expense"
        });
      }
      closeModal();
      alert(`✅ ${r.new.length} novas • 🔁 ${r.duplicates.length} duplicatas ignoradas`);
      navigate();
    }
  }]);
}

function loadScript(src, type = null) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const s = document.createElement("script");
    s.src = src; if (type) s.type = type;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ============ AUTOMATIONS VIEW ============ */
function renderAutomations() {
  const wrap = h("div", {});
  wrap.append(pageHead("Automações", "Regras \"quando X, fazer Y\" — automatize seu dinheiro",
    h("button", { class: "btn btn-gradient", onClick: () => openAutomationModal() }, "+ Nova automação")));

  const autos = Automations.list();

  // Templates sugeridos
  if (!autos.length) {
    wrap.append(h("div", { class: "card mb-3" },
      h("h3", {}, "✨ Templates rápidos"),
      h("p", { class: "text-xs text-muted mb-3" }, "Clique para criar regras prontas:"),
      h("div", { class: "grid grid-2 gap-2" },
        templateCard("💰", "Pagar-se primeiro", "Ao receber salário, transferir 20% para a reserva",
          () => templateSalary20()),
        templateCard("🛡️", "Reserva mínima", "Ao receber qualquer receita > R$ 1.000, aportar 10% na meta Reserva",
          () => templateEmergency()),
        templateCard("🔔", "Alerta gasto alto", "Notificar quando gastar mais de R$ 500 em uma transação",
          () => templateBigSpend()),
        templateCard("🏷️", "Auto-categorizar", "Toda vez que 'netflix' aparecer, categorizar como Streaming",
          () => templateAutoCat())
      )
    ));
  }

  if (!autos.length) {
    wrap.append(h("div", { class: "card empty" }, h("div", { class: "icon" }, "⚡"),
      "Crie automações ou use um template acima para começar."));
    return wrap;
  }

  const card = h("div", { class: "card" });
  for (const a of autos) {
    const lastRun = a.runs?.[0];
    card.append(h("div", { class: "list-item", style: "flex-direction:column; align-items:stretch" },
      h("div", { class: "flex items-center gap-3" },
        h("div", { class: "avatar", style: "background:rgba(99,102,241,.15); color:var(--brand)" }, "⚡"),
        h("div", { class: "grow" },
          h("div", { class: "title" }, a.name,
            !a.active && h("span", { class: "badge", style: "margin-left:6px" }, "pausada")),
          h("div", { class: "sub" },
            describeAutomation(a),
            lastRun && ` • último: ${new Date(lastRun.at).toLocaleDateString("pt-BR")}`
          )
        ),
        h("div", { class: "right text-xs text-muted" }, `${a.runs?.length || 0} exec.`),
        h("button", { class: "btn btn-ghost btn-icon", title: a.active ? "Pausar" : "Ativar",
          onClick: () => { Automations.update(a.id, { active: !a.active }); navigate(); } },
          a.active ? "⏸️" : "▶️"),
        h("button", { class: "btn btn-ghost btn-icon", title: "Excluir", style: "color:var(--danger)",
          onClick: () => {
            if (confirm("Excluir esta automação?"))
              { Automations.remove(a.id); navigate(); }
          } }, "✕")
      )
    ));
  }
  wrap.append(card);
  return wrap;
}
function templateCard(icon, title, desc, onClick) {
  return h("button", { class: "card", style: "text-align:left; cursor:pointer; background:var(--bg-subtle); border:1px solid var(--border)",
    onClick },
    h("div", { style: "font-size:24px" }, icon),
    h("div", { class: "font-semi mt-2" }, title),
    h("div", { class: "text-xs text-muted mt-1" }, desc)
  );
}
function templateSalary20() {
  const accs = Store.accounts();
  if (accs.length < 2) return alert("Crie pelo menos 2 contas antes.");
  const destId = prompt("ID da conta de destino? (veja os IDs em Contas)\n" +
    accs.map((a,i) => `${i+1}. ${a.name} (${a.id})`).join("\n"));
  if (!destId) return;
  Automations.add({
    name: "Pague-se primeiro (20% do salário)",
    trigger: { event: "tx_created", filters: [
      { field: "category_id", op: "equals", value: "cat_salary" },
      { field: "amount", op: "gt", value: 0 }
    ]},
    actions: [{ type: "transfer_to_account", params: { to_account_id: destId, percent_of_amount: 20, description: "Pague-se primeiro (auto)" }}]
  });
  navigate();
}
function templateEmergency() {
  const goals = Store.goals();
  if (!goals.length) return alert("Crie uma meta primeiro.");
  const g = goals.find(g => /reserva|emerg/i.test(g.name)) || goals[0];
  Automations.add({
    name: `10% de receitas > R$ 1000 → ${g.name}`,
    trigger: { event: "tx_created", filters: [
      { field: "type", op: "equals", value: "income" },
      { field: "amount", op: "gt", value: 1000 }
    ]},
    actions: [{ type: "contribute_goal", params: { goal_id: g.id, percent_of_amount: 10 }}]
  });
  navigate();
}
function templateBigSpend() {
  Automations.add({
    name: "Alerta de gasto > R$ 500",
    trigger: { event: "tx_created", filters: [
      { field: "abs_amount", op: "gt", value: 500 },
      { field: "type", op: "equals", value: "expense" }
    ]},
    actions: [{ type: "notify", params: { title: "💸 Gasto alto detectado", body: "Uma transação acima de R$ 500 foi registrada." }}]
  });
  navigate();
}
function templateAutoCat() {
  const keyword = prompt("Palavra-chave:", "netflix");
  if (!keyword) return;
  const cat = prompt("ID da categoria (ex: cat_streaming):", "cat_streaming");
  if (!cat) return;
  Automations.add({
    name: `Auto-categorizar "${keyword}"`,
    trigger: { event: "tx_created", filters: [
      { field: "description", op: "contains", value: keyword }
    ]},
    actions: [{ type: "set_category", params: { category_id: cat }}]
  });
  navigate();
}
function describeAutomation(a) {
  const filters = a.trigger?.filters || [];
  const filterText = filters.length
    ? filters.map(f => `${f.field} ${f.op} ${Array.isArray(f.value) ? f.value.join("-") : f.value}`).join(" E ")
    : "sem filtros";
  const actions = (a.actions || []).map(ac => ac.type).join(", ");
  return `Gatilho: ${a.trigger?.event || "?"} (${filterText}) → Ação: ${actions}`;
}

function openAutomationModal() {
  const body = h("div", {},
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "Nome da automação"),
      h("input", { id: "au-name", class: "input", placeholder: "Ex: Transferir 10% do salário" })
    ),
    h("div", { class: "font-semi mt-3 mb-2" }, "Quando"),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Evento"),
        h("select", { id: "au-event", class: "select" },
          h("option", { value: "tx_created" }, "Transação criada"),
          h("option", { value: "daily" }, "Diariamente")
        )),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Campo do filtro"),
        h("select", { id: "au-field", class: "select" },
          h("option", { value: "description" }, "Descrição"),
          h("option", { value: "amount" }, "Valor"),
          h("option", { value: "abs_amount" }, "Valor absoluto"),
          h("option", { value: "type" }, "Tipo (income/expense)"),
          h("option", { value: "category_id" }, "Categoria (id)"),
        ))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Operador"),
        h("select", { id: "au-op", class: "select" },
          h("option", { value: "contains" }, "contém"),
          h("option", { value: "equals" }, "igual"),
          h("option", { value: "not_equals" }, "diferente"),
          h("option", { value: "gt" }, "maior que"),
          h("option", { value: "gte" }, "maior ou igual"),
          h("option", { value: "lt" }, "menor que"),
          h("option", { value: "lte" }, "menor ou igual")
        )),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Valor"),
        h("input", { id: "au-value", class: "input", placeholder: "ex: 1000" }))
    ),
    h("div", { class: "font-semi mt-3 mb-2" }, "Então fazer"),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Ação"),
      h("select", { id: "au-action", class: "select" },
        h("option", { value: "notify" }, "Notificar"),
        h("option", { value: "transfer_to_account" }, "Transferir para conta"),
        h("option", { value: "contribute_goal" }, "Aportar em meta"),
        h("option", { value: "set_category" }, "Definir categoria"),
        h("option", { value: "set_cost_center" }, "Definir centro de custo")
      )),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Param chave"),
        h("input", { id: "au-pkey", class: "input", placeholder: "ex: goal_id, to_account_id, category_id" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Param valor"),
        h("input", { id: "au-pvalue", class: "input", placeholder: "ex: gol_abc123 ou 20" }))
    ),
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "% do valor (opcional — 20 = 20% do valor da transação)"),
      h("input", { id: "au-percent", class: "input", type: "number", min: 0, max: 100, step: 1 }))
  );
  openModal("+ Nova automação", body, [{
    label: "Salvar", class: "btn-gradient", onClick: () => {
      const name = $("#au-name").value.trim();
      if (!name) return alert("Informe um nome");
      const value = $("#au-value").value;
      const parsedValue = /^-?\d+(\.\d+)?$/.test(value) ? +value : value;
      const params = {};
      if ($("#au-pkey").value) params[$("#au-pkey").value] = $("#au-pvalue").value;
      if ($("#au-percent").value) params.percent_of_amount = num($("#au-percent").value);

      Automations.add({
        name,
        trigger: {
          event: $("#au-event").value,
          filters: $("#au-field").value ? [
            { field: $("#au-field").value, op: $("#au-op").value, value: parsedValue }
          ] : []
        },
        actions: [{ type: $("#au-action").value, params }]
      });
      closeModal();
      navigate();
    }
  }]);
}

/* ============ PDF ANNUAL REPORT ============ */
async function downloadAnnualPdf(year) {
  await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  await loadScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.1/dist/jspdf.plugin.autotable.min.js");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Capa
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255);
  doc.setFontSize(28); doc.text("Relatório Anual", 20, 30);
  doc.setFontSize(40); doc.text(String(year), 20, 50);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(`Finance AI • ${Store.user?.name || "—"}`, 20, 80);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 20, 88);

  // Resumo executivo
  const yearTxs = Store.data.transactions.filter(t => t.date?.slice(0,4) === String(year));
  const income = yearTxs.filter(t => t.amount > 0).reduce((s,t) => s+t.amount, 0);
  const expense = Math.abs(yearTxs.filter(t => t.amount < 0 && t.type !== "transfer").reduce((s,t) => s+t.amount, 0));
  const net = income - expense;
  const nw = Store.netWorth();

  doc.setFontSize(16); doc.text("Resumo executivo", 20, 110);
  doc.setFontSize(11);
  const summary = [
    ["Receita total",     fmt(income)],
    ["Despesa total",     fmt(expense)],
    ["Saldo do ano",      fmt(net)],
    ["Taxa de poupança", (income > 0 ? (net/income*100).toFixed(1) : 0) + "%"],
    ["Patrimônio atual",  fmt(nw.net)],
    ["Ativos",            fmt(nw.assets)],
    ["Passivos",          fmt(nw.liabilities)],
    ["Nº transações",     yearTxs.length],
  ];
  doc.autoTable({ startY: 115, body: summary, theme: "plain", styles: { fontSize: 10 }});

  // Página 2: fluxo mensal
  doc.addPage();
  doc.setFontSize(16); doc.text("Fluxo mensal", 20, 20);
  const months = [];
  for (let m = 0; m < 12; m++) {
    const mKey = `${year}-${String(m+1).padStart(2, "0")}`;
    const s = Store.monthSummary(mKey);
    months.push([
      new Date(year, m).toLocaleDateString("pt-BR", { month: "long" }),
      fmt(s.income), fmt(s.expense), fmt(s.net)
    ]);
  }
  doc.autoTable({
    startY: 25,
    head: [["Mês", "Receita", "Despesa", "Saldo"]],
    body: months,
    headStyles: { fillColor: [99, 102, 241] }
  });

  // Página 3: top categorias
  doc.addPage();
  doc.setFontSize(16); doc.text("Gastos por categoria", 20, 20);
  const byCat = {};
  for (const t of yearTxs.filter(x => x.amount < 0 && x.type !== "transfer")) {
    const cat = Store.categoryById(t.category_id);
    if (!cat) continue;
    byCat[cat.name] = (byCat[cat.name] || 0) + Math.abs(t.amount);
  }
  const rows = Object.entries(byCat).sort(([,a],[,b]) => b-a).map(([k,v]) => [k, fmt(v), (v/expense*100).toFixed(1)+"%"]);
  doc.autoTable({
    startY: 25,
    head: [["Categoria", "Total", "% do gasto"]],
    body: rows,
    headStyles: { fillColor: [239, 68, 68] }
  });

  // Página 4: metas
  const goals = Store.goals();
  if (goals.length) {
    doc.addPage();
    doc.setFontSize(16); doc.text("Metas", 20, 20);
    doc.autoTable({
      startY: 25,
      head: [["Meta", "Atual", "Alvo", "%", "Aporte mensal"]],
      body: goals.map(g => [
        g.name, fmt(g.current_amount), fmt(g.target_amount),
        (g.target_amount > 0 ? (g.current_amount/g.target_amount*100).toFixed(0) : 0) + "%",
        fmt(g.monthly_contribution)
      ]),
      headStyles: { fillColor: [16, 185, 129] }
    });
  }

  // Página 5: patrimônio
  doc.addPage();
  doc.setFontSize(16); doc.text("Composição do patrimônio (hoje)", 20, 20);
  doc.autoTable({
    startY: 25,
    head: [["Componente", "Valor"]],
    body: [
      ["Contas e carteiras", fmt(nw.breakdown.cash)],
      ["Investimentos",      fmt(nw.breakdown.investments)],
      ["Total de ativos",    fmt(nw.assets)],
      ["Dívidas",            fmt(nw.breakdown.debts)],
      ["Cartões em aberto",  fmt(nw.breakdown.cards_open)],
      ["Total de passivos",  fmt(nw.liabilities)],
      ["Patrimônio líquido", fmt(nw.net)],
    ],
    headStyles: { fillColor: [139, 92, 246] }
  });

  doc.save(`finance-ai-relatorio-${year}.pdf`);
}

/* ============ IRPF SIMULATOR ============ */
function openIrpfSimulator(year) {
  // Pré-preenche com dados reais
  const yearTxs = Store.data.transactions.filter(t => t.date?.slice(0,4) === String(year) && t.amount > 0);
  const salarios = yearTxs.filter(t => t.category_id === "cat_salary").reduce((s,t) => s+t.amount, 0);
  const freelance = yearTxs.filter(t => t.category_id === "cat_freelance").reduce((s,t) => s+t.amount, 0);
  const rend = salarios + freelance;
  const saudeTxs = Store.data.transactions.filter(t =>
    t.date?.slice(0,4) === String(year) && t.amount < 0 &&
    Store.categoryById(t.category_id)?.group === "Saúde");
  const saude = Math.abs(saudeTxs.reduce((s,t) => s+t.amount, 0));
  const eduTxs = Store.data.transactions.filter(t =>
    t.date?.slice(0,4) === String(year) && t.amount < 0 && t.category_id === "cat_education");
  const edu = Math.abs(eduTxs.reduce((s,t) => s+t.amount, 0));

  const body = h("div", {},
    h("div", { class: "badge info mb-3", style: "display:block; padding:10px" },
      "💡 Valores pré-preenchidos com base nos seus lançamentos. Ajuste conforme necessário."),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Rendimento tributável anual"),
      h("input", { id: "ir-rend", class: "input", type: "text", inputmode: "decimal", step: ".01", value: rend.toFixed(2) })),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "IR retido na fonte (total do ano)"),
      h("input", { id: "ir-retido", class: "input", type: "text", inputmode: "decimal", step: ".01", value: "0" })),
    h("div", { class: "font-semi mt-3 mb-2" }, "Deduções (modalidade completa)"),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Dependentes (qtde)"),
        h("input", { id: "ir-dep", class: "input", type: "number", min: 0, value: "0" })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Previdência Oficial (INSS+PGBL)"),
        h("input", { id: "ir-prev", class: "input", type: "text", inputmode: "decimal", step: ".01", value: "0" }))
    ),
    h("div", { class: "field-row" },
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Saúde (sem teto)"),
        h("input", { id: "ir-saude", class: "input", type: "text", inputmode: "decimal", step: ".01", value: saude.toFixed(2) })),
      h("label", { class: "field" }, h("span", { class: "lbl" }, "Educação (teto R$ 3.561 por pessoa)"),
        h("input", { id: "ir-edu", class: "input", type: "text", inputmode: "decimal", step: ".01", value: edu.toFixed(2) }))
    ),
    h("label", { class: "field" }, h("span", { class: "lbl" }, "Pensão alimentícia judicial"),
      h("input", { id: "ir-pensao", class: "input", type: "text", inputmode: "decimal", step: ".01", value: "0" })),
    h("div", { id: "ir-result", class: "mt-3" })
  );

  openModal("Simulador IR — Ano-base " + year, body, [{
    label: "Calcular", class: "btn-gradient", onClick: () => {
      const input = {
        rendimentoTributavel: num($("#ir-rend").value) || 0,
        irretido: num($("#ir-retido").value) || 0,
        deducoes: {
          dependentes: num($("#ir-dep").value) || 0,
          previdencia: num($("#ir-prev").value) || 0,
          saude: num($("#ir-saude").value) || 0,
          educacao: num($("#ir-edu").value) || 0,
          pensao: num($("#ir-pensao").value) || 0
        }
      };
      const r = IRPFCalc.calcularDeclaracao(input);
      renderIrResult(r);
    }
  }]);

  function renderIrResult(r) {
    const el = document.getElementById("ir-result");
    el.innerHTML = "";
    el.appendChild(h("div", { class: "card" },
      h("div", { class: "flex items-center justify-between mb-3" },
        h("div", { class: "font-semi text-lg" }, r.saldo >= 0 ? "💚 Você tem restituição!" : "💸 Você tem imposto a pagar"),
        h("div", { class: "badge " + (r.escolhida === "simplificada" ? "info" : "brand") },
          `${r.escolhida} é melhor`)
      ),
      h("div", { class: "grid grid-2 mb-3" },
        h("div", { class: "kpi accent" },
          h("div", { class: "label" }, r.saldo >= 0 ? "Restituição" : "Imposto a pagar"),
          h("div", { class: "value" }, fmt(Math.abs(r.saldo))),
          h("div", { class: "delta" }, `Retido: ${fmt(r.retido)} | Devido: ${fmt(r.impostoDevido)}`)
        ),
        h("div", { class: "kpi" },
          h("div", { class: "label" }, "Alíquota efetiva"),
          h("div", { class: "value" }, r[r.escolhida].aliquotaEfetiva.toFixed(2) + "%")
        )
      ),
      h("h4", { style: "font-size:13px; margin-bottom:8px" }, "Comparação"),
      h("table", { class: "table" },
        h("tbody", {},
          h("tr", {},
            h("td", { class: "font-semi" }, "Simplificada"),
            h("td", {}, `Base: ${fmt(r.simplificada.base)}`),
            h("td", {}, `Imposto: ${fmt(r.simplificada.imposto)}`)),
          h("tr", {},
            h("td", { class: "font-semi" }, "Completa"),
            h("td", {}, `Base: ${fmt(r.completa.base)}`),
            h("td", {}, `Imposto: ${fmt(r.completa.imposto)}`))
        )
      ),
      h("div", { class: "text-xs text-muted mt-3" },
        "⚠️ Simulação baseada na tabela 2024. Para declarar oficialmente, use os dados do informe de rendimentos no programa da Receita Federal.")
    ));
  }
}

/* Injeção na view IRPF: adicionar ganho de capital */
function renderIRPFCapitalGains(year) {
  const gains = IRPFCalc.calcularGanhoCapital(Store.investments());
  if (!gains.length) return null;
  const totalLucro = gains.reduce((s,g) => s + g.lucro, 0);
  const totalImposto = gains.reduce((s,g) => s + g.imposto_potencial, 0);
  return h("div", { class: "card mb-3" },
    h("h3", {}, "📈 Ganho de Capital em Investimentos (potencial)"),
    h("div", { class: "text-xs text-muted mb-3" },
      "Valor potencial em caso de resgate total. Imposto só incide sobre venda. Ações: 15% isento até R$ 20k/mês. FIIs: 20%."),
    h("div", { class: "table-wrap" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {},
          h("th", {}, "Ativo"), h("th", {}, "Custo"), h("th", {}, "Valor atual"),
          h("th", {}, "Lucro"), h("th", {}, "Alíquota"), h("th", {}, "IR potencial"))),
        h("tbody", {}, ...gains.map(g => h("tr", {},
          h("td", {}, g.ticker),
          h("td", {}, fmt(g.custo)),
          h("td", {}, fmt(g.valor)),
          h("td", { class: g.lucro >= 0 ? "amt pos" : "amt neg" }, fmt(g.lucro)),
          h("td", {}, (g.aliquota * 100).toFixed(0) + "%"),
          h("td", {}, fmt(g.imposto_potencial))
        )),
        h("tr", { class: "font-bold" },
          h("td", { colspan: 3 }, "TOTAL"),
          h("td", { class: totalLucro >= 0 ? "amt pos" : "amt neg" }, fmt(totalLucro)),
          h("td", {}),
          h("td", {}, fmt(totalImposto))
        ))
      )
    )
  );
}

/* ============ CSV BULK MULTI-BANCO ============ */
async function handleCsvBulk(files) {
  if (!files || !files.length) return;
  const accs = Store.accounts();
  if (!accs.length) return alert("Crie uma conta primeiro");

  const pick = prompt(
    `${files.length} arquivo(s) selecionado(s).\n\nEm qual conta importar todos?\n` +
    accs.map((a,i) => `${i+1}. ${a.icon} ${a.name}`).join("\n"), "1");
  const acc = accs[(+pick || 1) - 1];
  if (!acc) return;

  showOcrProgress(`Processando ${files.length} arquivo(s)...`);
  const reports = await CSVParser.importBulk(Array.from(files), acc.id);
  hideOcrProgress();

  const body = h("div", {},
    h("div", { class: "text-sm mb-3" }, `Importação concluída em `, h("b", {}, acc.name)),
    h("div", { class: "table-wrap" },
      h("table", { class: "table" },
        h("thead", {}, h("tr", {},
          h("th", {}, "Arquivo"), h("th", {}, "Banco detectado"),
          h("th", {}, "Encontradas"), h("th", {}, "Novas"), h("th", {}, "Duplicadas"))),
        h("tbody", {}, ...reports.map(r => h("tr", {},
          h("td", {}, r.file),
          h("td", {}, r.error ? h("span", { class: "badge danger" }, "Erro") : r.format),
          h("td", {}, r.total || 0),
          h("td", { class: "amt pos" }, r.new || 0),
          h("td", { class: "text-muted" }, r.dup || 0)
        )))
      )
    )
  );
  openModal("Relatório de importação", body, [{
    label: "OK", class: "btn-gradient", onClick: () => { closeModal(); navigate(); }
  }]);
}

/* ============ BOT SECTION (Settings) ============ */
function renderBotSection() {
  const cfg = Store.data.settings?.channels?.telegram || {};
  const active = window.Bot?.isConfigured();
  return h("div", { class: "card mb-3" },
    h("h3", {}, "🤖 Bot bidirecional (Telegram)"),
    h("p", { class: "text-xs text-muted mb-3" },
      "Configure o Telegram em Notificações acima. Quando ativo, você pode ", h("b", {}, "enviar e receber mensagens"), ": gasto rápido, consulta de saldo, metas, etc."),
    active
      ? h("div", {},
          h("div", { class: "badge ok mb-3", style: "display:block; padding:10px" },
            "✅ Bot ativo. Mande /ajuda no seu bot Telegram para ver os comandos."),
          h("div", { class: "flex gap-2" },
            h("button", { class: "btn btn-primary", onClick: async () => {
              try {
                await Bot.sendMessage("🧪 Teste Finance AI bot bidirecional ativo! Envie /ajuda para comandos.");
                alert("✅ Mensagem enviada. Verifique seu Telegram.");
              } catch (e) { alert("Erro: " + e.message); }
            }}, "Testar envio"),
            h("button", { class: "btn btn-outline", onClick: async () => {
              await Bot.poll();
              alert("✅ Polling executado. Qualquer mensagem no bot foi processada.");
            }}, "Fazer polling agora")
          )
        )
      : h("div", { class: "badge warn", style: "display:block; padding:10px" },
          "⚠️ Configure o Telegram primeiro na seção Notificações."),

    h("div", { class: "mt-4 pt-3", style: "border-top:1px solid var(--border)" },
      h("h4", { style: "font-size:13px; margin-bottom:8px" }, "📱 WhatsApp envio rápido"),
      h("p", { class: "text-xs text-muted mb-2" },
        "Quer receber um resumo no seu WhatsApp agora? Cole seu número:"),
      h("div", { class: "flex gap-2" },
        h("input", { id: "wa-phone", class: "input", placeholder: "+5511999999999" }),
        h("button", { class: "btn btn-outline", onClick: () => {
          const phone = $("#wa-phone").value.trim();
          if (!phone) return;
          const m = Store.monthSummary();
          const nw = Store.netWorth();
          const msg = `*Finance AI*\n\nSaldo em contas: ${fmt(nw.breakdown.cash)}\nPatrimônio: ${fmt(nw.net)}\nReceita mês: ${fmt(m.income)}\nDespesa mês: ${fmt(m.expense)}`;
          window.open(Bot.whatsappSendLink(phone, msg), "_blank");
        }}, "📤 Abrir WhatsApp")
      )
    )
  );
}

/* ============ BRAPI - cotações de ações brasileiras ============ */
async function updateStockPrices() {
  const invs = Store.investments().filter(i => i.ticker && ["acoes","fii","etf"].includes(i.type));
  if (!invs.length) return alert("Nenhum ativo de renda variável com ticker cadastrado.");

  const tickers = [...new Set(invs.map(i => i.ticker.toUpperCase()))].join(",");
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${tickers}?range=1d&interval=1d`);
    if (!res.ok) throw new Error(await res.text());
    const j = await res.json();
    const results = j.results || [];
    let updated = 0;
    for (const r of results) {
      const price = r.regularMarketPrice || r.currentPrice;
      if (!price) continue;
      for (const i of invs) {
        if (i.ticker.toUpperCase() === r.symbol) {
          Store.updateInvestment(i.id, { current_price: +price });
          updated++;
        }
      }
    }
    return updated;
  } catch (e) {
    throw new Error("Brapi: " + e.message);
  }
}

/* ============ IMPORT PAGE (drag-and-drop JSON + Excel) ============ */
function renderImportPage() {
  const wrap = h("div", {});
  wrap.append(pageHead("📥 Importar / Exportar dados",
    "Suba arquivo Excel ou JSON. Baixe modelo ou exporte seus dados.",
    h("button", { class: "btn btn-gradient", onClick: downloadExcelTemplate }, "📄 Baixar modelo Excel"),
    h("button", { class: "btn btn-outline", onClick: exportExcelData }, "📊 Exportar dados como Excel")
  ));

  const dropArea = h("div", {
    id: "drop-area",
    style: `border:3px dashed var(--border); border-radius:16px; padding:60px 30px;
            text-align:center; background:var(--bg-subtle); cursor:pointer;
            transition:all .2s;`,
  },
    h("div", { style: "font-size:64px; margin-bottom:16px" }, "📁"),
    h("div", { class: "font-semi text-lg mb-2" }, "Arraste o arquivo aqui"),
    h("div", { class: "text-sm text-muted mb-4" }, "ou"),
    h("button", { class: "btn btn-gradient" }, "📎 Selecionar arquivo"),
    h("input", { type: "file", accept: ".json,.xlsx,.xls", id: "file-input", style: "display:none" }),
    h("div", { class: "text-xs text-muted mt-4" }, "Aceita .xlsx, .xls ou .json · máx 50 MB")
  );

  const previewArea = h("div", { id: "preview-area", class: "card mt-3 hidden" });

  wrap.append(dropArea, previewArea);

  wrap.append(h("div", { class: "card mt-3" },
    h("h3", {}, "📘 Como usar o Excel"),
    h("ol", { class: "text-sm", style: "line-height:1.8; padding-left:20px" },
      h("li", {}, h("b", {}, "Baixe o modelo Excel"), " no botão acima — vem com 5 abas e exemplos preenchidos"),
      h("li", {}, h("b", {}, "Preencha as abas:"),
        h("ul", { style: "padding-left:20px" },
          h("li", {}, h("code", {}, "Contas"), " — suas contas bancárias e carteira"),
          h("li", {}, h("code", {}, "Cartões"), " — cartões de crédito (limite, fechamento, vencimento)"),
          h("li", {}, h("code", {}, "Transações"), " — cada lançamento (data, descrição, valor, conta)"),
          h("li", {}, h("code", {}, "Metas"), " — objetivos financeiros"),
          h("li", {}, h("code", {}, "Recorrências"), " — lançamentos fixos mensais (salário, aluguel)"))),
      h("li", {}, h("b", {}, "Salve e arraste de volta"), " na área acima"),
      h("li", {}, h("b", {}, "Confira o preview"), " e confirme a importação")
    )
  ));

  // Drag handlers
  setTimeout(() => {
    const area = document.getElementById("drop-area");
    const input = document.getElementById("file-input");
    if (!area || !input) return;

    area.onclick = () => input.click();
    input.onchange = (e) => handleFile(e.target.files[0]);

    area.ondragover = (e) => { e.preventDefault(); area.style.borderColor = "var(--brand)"; area.style.background = "rgba(99,102,241,.08)"; };
    area.ondragleave = () => { area.style.borderColor = "var(--border)"; area.style.background = "var(--bg-subtle)"; };
    area.ondrop = (e) => {
      e.preventDefault();
      area.style.borderColor = "var(--border)"; area.style.background = "var(--bg-subtle)";
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    };
  }, 0);

  async function handleFile(file) {
    if (!file) return;
    const preview = document.getElementById("preview-area");
    preview.classList.remove("hidden");
    preview.innerHTML = "";
    preview.appendChild(h("div", { class: "text-sm" }, "⏳ Lendo ", h("b", {}, file.name), "..."));

    try {
      let data;
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "xlsx" || ext === "xls") {
        if (!window.XLSX) throw new Error("Biblioteca XLSX não carregou. Recarregue a página.");
        const buf = await file.arrayBuffer();
        data = parseExcelWorkbook(XLSX.read(buf, { type: "array", cellDates: true }));
      } else {
        const text = await file.text();
        data = JSON.parse(text);
      }

      const summary = {
        accounts: (data.accounts || []).length,
        cards: (data.cards || []).length,
        transactions: (data.transactions || []).length,
        goals: (data.goals || []).length,
        recurrences: (data.recurrences || []).length,
        categories: (data.categories || []).length,
      };

      preview.innerHTML = "";
      preview.appendChild(
        h("div", {},
          h("h3", {}, "📋 Pré-visualização do arquivo"),
          h("div", { class: "text-sm text-muted mb-3" }, "Arquivo: ", h("b", {}, file.name), ` (${(file.size/1024).toFixed(1)} KB)`),
          h("div", { class: "grid grid-3 mb-3" },
            kpiCard("Contas", summary.accounts),
            kpiCard("Cartões", summary.cards),
            kpiCard("Transações", summary.transactions, null, true),
          ),
          summary.goals + summary.recurrences + summary.categories > 0 && h("div", { class: "grid grid-3 mb-3" },
            kpiCard("Metas", summary.goals),
            kpiCard("Recorrências", summary.recurrences),
            kpiCard("Categorias", summary.categories)
          ),
          h("div", { class: "badge warn mb-3", style: "display:block; padding:12px" },
            "⚠️ A importação ", h("b", {}, "substituirá TODOS os dados atuais"),
            " do perfil em uso. Exporte um backup antes se quiser preservar algo."),
          h("div", { class: "flex gap-2" },
            h("button", { class: "btn btn-gradient", onClick: () => doImport(data) },
              "✅ Confirmar importação"),
            h("button", { class: "btn btn-outline", onClick: () => {
              preview.classList.add("hidden");
              document.getElementById("file-input").value = "";
            }}, "Cancelar"),
            h("button", { class: "btn btn-ghost", onClick: () => {
              const backup = Store.exportJson();
              const blob = new Blob([backup], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `backup-${new Date().toISOString().slice(0,10)}.json`;
              a.click();
            }}, "⬇ Backup atual antes"),
          )
        )
      );
    } catch (err) {
      preview.innerHTML = "";
      preview.appendChild(h("div", { class: "badge danger", style: "display:block; padding:14px" },
        "❌ Erro ao ler arquivo: ", err.message));
    }
  }

  function doImport(data) {
    try {
      if (!Store.currentUserId) {
        Store.register({ email: 'eu@finance.local', password: 'local', name: 'Eu' });
      }
      Store.db.data[Store.currentUserId] = {
        accounts: data.accounts || [],
        cards: data.cards || [],
        transactions: data.transactions || [],
        budgets: data.budgets || [],
        goals: data.goals || [],
        debts: data.debts || [],
        investments: data.investments || [],
        rules: data.rules || [],
        recurrences: data.recurrences || [],
        cost_centers: data.cost_centers || [],
        categories: data.categories && data.categories.length ? data.categories : undefined,
        alerts: [],
        tags: data.tags || [],
        automations: data.automations || [],
        settings: data.settings || { currency: 'BRL', theme: 'light', mode: 'personal' }
      };
      // se categorias vierem vazias, inicializa com default
      if (!Store.db.data[Store.currentUserId].categories) {
        Store.db.data[Store.currentUserId].categories = DEFAULT_CATEGORIES?.map(c => ({...c})) || [];
      }
      Store._save();
      alert(`✅ Importação concluída!\n\n` +
            `Contas: ${Store.accounts().length}\n` +
            `Cartões: ${Store.cards().length}\n` +
            `Transações: ${Store.data.transactions.length}\n` +
            `Metas: ${Store.goals().length}\n` +
            `Recorrências: ${Store.recurrences().length}`);
      location.hash = '#/dashboard';
      location.reload();
    } catch (err) {
      alert('❌ Erro na importação: ' + err.message);
      console.error(err);
    }
  }

  return wrap;
}

/* ============ EXCEL PARSER / GENERATOR ============ */
const ACCOUNT_TYPE_MAP = {
  "corrente": "checking", "conta corrente": "checking",
  "poupanca": "savings", "poupança": "savings",
  "carteira": "wallet", "dinheiro": "wallet",
  "investimento": "investment"
};
function normKey(s) { return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function toExcelDate(d) {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "number") {
    // Excel serial date
    const ms = (d - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return s;
}

function parseExcelWorkbook(wb) {
  const out = {
    accounts: [], cards: [], transactions: [], goals: [], recurrences: [],
    budgets: [], debts: [], investments: [], rules: [], cost_centers: [],
    categories: [], alerts: [], tags: [], automations: [],
    settings: { currency: "BRL", theme: "light", mode: "personal" }
  };
  const sheetNames = wb.SheetNames || [];
  const findSheet = (pattern) => sheetNames.find(n => new RegExp(pattern, "i").test(n));

  // === CONTAS ===
  const accSheet = findSheet("contas?|accounts");
  const accIdMap = {}; // nome → id
  if (accSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[accSheet], { defval: "" });
    for (const r of rows) {
      const name = r.Nome || r.nome || r.Name;
      if (!name) continue;
      const tipoRaw = normKey(r.Tipo || r.tipo || r.Type || "corrente");
      const id = "acc_" + (window.crypto?.randomUUID ? crypto.randomUUID().replace(/-/g,"").slice(0,12) : Math.random().toString(36).slice(2, 14));
      out.accounts.push({
        id, name: String(name).trim(),
        type: ACCOUNT_TYPE_MAP[tipoRaw] || "checking",
        initial_balance: num(r["Saldo inicial"] || r.saldo_inicial || 0),
        currency: (r.Moeda || r.moeda || "BRL").toString().trim().toUpperCase(),
        color: r.Cor || r.cor || "#6366f1",
        icon: r.Icone || r["Ícone"] || r.icon || "🏦",
        include_in_net_worth: true,
        created_at: new Date().toISOString()
      });
      accIdMap[normKey(name)] = id;
    }
  }

  // === CARTÕES ===
  const cardSheet = findSheet("cart[oõ]es?|cards");
  const cardIdMap = {};
  if (cardSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[cardSheet], { defval: "" });
    for (const r of rows) {
      const name = r.Nome || r.nome || r.Name;
      if (!name) continue;
      const id = "card_" + (window.crypto?.randomUUID ? crypto.randomUUID().replace(/-/g,"").slice(0,12) : Math.random().toString(36).slice(2, 14));
      const defAccName = normKey(r["Conta padrão"] || r["Conta padrao"] || r.conta || "");
      out.cards.push({
        id, name: String(name).trim(),
        limit: num(r.Limite || r.limite || 0),
        closing_day: +r["Dia fechamento"] || +r.fechamento || 1,
        due_day: +r["Dia vencimento"] || +r.vencimento || 10,
        color_start: r["Cor início"] || r.cor_inicio || "#6366f1",
        color_end: r["Cor fim"] || r.cor_fim || "#ec4899",
        icon: "💳",
        default_account_id: accIdMap[defAccName] || null,
        created_at: new Date().toISOString()
      });
      cardIdMap[normKey(name)] = id;
    }
  }

  // === TRANSAÇÕES ===
  const txSheet = findSheet("transa[cç][oõ]es?|transactions|lan[çc]amentos?");
  if (txSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[txSheet], { defval: "" });
    for (const r of rows) {
      const date = toExcelDate(r.Data || r.data || r.Date);
      const description = (r["Descrição"] || r.descricao || r.description || "").toString().trim();
      const value = num(r.Valor || r.valor || r.value || 0);
      if (!date || !description || value === 0) continue;

      const tipoRaw = normKey(r.Tipo || r.tipo || "");
      const type = tipoRaw === "receita" || tipoRaw === "income" || value > 0 ? "income"
                 : tipoRaw === "transferencia" || tipoRaw === "transfer" ? "transfer" : "expense";
      const amount = type === "expense" ? -Math.abs(value) : Math.abs(value);

      const accName = normKey(r.Conta || r.conta || r.Account || "");
      const cardName = normKey(r["Cartão"] || r.cartao || r.card || "");
      const account_id = accIdMap[accName] || null;
      const card_id = cardIdMap[cardName] || null;

      // Auto-categoriza se não especificado
      const catName = (r.Categoria || r.categoria || r.category || "").toString().trim();
      let category_id = catName;
      if (!catName.startsWith("cat_")) {
        // Tenta achar pelo nome
        category_id = autoCategorize(description) || "cat_other";
      }

      const tags = (r.Tags || r.tags || "").toString().split(",").map(s => s.trim()).filter(Boolean);

      out.transactions.push({
        id: "tx_" + Math.random().toString(36).slice(2, 14),
        date, description, amount, account_id, card_id, category_id, type,
        tags, notes: (r["Observações"] || r.obs || "").toString(),
        created_at: new Date().toISOString()
      });
    }
  }

  // === METAS ===
  const goalSheet = findSheet("metas?|goals");
  if (goalSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[goalSheet], { defval: "" });
    for (const r of rows) {
      const name = r.Nome || r.nome;
      if (!name) continue;
      out.goals.push({
        id: "gol_" + Math.random().toString(36).slice(2, 14),
        name: String(name).trim(),
        target_amount: num(r["Valor alvo"] || r.alvo || 0),
        current_amount: num(r["Valor atual"] || r.atual || 0),
        monthly_contribution: num(r["Aporte mensal"] || r.aporte || 0),
        deadline: toExcelDate(r["Data limite"] || r.deadline) || null,
        icon: r.Icone || r["Ícone"] || "🎯",
        color: r.Cor || r.cor || "#6366f1",
        created_at: new Date().toISOString()
      });
    }
  }

  // === RECORRÊNCIAS ===
  const recSheet = findSheet("recorr[eê]ncias?|recurrences");
  if (recSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[recSheet], { defval: "" });
    for (const r of rows) {
      const desc = r["Descrição"] || r.descricao;
      if (!desc) continue;
      const amount = num(r.Valor || r.valor || 0);
      const freqRaw = normKey(r["Frequência"] || r.frequencia || "mensal");
      const freq = { mensal: "monthly", monthly: "monthly", semanal: "weekly", weekly: "weekly", diaria: "daily", daily: "daily", anual: "yearly", yearly: "yearly" }[freqRaw] || "monthly";
      const accName = normKey(r.Conta || r.conta || "");
      const catName = (r.Categoria || r.categoria || "").toString().trim();
      let category_id = catName.startsWith("cat_") ? catName : (autoCategorize(desc) || (amount >= 0 ? "cat_other_in" : "cat_other"));

      out.recurrences.push({
        id: "rec_" + Math.random().toString(36).slice(2, 14),
        template: {
          description: String(desc).trim(),
          amount, category_id,
          account_id: accIdMap[accName] || null,
          type: amount >= 0 ? "income" : "expense"
        },
        frequency: freq,
        day: +r.Dia || +r.day || new Date().getDate(),
        start_date: toExcelDate(r["Data início"] || r.inicio || r.start_date) || new Date().toISOString().slice(0, 10),
        end_date: toExcelDate(r["Data fim"] || r.fim || r.end_date) || null,
        last_generated_date: null,
        active: true,
        created_at: new Date().toISOString()
      });
    }
  }

  return out;
}

/* ============ DOWNLOAD TEMPLATE EXCEL ============ */
function downloadExcelTemplate() {
  if (!window.XLSX) return alert("XLSX não carregou. Recarregue a página.");

  const wb = XLSX.utils.book_new();

  // Instruções
  const instr = [
    ["📘 FINANCE AI — MODELO DE IMPORTAÇÃO"],
    [""],
    ["COMO USAR:"],
    ["1. Preencha as abas abaixo com seus dados"],
    ["2. Salve o arquivo (.xlsx)"],
    ["3. No Finance AI, vá em Importar → arraste o arquivo"],
    [""],
    ["REGRAS:"],
    ["• Use VÍRGULA para decimais: 1.234,56 ou 1234,56"],
    ["• Datas: DD/MM/AAAA ou AAAA-MM-DD"],
    ["• Valores: positivos = receitas, negativos = despesas"],
    ["• Conta/Cartão: deve bater com o nome cadastrado na aba Contas/Cartões"],
    [""],
    ["ABAS:"],
    ["• Contas: bancos, poupança, carteira, investimentos"],
    ["• Cartões: cartões de crédito"],
    ["• Transações: lançamentos individuais"],
    ["• Metas: objetivos financeiros"],
    ["• Recorrências: lançamentos mensais fixos"],
    [""],
    ["DICA: Linhas de exemplo começam com '📌'. Apague-as antes de importar, ou deixe que serão ignoradas."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instr);
  wsInstr["!cols"] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

  // Contas
  const contas = [
    ["Nome", "Tipo", "Moeda", "Saldo inicial", "Cor", "Ícone"],
    ["📌 Banco Inter", "Corrente", "BRL", 0, "#ff7a00", "🏦"],
    ["📌 Nubank", "Corrente", "BRL", 0, "#820ad1", "💜"],
    ["📌 Carteira", "Dinheiro", "BRL", 0, "#10b981", "💵"],
    ["📌 Poupança Itaú", "Poupança", "BRL", 0, "#ec7000", "🐷"],
  ];
  const wsContas = XLSX.utils.aoa_to_sheet(contas);
  wsContas["!cols"] = [{wch:25}, {wch:12}, {wch:8}, {wch:14}, {wch:10}, {wch:8}];
  XLSX.utils.book_append_sheet(wb, wsContas, "Contas");

  // Cartões
  const cartoes = [
    ["Nome", "Limite", "Dia fechamento", "Dia vencimento", "Conta padrão", "Cor início", "Cor fim"],
    ["📌 Cartão Inter Pessoal", 18810, 1, 5, "Banco Inter", "#ff7a00", "#dc2626"],
    ["📌 Cartão Nubank", 5000, 25, 5, "Nubank", "#820ad1", "#ec4899"],
  ];
  const wsCards = XLSX.utils.aoa_to_sheet(cartoes);
  wsCards["!cols"] = [{wch:28}, {wch:10}, {wch:16}, {wch:16}, {wch:18}, {wch:12}, {wch:10}];
  XLSX.utils.book_append_sheet(wb, wsCards, "Cartões");

  // Transações
  const txs = [
    ["Data", "Descrição", "Valor", "Tipo", "Conta", "Cartão", "Categoria", "Tags", "Observações"],
    ["📌 2025-05-05", "Salário Empresa X", 8500, "Receita", "Banco Inter", "", "cat_salary", "", "Via pró-labore"],
    ["📌 2025-05-05", "Aluguel apartamento", -2200, "Despesa", "Banco Inter", "", "cat_rent", "", "Contrato anual"],
    ["📌 2025-05-06", "Supermercado Pão Açúcar", -487.30, "Despesa", "", "Cartão Inter Pessoal", "cat_grocery", "", ""],
    ["📌 2025-05-07", "iFood almoço", -42.90, "Despesa", "", "Cartão Inter Pessoal", "cat_delivery", "", ""],
    ["📌 2025-05-10", "Netflix", -55.90, "Despesa", "", "Cartão Inter Pessoal", "cat_streaming", "", "Assinatura mensal"],
    ["📌 2025-05-15", "Transferência p/ poupança", -500, "Transferência", "Banco Inter", "", "cat_transfer", "", "Meta reserva"],
  ];
  const wsTx = XLSX.utils.aoa_to_sheet(txs);
  wsTx["!cols"] = [{wch:12}, {wch:30}, {wch:10}, {wch:14}, {wch:18}, {wch:22}, {wch:20}, {wch:15}, {wch:25}];
  XLSX.utils.book_append_sheet(wb, wsTx, "Transações");

  // Metas
  const metas = [
    ["Nome", "Valor alvo", "Valor atual", "Aporte mensal", "Data limite", "Ícone", "Cor"],
    ["📌 Reserva de emergência", 30000, 8500, 800, "", "🛡️", "#10b981"],
    ["📌 Viagem Europa", 20000, 2400, 600, "2027-12-31", "✈️", "#0ea5e9"],
    ["📌 Aposentadoria FIRE", 1000000, 45000, 2000, "", "🏖️", "#f59e0b"],
  ];
  const wsGoals = XLSX.utils.aoa_to_sheet(metas);
  wsGoals["!cols"] = [{wch:25}, {wch:12}, {wch:12}, {wch:14}, {wch:12}, {wch:6}, {wch:10}];
  XLSX.utils.book_append_sheet(wb, wsGoals, "Metas");

  // Recorrências
  const rec = [
    ["Descrição", "Valor", "Categoria", "Conta", "Frequência", "Dia", "Data início", "Data fim"],
    ["📌 Pró-labore Empresa", 15000, "cat_prolabore", "Banco Inter", "Mensal", 8, "2025-05-08", ""],
    ["📌 Aluguel", -2200, "cat_rent", "Banco Inter", "Mensal", 5, "2025-05-05", ""],
    ["📌 Netflix", -55.90, "cat_streaming", "Banco Inter", "Mensal", 1, "2025-05-01", ""],
    ["📌 Academia", -100, "cat_gym", "Banco Inter", "Mensal", 1, "2025-05-01", ""],
  ];
  const wsRec = XLSX.utils.aoa_to_sheet(rec);
  wsRec["!cols"] = [{wch:26}, {wch:10}, {wch:18}, {wch:18}, {wch:12}, {wch:6}, {wch:12}, {wch:12}];
  XLSX.utils.book_append_sheet(wb, wsRec, "Recorrências");

  // Tabela de categorias (referência)
  const catRef = [
    ["ID (use na coluna Categoria)", "Nome", "Grupo"],
    ...(Store.categories() || []).map(c => [c.id, c.name, c.group])
  ];
  const wsCatRef = XLSX.utils.aoa_to_sheet(catRef);
  wsCatRef["!cols"] = [{wch:24}, {wch:28}, {wch:20}];
  XLSX.utils.book_append_sheet(wb, wsCatRef, "Categorias (ref.)");

  XLSX.writeFile(wb, "finance-ai-modelo.xlsx");
}

/* ============ EXPORT DADOS ATUAIS COMO EXCEL ============ */
function exportExcelData() {
  if (!window.XLSX) return alert("XLSX não carregou. Recarregue a página.");

  const wb = XLSX.utils.book_new();
  const accById = {};
  Store.accounts().forEach(a => accById[a.id] = a);
  const cardById = {};
  Store.cards().forEach(c => cardById[c.id] = c);
  const catById = {};
  Store.categories().forEach(c => catById[c.id] = c);

  // Contas
  const contasData = Store.accounts().map(a => ({
    Nome: a.name, Tipo: a.type, Moeda: a.currency,
    "Saldo inicial": a.initial_balance, "Saldo atual": Store.accountBalance(a.id),
    Cor: a.color, "Ícone": a.icon
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contasData), "Contas");

  // Cartões
  const cardsData = Store.cards().map(c => ({
    Nome: c.name, Limite: c.limit,
    "Dia fechamento": c.closing_day, "Dia vencimento": c.due_day,
    "Uso atual": Store.cardCurrentUsage(c.id),
    "Conta padrão": c.default_account_id ? accById[c.default_account_id]?.name : ""
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cardsData), "Cartões");

  // Transações
  const txsData = Store.data.transactions.map(t => ({
    Data: t.date, "Descrição": t.description, Valor: t.amount, Tipo: t.type,
    Conta: t.account_id ? accById[t.account_id]?.name || "" : "",
    "Cartão": t.card_id ? cardById[t.card_id]?.name || "" : "",
    Categoria: catById[t.category_id]?.name || t.category_id,
    "ID Categoria": t.category_id,
    Tags: (t.tags || []).join(", "),
    "Observações": t.notes || ""
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txsData), "Transações");

  // Metas
  const goalsData = Store.goals().map(g => ({
    Nome: g.name, "Valor alvo": g.target_amount, "Valor atual": g.current_amount,
    "Aporte mensal": g.monthly_contribution, "Data limite": g.deadline || "",
    "Ícone": g.icon, Cor: g.color
  }));
  if (goalsData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(goalsData), "Metas");

  // Recorrências
  const recData = Store.recurrences().map(r => ({
    "Descrição": r.template.description, Valor: r.template.amount,
    Categoria: catById[r.template.category_id]?.name || r.template.category_id,
    Conta: r.template.account_id ? accById[r.template.account_id]?.name || "" : "",
    "Frequência": r.frequency, Dia: r.day,
    "Data início": r.start_date, "Data fim": r.end_date || "",
    Ativa: r.active ? "Sim" : "Não"
  }));
  if (recData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recData), "Recorrências");

  // Resumo
  const nw = Store.netWorth();
  const ms = Store.monthSummary();
  const resumo = [
    ["Resumo Financeiro - " + new Date().toLocaleDateString("pt-BR")],
    [""],
    ["Patrimônio líquido", nw.net],
    ["Ativos", nw.assets],
    ["Passivos", nw.liabilities],
    ["Saldo em contas", nw.breakdown.cash],
    ["Investimentos", nw.breakdown.investments],
    ["Dívidas", nw.breakdown.debts],
    ["Cartões em aberto", nw.breakdown.cards_open],
    [""],
    ["Mês atual"],
    ["Receita", ms.income],
    ["Despesa", ms.expense],
    ["Saldo", ms.net]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  const dt = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `finance-ai-${dt}.xlsx`);
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
    if (window.Automations) {
      Automations.attachHooks(Store);
      Automations.runDailyIfNeeded();
    }
    if (window.Bot && Bot.isConfigured()) Bot.start();
    if (window.MarketMonitor) MarketMonitor.start();
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

// Add OFX + OCR + Bulk CSV to reconcile view
const _origReconcile = renderReconcile;
window.renderReconcile = function() {
  const w = _origReconcile();
  const card = w.querySelector(".card");
  if (card) {
    const extras = h("div", { style: "margin-top:16px; padding-top:16px; border-top:1px solid var(--border)" },
      h("div", { class: "grid grid-3 gap-3" },
        h("div", {},
          h("div", { class: "font-semi mb-2" }, "🏛️ Arquivo OFX"),
          h("div", { class: "text-xs text-muted mb-2" }, "Exportado do internet banking"),
          h("input", { type: "file", accept: ".ofx,.OFX", class: "input", onChange: e => handleOfx(e.target.files[0]) })
        ),
        h("div", {},
          h("div", { class: "font-semi mb-2" }, "📄 PDF + OCR",
            h("span", { class: "badge brand", style: "margin-left:6px" }, "AI")),
          h("div", { class: "text-xs text-muted mb-2" }, "PDFs digitais ou escaneados"),
          h("input", { type: "file", accept: ".pdf", class: "input", onChange: e => handlePdfOcr(e.target.files[0]) })
        ),
        h("div", {},
          h("div", { class: "font-semi mb-2" }, "📂 CSV em lote",
            h("span", { class: "badge info", style: "margin-left:6px" }, "Multi-banco")),
          h("div", { class: "text-xs text-muted mb-2" }, "Vários arquivos ao mesmo tempo. Detecta Nubank, Itaú, Bradesco, Santander, BB, Caixa, Inter, C6"),
          h("input", { type: "file", accept: ".csv", multiple: true, class: "input", onChange: e => handleCsvBulk(e.target.files) })
        )
      )
    );
    card.appendChild(extras);
  }
  return w;
};

// Adiciona ganho de capital à view IRPF
const _origIRPF = renderIRPF;
window.renderIRPF = function() {
  const w = _origIRPF();
  const year = App.irpfYear || (new Date().getFullYear() - 1);
  const gains = renderIRPFCapitalGains(year);
  if (gains) w.appendChild(gains);
  return w;
};

// Adiciona Bot section ao Settings
const _origSettings = renderSettings;
window.renderSettings = function() {
  const w = _origSettings();
  // inserir antes da seção de nuvem (penúltimo card)
  const cards = w.querySelectorAll(".card");
  if (cards.length >= 2) {
    w.insertBefore(renderBotSection(), cards[cards.length - 2]);
  } else {
    w.appendChild(renderBotSection());
  }
  return w;
};

// Re-wire routes after all hooks
Object.assign(routes.reconcile, { render: renderReconcile });
Object.assign(routes.irpf, { render: renderIRPF });
Object.assign(routes.settings, { render: renderSettings });

// Re-wire routes after hooks
Object.assign(routes.investments, { render: renderInvestments });
Object.assign(routes.reconcile, { render: renderReconcile });

boot();
