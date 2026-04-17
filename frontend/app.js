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
const monthKey = d => (d || new Date().toISOString()).slice(0,7);
function monthLabel(ym) {
  const [y,m] = ym.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function addMonths(ym, n) {
  const [y,m] = ym.split("-").map(Number);
  return new Date(y, m - 1 + n, 1).toISOString().slice(0,7);
}

const App = { charts: {}, currentMonth: monthKey() };

/* ============ ROUTER ============ */
const routes = {
  "dashboard":   { title: "Dashboard",    render: renderDashboard,  icon: "📊" },
  "accounts":    { title: "Contas",       render: renderAccounts,   icon: "🏦" },
  "cards":       { title: "Cartões",      render: renderCards,      icon: "💳" },
  "transactions":{ title: "Transações",   render: renderTransactions, icon: "📝" },
  "budgets":     { title: "Orçamentos",   render: renderBudgets,    icon: "🧮" },
  "goals":       { title: "Metas",        render: renderGoals,      icon: "🎯" },
  "debts":       { title: "Dívidas",      render: renderDebts,      icon: "📉" },
  "investments": { title: "Investimentos", render: renderInvestments, icon: "📈" },
  "net-worth":   { title: "Patrimônio",   render: renderNetWorth,   icon: "💎" },
  "savings":     { title: "Economizar",   render: renderSavings,    icon: "💰" },
  "fire":        { title: "Investir & FIRE", render: renderFire,    icon: "🔥" },
  "reconcile":   { title: "Conciliar",    render: renderReconcile,  icon: "🔄" },
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
  if (Store.currentUserId && Store.user) enterApp();
  else renderAuth();
}

function renderAuth() {
  $("#auth").classList.remove("hidden");
  $("#app").classList.remove("active");
  let mode = "login";
  const form = $("#auth-form");
  form.onsubmit = (e) => {
    e.preventDefault();
    const email = $("#au-email").value, password = $("#au-pass").value, name = $("#au-name").value;
    try {
      if (mode === "login") Store.login({ email, password });
      else Store.register({ email, password, name });
      $("#auth-err").classList.add("hidden");
      enterApp();
    } catch (err) {
      $("#auth-err").textContent = err.message;
      $("#auth-err").classList.remove("hidden");
    }
  };
  $("#au-tab-login").onclick = () => switchAuth("login");
  $("#au-tab-reg").onclick = () => switchAuth("register");
  function switchAuth(m) {
    mode = m;
    $("#au-tab-login").classList.toggle("active", m === "login");
    $("#au-tab-reg").classList.toggle("active", m === "register");
    $("#au-name-wrap").classList.toggle("hidden", m !== "register");
    $("#au-submit").textContent = m === "login" ? "Entrar" : "Criar conta";
  }
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
  sb.append(
    h("div", { class: "brand" },
      h("div", { class: "icon" }, "💎"),
      h("div", {}, "Finance AI"),
    ),
    h("div", { class: "text-sm text-muted", style: "padding: 0 11px 12px" },
      h("div", { class: "font-semi" }, `Olá, ${u.name || u.email.split("@")[0]}`),
      h("div", { class: "text-xs" }, u.email)
    ),
    h("div", { class: "nav-section" }, "Visão geral"),
    navItem("dashboard"),
    navItem("net-worth"),
    h("div", { class: "nav-section" }, "Dia a dia"),
    navItem("accounts"),
    navItem("cards"),
    navItem("transactions"),
    navItem("budgets"),
    h("div", { class: "nav-section" }, "Futuro"),
    navItem("goals"),
    navItem("debts"),
    navItem("investments"),
    navItem("fire"),
    h("div", { class: "nav-section" }, "Inteligência"),
    navItem("savings"),
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
  const itemId = prompt("Pluggy Item ID:");
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

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Perfil"),
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "Nome"),
      h("input", { class: "input", id: "set-name", value: Store.user.name })
    ),
    h("label", { class: "field" },
      h("span", { class: "lbl" }, "Email"),
      h("input", { class: "input", value: Store.user.email, disabled: true })
    ),
    h("button", { class: "btn btn-primary", onClick: () => {
      Store.user.name = $("#set-name").value;
      Store.data.settings.first_name = $("#set-name").value;
      Store._save();
      renderSidebar();
      alert("Perfil atualizado");
    }}, "Salvar")
  ));

  wrap.append(h("div", { class: "card mb-3" },
    h("h3", {}, "Aparência"),
    h("button", { class: "btn btn-outline", onClick: () => {
      document.documentElement.classList.toggle("dark");
      localStorage.setItem("fa_v3_theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
      if (App.charts.flow) drawFlowChart();
    }}, "Alternar tema 🌓")
  ));

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

boot();
