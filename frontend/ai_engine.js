/* Finance AI v3 — Motor de Inteligência
 * Foco: economia, investimento, conciliação bancária.
 *
 * Exposto em window.AI:
 *  - insights(Store)              -> insights priorizados
 *  - savingsOpportunities(Store)  -> onde cortar
 *  - subscriptions(Store)         -> assinaturas detectadas
 *  - emergencyFund(Store)         -> análise reserva
 *  - fireProjection(Store, opts)  -> projeção independência financeira
 *  - compoundSimulator(opts)      -> simulador juros compostos
 *  - debtStrategy(Store)          -> avalanche vs snowball
 *  - reconcile(existing, incoming) -> dedup + sugestão categoria
 *  - chat(Store, question)        -> resposta em linguagem natural
 *  - forecast(Store, horizon)     -> projeção fluxo
 *  - financialScore(Store)        -> 0-100
 */

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function fmtBRL(v) { return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function monthKey(d) { return (d || new Date().toISOString()).slice(0,7); }
function addMonths(ym, n) {
  const [y,m] = ym.split("-").map(Number);
  return new Date(y, m - 1 + n, 1).toISOString().slice(0,7);
}

/* ============ INSIGHTS GERAIS ============ */
function insights(Store) {
  const out = [];
  const txs = Store.data.transactions;
  const ms = Store.monthSummary();
  const prevMonth = addMonths(monthKey(), -1);
  const prev = Store.monthSummary(prevMonth);

  // Saving rate
  if (ms.income > 0) {
    const rate = ((ms.income - ms.expense) / ms.income) * 100;
    if (rate < 10) {
      out.push({ severity: "danger", title: "Taxa de poupança muito baixa",
        msg: `Você está poupando apenas ${rate.toFixed(0)}% da renda. Ideal: 20%+.` });
    } else if (rate >= 30) {
      out.push({ severity: "ok", title: "Excelente taxa de poupança!",
        msg: `Você está poupando ${rate.toFixed(0)}% da renda — bem acima da média.` });
    }
  }

  // Spike
  if (prev.expense > 0) {
    const diff = ((ms.expense - prev.expense) / prev.expense) * 100;
    if (diff > 15) out.push({ severity: "warn", title: "Gastos subiram",
      msg: `Despesas ${diff.toFixed(0)}% acima do mês anterior.` });
    else if (diff < -15) out.push({ severity: "ok", title: "Gastos em queda",
      msg: `Despesas ${Math.abs(diff).toFixed(0)}% abaixo do mês anterior.` });
  }

  // Subscriptions
  const subs = subscriptions(Store);
  const subTotal = subs.reduce((s,x) => s + x.monthly, 0);
  if (subs.length >= 3) {
    out.push({ severity: "info", title: "Assinaturas ativas",
      msg: `${subs.length} assinaturas somando ${fmtBRL(subTotal)}/mês (${fmtBRL(subTotal*12)}/ano).` });
  }

  // Emergency fund
  const ef = emergencyFund(Store);
  if (ef.monthsCovered < 3) {
    out.push({ severity: "danger", title: "Reserva de emergência curta",
      msg: `Cobre apenas ${ef.monthsCovered.toFixed(1)} meses. Alvo: 6 meses (${fmtBRL(ef.target)}).` });
  } else if (ef.monthsCovered >= 6) {
    out.push({ severity: "ok", title: "Reserva de emergência saudável",
      msg: `Cobre ${ef.monthsCovered.toFixed(1)} meses de despesas.` });
  }

  // Budget overrun
  const budReport = Store.budgetReport();
  const overrun = budReport.filter(b => b.pct >= 100);
  if (overrun.length) {
    const cat = Store.categoryById(overrun[0].category_id);
    out.push({ severity: "warn", title: `Orçamento estourado: ${cat?.name || "categoria"}`,
      msg: `${fmtBRL(overrun[0].spent)} gastos de ${fmtBRL(overrun[0].planned)} planejados.` });
  }

  // Card high usage
  for (const card of Store.cards()) {
    const used = Store.cardCurrentUsage(card.id);
    const pct = (used / card.limit) * 100;
    if (pct >= 80) {
      out.push({ severity: "warn", title: `${card.name}: uso alto`,
        msg: `${pct.toFixed(0)}% do limite consumido (${fmtBRL(used)} de ${fmtBRL(card.limit)}).` });
    }
  }

  // Debt
  const debts = Store.debts();
  if (debts.length) {
    const totalDebt = debts.reduce((s,d) => s + d.balance, 0);
    out.push({ severity: "info", title: "Dívidas ativas",
      msg: `${debts.length} dívida(s) somando ${fmtBRL(totalDebt)}. Use a estratégia avalanche para quitar mais rápido.` });
  }

  // Top saving opportunity
  const ops = savingsOpportunities(Store);
  if (ops.length && ops[0].monthly > 50) {
    out.push({ severity: "info", title: `Economia possível: ${ops[0].category}`,
      msg: `Cortando 30% você economiza ${fmtBRL(ops[0].savings30)}/mês.` });
  }

  return out;
}

/* ============ ECONOMIA — onde cortar ============ */
function savingsOpportunities(Store) {
  const txs = Store.listTransactions({ month: monthKey(), type: "expense" });
  const byCat = {};
  for (const t of txs) {
    const c = Store.categoryById(t.category_id);
    if (!c || ["Financeiro","Receitas","Transferência"].includes(c.group)) continue;
    if (!byCat[c.id]) byCat[c.id] = { category: c.name, icon: c.icon, color: c.color, total: 0, count: 0 };
    byCat[c.id].total += Math.abs(t.amount);
    byCat[c.id].count += 1;
  }
  return Object.values(byCat)
    .map(x => ({
      ...x,
      monthly: +x.total.toFixed(2),
      annual: +(x.total * 12).toFixed(2),
      savings10: +(x.total * 0.1).toFixed(2),
      savings30: +(x.total * 0.3).toFixed(2),
      savings30Annual: +(x.total * 0.3 * 12).toFixed(2),
    }))
    .sort((a,b) => b.monthly - a.monthly)
    .slice(0, 8);
}

/* ============ ASSINATURAS (detecção automática) ============ */
function subscriptions(Store) {
  /* Agrupa por descrição normalizada; 2+ meses com valor similar → recorrente. */
  const txs = Store.listTransactions({ type: "expense" });
  const groups = {};
  for (const t of txs) {
    const k = normalize(t.description).trim().slice(0, 25);
    (groups[k] = groups[k] || []).push(t);
  }
  const subs = [];
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 4);
  for (const [key, items] of Object.entries(groups)) {
    if (items.length < 2) continue;
    const recentItems = items.filter(t => new Date(t.date) >= cutoff);
    if (recentItems.length < 2) continue;
    const values = recentItems.map(t => Math.abs(t.amount));
    const avg = values.reduce((s,v) => s+v, 0) / values.length;
    const maxDev = Math.max(...values.map(v => Math.abs(v - avg)));
    if (maxDev / avg > 0.3) continue; // valor muito diferente, não é assinatura fixa
    const sorted = [...recentItems].sort((a,b) => a.date.localeCompare(b.date));
    const dayGaps = [];
    for (let i = 1; i < sorted.length; i++) {
      dayGaps.push((new Date(sorted[i].date) - new Date(sorted[i-1].date)) / 86400000);
    }
    const avgGap = dayGaps.length ? dayGaps.reduce((s,v) => s+v, 0) / dayGaps.length : 30;
    if (avgGap < 25 || avgGap > 40) continue;
    subs.push({
      key, description: sorted[0].description,
      monthly: +avg.toFixed(2),
      annual: +(avg * 12).toFixed(2),
      last_date: sorted[sorted.length-1].date,
      count: recentItems.length,
      category_id: sorted[0].category_id
    });
  }
  return subs.sort((a,b) => b.monthly - a.monthly);
}

/* ============ RESERVA DE EMERGÊNCIA ============ */
function emergencyFund(Store) {
  // despesa média últimos 3 meses
  const months = [0,1,2].map(i => addMonths(monthKey(), -i));
  const expenses = months.map(m => Store.monthSummary(m).expense);
  const avgExpense = expenses.filter(x => x > 0).reduce((s,v) => s+v, 0) / (expenses.filter(x => x > 0).length || 1);

  // reserva atual = soma contas marcadas "include_in_net_worth" + investimentos líquidos (renda fixa)
  const savings = Store.accounts().filter(a => a.include_in_net_worth)
    .reduce((s,a) => s + Math.max(0, Store.accountBalance(a.id)), 0);
  const liquidInvest = Store.investments().filter(i => i.type === "renda_fixa")
    .reduce((s,i) => s + i.quantity * i.current_price, 0);

  const current = +(savings + liquidInvest).toFixed(2);
  const target = +(avgExpense * 6).toFixed(2);
  const monthsCovered = avgExpense > 0 ? current / avgExpense : 0;
  return {
    avgExpense: +avgExpense.toFixed(2),
    current, target,
    monthsCovered: +monthsCovered.toFixed(1),
    gap: Math.max(0, +(target - current).toFixed(2)),
    status: monthsCovered >= 6 ? "ok" : monthsCovered >= 3 ? "warn" : "danger"
  };
}

/* ============ FIRE — Independência Financeira (regra 4%) ============ */
function fireProjection(Store, { monthly_contribution = null, annual_return = 0.08, safe_rate = 0.04 } = {}) {
  // FIRE number = despesa anual / safe_rate  (ex: 0.04 -> 25x despesa anual)
  const ms = Store.monthSummary();
  const ef = emergencyFund(Store);
  const annualExpense = (ef.avgExpense || ms.expense) * 12;
  const fireNumber = annualExpense / safe_rate;

  const nw = Store.netWorth();
  const currentInvest = nw.breakdown.investments + Math.max(0, nw.breakdown.cash - ef.target);

  // Estimar contribuição mensal a partir das metas ou do fluxo
  const goalContrib = Store.goals().reduce((s,g) => s + (g.monthly_contribution || 0), 0);
  const cashflow = Math.max(0, ms.income - ms.expense);
  const contrib = monthly_contribution ?? Math.max(goalContrib, cashflow * 0.5);

  // Projeção mês a mês até atingir fireNumber
  let balance = currentInvest;
  const monthlyRate = annual_return / 12;
  const timeline = [];
  let months = 0;
  while (balance < fireNumber && months < 600) {
    balance = balance * (1 + monthlyRate) + contrib;
    months++;
    if (months % 12 === 0) timeline.push({ year: months / 12, balance: +balance.toFixed(0) });
  }
  return {
    annualExpense: +annualExpense.toFixed(2),
    fireNumber: +fireNumber.toFixed(2),
    currentInvest: +currentInvest.toFixed(2),
    monthlyContribution: +contrib.toFixed(2),
    annualReturn: annual_return,
    yearsToFire: +(months / 12).toFixed(1),
    achievable: months < 600,
    timeline,
    progress: Math.min(100, +(currentInvest / fireNumber * 100).toFixed(1))
  };
}

/* ============ Simulador juros compostos ============ */
function compoundSimulator({ initial = 0, monthly = 500, annual_rate = 0.10, years = 10 }) {
  const r = annual_rate / 12;
  const n = years * 12;
  let balance = +initial;
  const timeline = [{ month: 0, year: 0, balance: balance, invested: initial }];
  let invested = +initial;
  for (let i = 1; i <= n; i++) {
    balance = balance * (1 + r) + monthly;
    invested += monthly;
    if (i % 12 === 0) timeline.push({ month: i, year: i/12, balance: +balance.toFixed(2), invested: +invested.toFixed(2) });
  }
  return {
    final: +balance.toFixed(2),
    invested: +invested.toFixed(2),
    profit: +(balance - invested).toFixed(2),
    timeline
  };
}

/* ============ Estratégia de Dívidas (avalanche vs snowball) ============ */
function debtStrategy(Store, monthly_payment_budget = null) {
  const debts = Store.debts().map(d => ({ ...d }));
  if (!debts.length) return null;

  const totalMin = debts.reduce((s,d) => s + (d.balance * d.interest_rate / 100 + (d.balance / (d.installments_total - d.installments_paid || 12))), 0);
  const budget = monthly_payment_budget ?? totalMin * 1.2;

  function simulate(order) {
    let list = order.map(id => ({ ...debts.find(d => d.id === id) }));
    let months = 0, totalInterest = 0;
    while (list.some(d => d.balance > 0) && months < 600) {
      months++;
      let pool = budget;
      // juros aplicados primeiro
      for (const d of list) {
        if (d.balance <= 0) continue;
        const interest = d.balance * d.interest_rate / 100;
        d.balance += interest;
        totalInterest += interest;
      }
      // pagamento na ordem
      for (const d of list) {
        if (pool <= 0) break;
        if (d.balance <= 0) continue;
        const pay = Math.min(pool, d.balance);
        d.balance -= pay;
        pool -= pay;
      }
    }
    return { months, totalInterest: +totalInterest.toFixed(2) };
  }

  const avalancheOrder = [...debts].sort((a,b) => b.interest_rate - a.interest_rate).map(d => d.id);
  const snowballOrder  = [...debts].sort((a,b) => a.balance - b.balance).map(d => d.id);

  const avalanche = simulate(avalancheOrder);
  const snowball  = simulate(snowballOrder);

  return {
    budget: +budget.toFixed(2),
    avalanche: { ...avalanche, order: avalancheOrder },
    snowball:  { ...snowball,  order: snowballOrder },
    recommended: avalanche.totalInterest < snowball.totalInterest ? "avalanche" : "snowball",
    savings: +Math.abs(avalanche.totalInterest - snowball.totalInterest).toFixed(2)
  };
}

/* ============ CONCILIAÇÃO (dedup + sugestão) ============ */
function reconcile(existing, incoming) {
  /* existing: array de transactions do Store
   * incoming: array { date, description, amount, external_id? }
   * Retorna { new, duplicates, matches } */
  const isDuplicate = (inc, ex) =>
    inc.amount === ex.amount &&
    Math.abs(new Date(inc.date) - new Date(ex.date)) / 86400000 <= 2 &&
    normalize(inc.description).slice(0,15) === normalize(ex.description).slice(0,15);

  const out = { new: [], duplicates: [], matches: [] };
  for (const inc of incoming) {
    const match = existing.find(ex => ex.external_id && inc.external_id && ex.external_id === inc.external_id)
               || existing.find(ex => isDuplicate(inc, ex));
    if (match) out.duplicates.push({ incoming: inc, existing: match });
    else out.new.push({ ...inc, suggested_category: suggestCategory(inc.description) });
  }
  return out;
}

function suggestCategory(description) {
  // Remove prefixo "COMPRA CARTAO - No estabelecimento" para melhor match
  const clean = (description || "")
    .replace(/^compra cart[aã]o\s*-\s*no estabelecimento\s*/i, "")
    .replace(/^compra\s*-\s*/i, "")
    .replace(/\s+\d+\/\d+\s*$/, "") // remove " - 1/3"
    .replace(/\s+bra\s*$/i, "");
  const d = normalize(clean);
  const rules = [
    // Delivery / Food apps
    { r: /ifood|rappi|uber\s*eats|jim\.com|99food/, c: "cat_delivery" },
    // Streaming
    { r: /netflix|spotify|disney|hbo|prime video|globoplay|deezer|apple music|youtube premium/, c: "cat_streaming" },
    // Transporte por app
    { r: /^uber(?!\s*eats)|99app|99 app|\bpop\s?99|cabify|indriver/, c: "cat_rideshare" },
    // Combustível
    { r: /posto |shell |ipiranga|br mania|petrobras|brasilpetro|combusti|gasolin/, c: "cat_fuel" },
    // Estacionamento / transporte
    { r: /allpark|estapar|zona azul|estacion|bus servi|onibus|metro|cptm|bilhete|rodoviari/, c: "cat_transit" },
    // Supermercado
    { r: /mercado|supermerc|carrefour|atacad|dma |pao de ac|extra |assai|bh supermer|bretas|epa |verdemar|hortifrut|alimentar carnes|carnes nobre|ki gas|comercial irmaos|distribuidora/, c: "cat_grocery" },
    // Restaurante / comida
    { r: /restaur|hambur|lanchon|pizza|padar|cafeteri|bar |churrasc|boteco|pipoca |acai|acaí|blend cacau|ailton|nio fibra|cotaoffice|alvinopolis|ducarmos|du carmos/, c: "cat_restaurant" },
    // Bebidas
    { r: /bebida|cerveja|adega|choper|chopp|vinho/, c: "cat_restaurant" },
    // Farmácia / Saúde
    { r: /farmac|drogaria|drogasil|pacheco|nissei|paguemenos|pague menos|raia|parodim/, c: "cat_pharmacy" },
    { r: /unimed|bradesco sa[uú]de|amil|hapvida|consulta|hospital|dentis|clinic|medic|laborat|exame/, c: "cat_health" },
    // Academia
    { r: /academia|smart\s?fit|selfit|bio ?ritmo|gympass|crossfit|pilates/, c: "cat_gym" },
    // Moradia
    { r: /aluguel|condom[ií]ni|reforma|casa m[aãâ]e|material constru/, c: "cat_rent" },
    // Receitas
    { r: /salar|folha|holer|remunera|bolsa/, c: "cat_salary" },
    { r: /rendimento|dividend|cdb|lca|lci|tesouro|juros recebid|corretagem/, c: "cat_dividend" },
    { r: /freelanc|pro-labore|prolabore|honor[aá]ri|presta[cç][aã]o de servi/, c: "cat_freelance" },
    { r: /dinheiro carteira|saida caixa|entrada caixa|bol[aã]o|ressarc/, c: "cat_other_in" },
    // Internet/TV
    { r: /vivo |claro |tim |oi fibra|nio fibra|net |algar|sky |brisanet|desktop |americane?t/, c: "cat_internet" },
    // Utilities (luz, água, gás)
    { r: /cemig|enel|copel|cpfl|light|eletropaulo|coelba|celpe|energisa|copasa|sabesp|caesb|compesa|comgas|gas natural|sispass/, c: "cat_utilities" },
    // Transferências
    { r: /^pix(?!\s*car)|^ted|^doc |^transf|pagamento de boleto/, c: "cat_transfer" },
    // Viagem
    { r: /latam|gol |azul |tam |decolar|booking|airbnb|hotel|hospedagem|aerop|cnf aeroporto|passagem/, c: "cat_travel" },
    // Vestuário
    { r: /havaianas|crocs|rena?r\b|c&a|riachuelo|hering|zara |pernambucanas|calcad|sapatar|tenis|verao empreendimento/, c: "cat_clothing" },
    // Compras / Eletrônicos
    { r: /apple|iplace|dell|samsung|xiaomi|magazineluiza|magalu|shopee|amazon|mercado livre|mercadolivre|kabum/, c: "cat_shopping" },
    // Lazer / Entretenimento
    { r: /cinema|ingresso|sympla|show|teatro|parque|clube giro|clube |carnaval/, c: "cat_entertainment" },
    // Serviços específicos do usuário
    { r: /adesivos|anuncio|meudinheiro|manuten[çc][aã]o|jeep|compass|fralda|otica|oculos|óculos/, c: "cat_shopping" },
    { r: /atila reinaldo|comercial irmaos las casas/, c: "cat_grocery" },
  ];
  for (const { r, c } of rules) if (r.test(d)) return c;
  return null;
}

/* ============ CHAT IA (intent-based local) ============ */
function chat(Store, question) {
  const q = normalize(question);

  const intent = matchIntent(q);
  try {
    return intent.handler(Store, q, question);
  } catch (err) {
    return `Desculpe, tive um problema: ${err.message}`;
  }
}

function matchIntent(q) {
  const intents = [
    { test: /saldo|quanto tenho|total em conta/, handler: handleBalance },
    { test: /patrim|net worth/, handler: handleNetWorth },
    { test: /gast(?:ei|ando|os) (?:com |em |no )?([a-z]+)/, handler: handleSpentCategory },
    { test: /gast(?:ei|ando|os)|despes/, handler: handleSpentTotal },
    { test: /quanto (?:vou|irei|vai|consigo) (?:juntar|ter|acumular)/, handler: handleForecastSavings },
    { test: /quando (?:posso|vou|consigo) (?:me aposent|atingir fire)/, handler: handleFIRE },
    { test: /cortar|economiz|reduz/, handler: handleSavings },
    { test: /assinatur|recorrent/, handler: handleSubscriptions },
    { test: /reserva de emerg|emerg[eê]ncia/, handler: handleEmergency },
    { test: /d[ií]vid|devo/, handler: handleDebts },
    { test: /meta|objetivo/, handler: handleGoals },
    { test: /cart[ãa]o|fatura/, handler: handleCards },
    { test: /or[çc]amento|budget/, handler: handleBudget },
    { test: /maior gasto|top gastos|onde mais gast/, handler: handleTopSpend },
    { test: /investir|investiment|aplic/, handler: handleInvestments },
    { test: /simular|juros compostos|quanto rende/, handler: handleSimulator },
    { test: /(renda|entradas|receita|ganh[ei|os])/, handler: handleIncome },
    { test: /ol[aá]|oi|ajuda|help|pode fazer|consegue/, handler: handleHelp },
  ];
  for (const i of intents) if (i.test.test(q)) return i;
  return { handler: handleFallback };
}

function handleBalance(Store) {
  const accs = Store.accounts();
  if (!accs.length) return "Você ainda não tem contas cadastradas.";
  const lines = accs.map(a => `- ${a.icon} ${a.name}: ${fmtBRL(Store.accountBalance(a.id))}`);
  const total = accs.reduce((s,a) => s + Store.accountBalance(a.id), 0);
  return `Saldo total em contas: **${fmtBRL(total)}**\n\n${lines.join("\n")}`;
}

function handleNetWorth(Store) {
  const n = Store.netWorth();
  return `**Patrimônio líquido: ${fmtBRL(n.net)}**\n\n` +
    `Ativos: ${fmtBRL(n.assets)} (contas ${fmtBRL(n.breakdown.cash)} + investimentos ${fmtBRL(n.breakdown.investments)})\n` +
    `Passivos: ${fmtBRL(n.liabilities)} (dívidas ${fmtBRL(n.breakdown.debts)} + cartões em aberto ${fmtBRL(n.breakdown.cards_open)})`;
}

function handleSpentCategory(Store, q, original) {
  const m = q.match(/gast(?:ei|ando|os)? (?:com |em |no )?([a-z ]+)/);
  const keyword = m ? m[1].trim().split(/\s+/)[0] : "";
  if (!keyword) return handleSpentTotal(Store);
  const cats = Store.categories().filter(c =>
    normalize(c.name).includes(keyword) || normalize(c.group).includes(keyword)
  );
  if (!cats.length) return `Não encontrei categoria "${keyword}". Tente: alimentação, transporte, lazer, saúde, moradia, compras.`;
  const month = monthKey();
  let total = 0;
  const lines = cats.map(c => {
    const t = Store.listTransactions({ month, category_id: c.id })
      .filter(x => x.type === "expense")
      .reduce((s,x) => s + Math.abs(x.amount), 0);
    total += t;
    return `- ${c.icon} ${c.name}: ${fmtBRL(t)}`;
  });
  return `Gastos deste mês em "${keyword}":\n\n${lines.join("\n")}\n\n**Total: ${fmtBRL(total)}**`;
}

function handleSpentTotal(Store) {
  const m = Store.monthSummary();
  const prev = Store.monthSummary(addMonths(monthKey(), -1));
  const delta = prev.expense > 0 ? ((m.expense - prev.expense) / prev.expense * 100) : 0;
  return `Este mês: gastos de **${fmtBRL(m.expense)}**, receita de **${fmtBRL(m.income)}**.\n` +
    `Saldo do mês: ${fmtBRL(m.net)}.\n` +
    (prev.expense > 0 ? `Variação vs mês anterior: ${delta > 0 ? "+" : ""}${delta.toFixed(0)}%.` : "");
}

function handleForecastSavings(Store) {
  const ms = Store.monthSummary();
  const saving = ms.income - ms.expense;
  if (saving <= 0) return "Você não está conseguindo poupar este mês. Tente cortar custos variáveis.";
  const sim = compoundSimulator({ initial: 0, monthly: saving, annual_rate: 0.08, years: 5 });
  return `Se poupar ${fmtBRL(saving)}/mês a 8% ao ano:\n\n` +
    `- 1 ano: ${fmtBRL(sim.timeline[1].balance)}\n` +
    `- 5 anos: ${fmtBRL(sim.final)}\n` +
    `Dos quais ${fmtBRL(sim.profit)} são juros.`;
}

function handleFIRE(Store) {
  const f = fireProjection(Store);
  if (!f.achievable) return "Com o ritmo atual, a projeção FIRE ultrapassa 50 anos. Aumente a contribuição mensal.";
  return `Seu número FIRE: **${fmtBRL(f.fireNumber)}** (25x despesa anual).\n` +
    `Hoje você tem ${fmtBRL(f.currentInvest)} investido (${f.progress}%).\n` +
    `Aportando ${fmtBRL(f.monthlyContribution)}/mês a ${(f.annualReturn*100).toFixed(0)}% ao ano:\n` +
    `- Independência financeira em **${f.yearsToFire} anos**.`;
}

function handleSavings(Store) {
  const ops = savingsOpportunities(Store);
  if (!ops.length) return "Poucos dados ainda para sugerir cortes.";
  const top = ops.slice(0, 3);
  const lines = top.map(o => `- ${o.icon} ${o.category}: ${fmtBRL(o.monthly)}/mês — cortando 30% economiza ${fmtBRL(o.savings30)}/mês (${fmtBRL(o.savings30Annual)}/ano)`);
  return `Top oportunidades de economia:\n\n${lines.join("\n")}\n\nSe cortar 30% nos 3 maiores: **${fmtBRL(top.reduce((s,o)=>s+o.savings30,0))}/mês**.`;
}

function handleSubscriptions(Store) {
  const subs = subscriptions(Store);
  if (!subs.length) return "Nenhuma assinatura recorrente detectada.";
  const total = subs.reduce((s,x) => s + x.monthly, 0);
  const lines = subs.slice(0, 8).map(s => `- ${s.description}: ${fmtBRL(s.monthly)}/mês`);
  return `Assinaturas detectadas (${subs.length}):\n\n${lines.join("\n")}\n\n**Total: ${fmtBRL(total)}/mês • ${fmtBRL(total * 12)}/ano**`;
}

function handleEmergency(Store) {
  const ef = emergencyFund(Store);
  return `Sua reserva de emergência: **${fmtBRL(ef.current)}**\n` +
    `Meta (6 meses de despesas): ${fmtBRL(ef.target)}\n` +
    `Cobre atualmente ${ef.monthsCovered} meses.\n` +
    (ef.gap > 0 ? `Falta ${fmtBRL(ef.gap)} para atingir o ideal.` : "Parabéns, reserva completa!");
}

function handleDebts(Store) {
  const debts = Store.debts();
  if (!debts.length) return "Você não tem dívidas cadastradas. 👏";
  const total = debts.reduce((s,d) => s + d.balance, 0);
  const strat = debtStrategy(Store);
  const lines = debts.map(d => `- ${d.name}: ${fmtBRL(d.balance)} (${d.interest_rate}% a.m.)`);
  return `Dívidas (${fmtBRL(total)} total):\n\n${lines.join("\n")}\n\n` +
    (strat ? `Recomendado: método **${strat.recommended}** — economiza ${fmtBRL(strat.savings)} em juros.` : "");
}

function handleGoals(Store) {
  const goals = Store.goals();
  if (!goals.length) return "Nenhuma meta cadastrada. Cadastre uma em Metas!";
  const lines = goals.map(g => {
    const pct = (g.current_amount / g.target_amount * 100).toFixed(0);
    return `- ${g.icon} ${g.name}: ${fmtBRL(g.current_amount)} / ${fmtBRL(g.target_amount)} (${pct}%)`;
  });
  return `Suas metas:\n\n${lines.join("\n")}`;
}

function handleCards(Store) {
  const cards = Store.cards();
  if (!cards.length) return "Nenhum cartão cadastrado.";
  const lines = cards.map(c => {
    const used = Store.cardCurrentUsage(c.id);
    return `- ${c.name}: ${fmtBRL(used)} de ${fmtBRL(c.limit)} (${((used/c.limit)*100).toFixed(0)}%), vence dia ${c.due_day}`;
  });
  return `Cartões:\n\n${lines.join("\n")}`;
}

function handleBudget(Store) {
  const rep = Store.budgetReport();
  if (!rep.length) return "Você ainda não tem orçamentos. Defina limites em Orçamentos.";
  const lines = rep.map(b => {
    const cat = Store.categoryById(b.category_id);
    return `- ${cat?.icon} ${cat?.name}: ${fmtBRL(b.spent)} / ${fmtBRL(b.planned)} (${b.pct}%)`;
  });
  return `Orçamento do mês:\n\n${lines.join("\n")}`;
}

function handleTopSpend(Store) {
  const ops = savingsOpportunities(Store);
  if (!ops.length) return "Sem dados suficientes.";
  const lines = ops.slice(0, 5).map((o,i) => `${i+1}. ${o.icon} ${o.category}: ${fmtBRL(o.monthly)}`);
  return `Maiores gastos do mês:\n\n${lines.join("\n")}`;
}

function handleInvestments(Store) {
  const inv = Store.investments();
  const nw = Store.netWorth();
  if (!inv.length) return `Você tem ${fmtBRL(nw.breakdown.cash)} em contas. Comece investindo pela reserva de emergência em CDB/Tesouro Selic.`;
  const total = inv.reduce((s,i) => s + i.quantity * i.current_price, 0);
  const invested = inv.reduce((s,i) => s + i.quantity * i.avg_price, 0);
  const profit = total - invested;
  const pct = invested > 0 ? (profit / invested * 100).toFixed(1) : 0;
  return `Carteira atual: **${fmtBRL(total)}** (investido ${fmtBRL(invested)}, lucro ${fmtBRL(profit)}, ${pct}%).\n\n` +
    inv.map(i => `- ${i.name} (${i.ticker}): ${fmtBRL(i.quantity * i.current_price)}`).join("\n");
}

function handleSimulator(Store) {
  const ms = Store.monthSummary();
  const saving = Math.max(100, ms.income - ms.expense);
  const sim = compoundSimulator({ monthly: saving, annual_rate: 0.10, years: 10 });
  return `Simulação: ${fmtBRL(saving)}/mês por 10 anos a 10% a.a.\n\n` +
    `Final: ${fmtBRL(sim.final)} (investido ${fmtBRL(sim.invested)}, juros ${fmtBRL(sim.profit)}).\n` +
    `Para outra simulação, vá em **Investir**.`;
}

function handleIncome(Store) {
  const m = Store.monthSummary();
  return `Receita deste mês: **${fmtBRL(m.income)}**. Saldo do mês: ${fmtBRL(m.net)}.`;
}

function handleHelp() {
  return `Pergunte coisas como:\n` +
    `• "Qual meu saldo?"\n` +
    `• "Quanto gastei com alimentação?"\n` +
    `• "Onde posso economizar?"\n` +
    `• "Quais minhas assinaturas?"\n` +
    `• "Quando atinjo a independência financeira?"\n` +
    `• "Simule juros compostos"\n` +
    `• "Como estão meus cartões?"`;
}

function handleFallback(Store, q) {
  return `Não entendi "${q}". Tente perguntar sobre saldo, gastos, economia, assinaturas, dívidas, metas, cartões ou investimentos.`;
}

/* ============ FORECAST e SCORE ============ */
function forecast(Store, horizonDays = 30) {
  const txs = Store.data.transactions;
  if (!txs.length) return { balance: 0, projection: [], trend: "stable", daily_avg: 0 };
  const today = new Date(); today.setHours(0,0,0,0);
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 90);
  const recent = txs.filter(t => new Date(t.date) >= cutoff);

  const nw = Store.netWorth();
  const balance = nw.breakdown.cash;
  const dailyAvg = recent.reduce((s,t) => s + t.amount, 0) / 90;

  const mid = new Date(cutoff); mid.setDate(mid.getDate() + 45);
  const h1 = recent.filter(t => new Date(t.date) >= mid).reduce((s,t) => s+t.amount, 0);
  const h2 = recent.filter(t => new Date(t.date) <  mid).reduce((s,t) => s+t.amount, 0);
  let trend = "stable";
  if (h1 && h2) {
    if (h1 < h2 * 0.9) trend = "declining";
    else if (h1 > h2 * 1.1) trend = "growing";
  }

  const projection = [];
  let current = balance;
  for (let i = 1; i <= horizonDays; i++) {
    current += dailyAvg;
    const d = new Date(today); d.setDate(d.getDate() + i);
    projection.push({ day: i, date: d.toISOString().slice(0,10), balance: +current.toFixed(2) });
  }
  return { balance: +balance.toFixed(2), daily_avg: +dailyAvg.toFixed(2), trend, projection };
}

function financialScore(Store) {
  let score = 50;
  const ms = Store.monthSummary();
  const ef = emergencyFund(Store);
  const nw = Store.netWorth();

  // Taxa de poupança
  if (ms.income > 0) {
    const rate = (ms.income - ms.expense) / ms.income;
    if (rate >= 0.3) score += 20;
    else if (rate >= 0.2) score += 15;
    else if (rate >= 0.1) score += 8;
    else if (rate < 0)    score -= 15;
  }
  // Reserva de emergência
  if (ef.monthsCovered >= 6) score += 15;
  else if (ef.monthsCovered >= 3) score += 8;
  else score -= 5;
  // Dívidas
  const debt = Store.debts().reduce((s,d) => s + d.balance, 0);
  if (debt > nw.assets * 0.5) score -= 15;
  else if (debt > nw.assets * 0.2) score -= 5;
  // Investimentos
  if (nw.breakdown.investments > 0) score += 10;
  // Orçamento
  const overruns = Store.budgetReport().filter(b => b.pct > 100).length;
  if (overruns > 0) score -= overruns * 3;
  // Patrimônio positivo
  if (nw.net > 0) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

window.AI = {
  insights, savingsOpportunities, subscriptions, emergencyFund,
  fireProjection, compoundSimulator, debtStrategy, reconcile,
  suggestCategory, chat, forecast, financialScore,
  fmtBRL, monthKey, addMonths
};
