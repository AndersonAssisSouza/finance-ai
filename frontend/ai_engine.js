/**
 * Motor de IA local - porta do backend Python para JavaScript.
 * Permite que o app rode 100% no browser (GitHub Pages) com localStorage.
 */

const CATEGORY_KEYWORDS = {
  alimentacao: ["ifood","mercado","supermercado","restaurante","lanchonete","padaria","pao","burger","pizza","food","bar ","acai","cafe"],
  transporte:  ["uber","99","taxi","combustivel","gasolina","posto","shell","petrobras","ipiranga","metro","onibus","estacionamento","pedagio"],
  moradia:     ["aluguel","condominio","iptu","luz","energia","agua","gas ","internet","net ","vivo","claro","tim "],
  saude:       ["farmacia","drogaria","medico","consulta","exame","hospital","clinica","plano de saude","unimed","amil","droga raia","drogasil"],
  lazer:       ["netflix","spotify","prime","disney","hbo","cinema","show","ingresso","youtube","twitch","steam","playstation"],
  educacao:    ["escola","faculdade","curso","livro","udemy","coursera","alura"],
  salario:     ["salario","pagamento","folha","remuneracao","provento"],
  investimento:["aplicacao","cdb","tesouro","acao","fii","b3","rendimento","dividendo","juros"],
  transferencia:["pix","ted","doc","transferencia"],
  compras:     ["shopee","mercado livre","amazon","magalu","magazine","americanas","casas bahia","shein","aliexpress"],
  impostos:    ["imposto","darf","das ","inss","irpf","taxa"],
};

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function categorize(description, amount, userRules = []) {
  const desc = normalize(description);
  for (const r of userRules) {
    if (desc.includes(normalize(r.keyword))) return r.category;
  }
  if (amount > 0) {
    if (CATEGORY_KEYWORDS.salario.some(k => desc.includes(k))) return "salario";
    if (CATEGORY_KEYWORDS.investimento.some(k => desc.includes(k))) return "investimento";
    if (CATEGORY_KEYWORDS.transferencia.some(k => desc.includes(k))) return "receita";
    return "receita";
  }
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === "salario" || cat === "investimento") continue;
    if (kws.some(k => desc.includes(k))) return cat;
  }
  return "outros";
}

function detectRecurring(transactions) {
  const groups = {};
  for (const t of transactions) {
    const key = normalize(t.description).trim().slice(0, 20);
    (groups[key] = groups[key] || []).push(t);
  }
  const recurringIds = new Set();
  for (const items of Object.values(groups)) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((a,b) => new Date(a.date) - new Date(b.date));
    const gaps = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const d1 = new Date(sorted[i].date), d2 = new Date(sorted[i+1].date);
      gaps.push((d2 - d1) / 86400000);
    }
    const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
    if (gaps.length && avg >= 25 && avg <= 35) {
      items.forEach(t => recurringIds.add(t.id));
    }
  }
  return recurringIds;
}

function summarizeByCategory(transactions) {
  const totals = {}, counts = {};
  for (const t of transactions) {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
    counts[t.category] = (counts[t.category] || 0) + 1;
  }
  return Object.keys(totals).map(c => ({
    category: c,
    total: Math.round(totals[c] * 100) / 100,
    count: counts[c]
  }));
}

function monthlyFlow(transactions) {
  const flow = {};
  for (const t of transactions) {
    const d = new Date(t.date);
    const key = d.toISOString().slice(0, 7);
    if (!flow[key]) flow[key] = { income: 0, expense: 0 };
    if (t.amount >= 0) flow[key].income += t.amount;
    else flow[key].expense += Math.abs(t.amount);
  }
  return Object.keys(flow).sort().map(k => ({
    month: k,
    income: flow[k].income,
    expense: flow[k].expense,
    net: Math.round((flow[k].income - flow[k].expense) * 100) / 100
  }));
}

function advancedForecast(transactions, horizonDays = 30) {
  if (!transactions.length) {
    return { balance: 0, projection: [], daily_avg: 0, trend: "stable",
             daily_income: 0, daily_expense: 0 };
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 90);
  const recent = transactions.filter(t => new Date(t.date) >= cutoff);

  const balance = transactions.reduce((s,t) => s + t.amount, 0);
  const expenses = recent.filter(t => t.amount < 0).map(t => t.amount);
  const incomes  = recent.filter(t => t.amount > 0).map(t => t.amount);

  const dailyExpense = expenses.reduce((s,v) => s+v, 0) / 90;
  const dailyIncome  = incomes.reduce((s,v) => s+v, 0) / 90;
  const dailyAvg = dailyExpense + dailyIncome;

  const mid = new Date(cutoff); mid.setDate(mid.getDate() + 45);
  const firstHalf  = recent.filter(t => new Date(t.date) >= mid).reduce((s,t) => s+t.amount, 0);
  const secondHalf = recent.filter(t => new Date(t.date) <  mid).reduce((s,t) => s+t.amount, 0);
  let trend = "stable";
  if (firstHalf && secondHalf) {
    if (firstHalf < secondHalf * 0.9) trend = "declining";
    else if (firstHalf > secondHalf * 1.1) trend = "growing";
  }

  const projection = [];
  let current = balance;
  for (let i = 0; i < horizonDays; i++) {
    current += dailyAvg;
    const d = new Date(today); d.setDate(d.getDate() + i + 1);
    projection.push({
      day: i + 1,
      date: d.toISOString().slice(0, 10),
      balance: Math.round(current * 100) / 100
    });
  }
  return {
    balance: Math.round(balance * 100) / 100,
    daily_avg: Math.round(dailyAvg * 100) / 100,
    daily_income: Math.round(dailyIncome * 100) / 100,
    daily_expense: Math.round(dailyExpense * 100) / 100,
    trend,
    projection
  };
}

function riskAssessment(f, transactions) {
  let daysUntilNegative = null;
  for (const p of f.projection) {
    if (p.balance < 0) { daysUntilNegative = p.day; break; }
  }
  let level;
  if (f.balance < 0) level = "critico";
  else if (daysUntilNegative && daysUntilNegative <= 15) level = "alto";
  else if (daysUntilNegative && daysUntilNegative <= 30) level = "medio";
  else if (f.daily_avg < 0 && f.balance < Math.abs(f.daily_avg) * 60) level = "medio";
  else level = "baixo";

  const recommendations = [];
  if (level === "critico")
    recommendations.push("Saldo negativo — revise gastos imediatos e corte supérfluos.");
  if (["alto","medio"].includes(level))
    recommendations.push("Reduza despesas variáveis (lazer, compras) para alongar o caixa.");
  if (f.trend === "declining")
    recommendations.push("Tendência de queda detectada nos últimos 45 dias.");
  if (f.daily_avg < 0) {
    const runwayMonths = f.balance / Math.abs(f.daily_avg) / 30;
    if (runwayMonths < 3)
      recommendations.push("Reserva inferior a 3 meses de despesas — acumule emergência.");
  }
  if (!recommendations.length) recommendations.push("Situação estável. Continue monitorando.");

  return { level, days_until_negative: daysUntilNegative, recommendations };
}

function financialScore(transactions, f) {
  if (!transactions.length) return 50;
  let score = 50;
  if (f.balance > 0) score += 15;
  if (f.daily_avg > 0) score += 15;
  else if (f.daily_avg > -50) score += 5;
  if (f.trend === "growing") score += 10;
  else if (f.trend === "declining") score -= 10;
  if (f.daily_avg < 0 && f.balance > 0) {
    const runway = f.balance / Math.abs(f.daily_avg);
    if (runway > 180) score += 10;
    else if (runway > 90) score += 5;
    else score -= 5;
  }
  const income = transactions.filter(t => t.amount > 0).reduce((s,t) => s + t.amount, 0);
  const expense = Math.abs(transactions.filter(t => t.amount < 0).reduce((s,t) => s + t.amount, 0));
  if (income > 0 && expense / income < 0.7) score += 10;
  return Math.max(0, Math.min(100, score));
}

function generateInsights(transactions, f, risk) {
  const insights = [];
  if (["critico","alto"].includes(risk.level)) {
    insights.push({
      type: "risk", severity: "high",
      title: `Risco ${risk.level}`,
      message: risk.recommendations[0]
    });
  }
  const catSummary = summarizeByCategory(transactions.filter(t => t.amount < 0));
  if (catSummary.length) {
    const top = catSummary.reduce((a,b) => Math.abs(a.total) > Math.abs(b.total) ? a : b);
    insights.push({
      type: "top_category", severity: "info",
      title: `Maior gasto: ${top.category}`,
      message: `R$ ${Math.abs(top.total).toFixed(2)} em ${top.count} transações.`
    });
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
  const d60 = new Date(today); d60.setDate(d60.getDate() - 60);
  const recent = transactions.filter(t => new Date(t.date) > d30 && t.amount < 0);
  const older  = transactions.filter(t => { const dt = new Date(t.date); return dt <= d30 && dt > d60 && t.amount < 0; });
  if (recent.length && older.length) {
    const rTotal = Math.abs(recent.reduce((s,t) => s+t.amount, 0));
    const oTotal = Math.abs(older.reduce((s,t) => s+t.amount, 0));
    if (rTotal > oTotal * 1.2) {
      insights.push({
        type: "spike", severity: "warning",
        title: "Gastos subiram",
        message: `Aumento de ${((rTotal-oTotal)/oTotal*100).toFixed(0)}% nos últimos 30 dias vs mês anterior.`
      });
    }
  }
  const expenses = transactions.filter(t => t.amount < 0).map(t => Math.abs(t.amount));
  if (expenses.length > 10) {
    const avg = expenses.reduce((s,v) => s+v, 0) / expenses.length;
    const sd = Math.sqrt(expenses.reduce((s,v) => s + (v-avg)**2, 0) / expenses.length);
    const outliers = transactions.filter(t => t.amount < 0 && Math.abs(t.amount) > avg + 2*sd);
    if (outliers.length) {
      const biggest = outliers.reduce((a,b) => Math.abs(a.amount) > Math.abs(b.amount) ? a : b);
      insights.push({
        type: "outlier", severity: "warning",
        title: "Gasto atípico",
        message: `${biggest.description}: R$ ${Math.abs(biggest.amount).toFixed(2)} (fora do padrão).`
      });
    }
  }
  if (f.trend === "growing") {
    insights.push({
      type: "trend", severity: "success",
      title: "Tendência positiva",
      message: "Saldo crescendo nos últimos 45 dias. Bom momento para investir."
    });
  }
  return insights;
}

function consolidate(transactions, userRules = []) {
  transactions.forEach(t => { t.category = categorize(t.description, t.amount, userRules); });
  const recurringIds = detectRecurring(transactions);
  transactions.forEach(t => { t.is_recurring = recurringIds.has(t.id); });

  const forecast = advancedForecast(transactions);
  const risk = riskAssessment(forecast, transactions);
  const score = financialScore(transactions, forecast);
  const insights = generateInsights(transactions, forecast, risk);

  return {
    score, forecast, risk, insights,
    by_category: summarizeByCategory(transactions),
    monthly_flow: monthlyFlow(transactions),
    recurring_count: recurringIds.size,
    total_transactions: transactions.length
  };
}

window.FinanceAI = { categorize, consolidate, advancedForecast };
