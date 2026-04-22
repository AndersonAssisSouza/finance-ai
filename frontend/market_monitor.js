/* Finance AI — Monitor de Mercado
 *
 * Busca indicadores econômicos do Brasil e avalia se o cenário está
 * favorável para perfis de maior risco (Mix 40/60).
 *
 * Fontes grátis (sem token):
 *  - BrasilAPI (Selic, CDI, IPCA)
 *  - AwesomeAPI (USD/BRL com histórico)
 *  - Bacen SGS (séries históricas oficiais)
 *
 * Observação: Ibovespa exige token na maioria das APIs grátis (Brapi mudou).
 * Por isso avaliamos o CENÁRIO MACRO (Selic alta + USD volátil = ruim pra RV).
 */

const MM_KEY = "fa_market_monitor";
const MM_TTL = 1000 * 60 * 60 * 4; // 4h

function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(MM_KEY)) || {};
    if (Date.now() - (c.ts || 0) > MM_TTL) return null;
    return c;
  } catch { return null; }
}
function saveCache(data) {
  localStorage.setItem(MM_KEY, JSON.stringify({ ts: Date.now(), ...data }));
}

async function fetchTaxas() {
  try {
    const r = await fetch("https://brasilapi.com.br/api/taxas/v1");
    if (!r.ok) return null;
    const arr = await r.json();
    const out = {};
    for (const item of arr) out[item.nome.toLowerCase()] = item.valor;
    return out; // { selic, cdi, ipca }
  } catch (e) { return null; }
}

async function fetchUsdHistory() {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/daily/USD-BRL/30");
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr.length) return null;
    const atual = parseFloat(arr[0].bid);
    const antigo = parseFloat(arr[arr.length - 1].bid);
    const variacao = ((atual / antigo) - 1) * 100;
    const max30 = Math.max(...arr.map(x => parseFloat(x.high)));
    const min30 = Math.min(...arr.map(x => parseFloat(x.low)));
    const volatilidade = ((max30 - min30) / min30) * 100;
    return { atual, variacao_30d: variacao, volatilidade_30d: volatilidade };
  } catch { return null; }
}

async function fetchIbovSerie() {
  // BCB série 7 = Ibovespa (mas pode estar desatualizada).
  // Tentamos ainda, e se falhar, seguimos sem Ibov.
  try {
    const r = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.7/dados/ultimos/20?formato=json");
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr.length) return null;
    // Verifica se dado é recente (<= 30 dias)
    const [dia, mes, ano] = arr[arr.length - 1].data.split("/");
    const ultimaData = new Date(`${ano}-${mes}-${dia}`);
    const diasDesde = (Date.now() - ultimaData) / 86400000;
    if (diasDesde > 30) return null;
    const atual = parseFloat(arr[arr.length - 1].valor);
    const antigo = parseFloat(arr[0].valor);
    return { atual, variacao_20d: ((atual/antigo) - 1) * 100 };
  } catch { return null; }
}

async function fetchAll() {
  const cached = loadCache();
  if (cached?.taxas) return cached;
  const [taxas, usd, ibov] = await Promise.all([
    fetchTaxas(),
    fetchUsdHistory(),
    fetchIbovSerie()
  ]);
  const data = { taxas, usd, ibov };
  saveCache(data);
  return data;
}

/**
 * Avalia cenário para Mix 60 (60% RV + 40% RF).
 *
 * Lógica: cenário BOM para RV quando
 *  - Selic baixa/caindo (< 11%)
 *  - Dólar estável (volatilidade < 10%)
 *  - IPCA controlado (< 5%)
 *  - Ibov (se disponível) subindo
 *
 * Cenário RUIM
 *  - Selic > 14% (juro matando bolsa)
 *  - Dólar disparando (fuga para exterior)
 *  - IPCA > 7% (inflação fora de controle)
 *  - Ibov caindo >10% em 20 dias
 */
function assess(data) {
  if (!data?.taxas) {
    return { status: "indisponivel", score: 0, motivos: ["Sem dados de mercado"] };
  }

  let score = 0;
  const motivos = [];
  const m = [];

  // SELIC
  const selic = data.taxas.selic;
  if (selic !== undefined) {
    if (selic > 15) { score -= 30; motivos.push(`🔴 Selic muito alta (${selic}%) — renda fixa domina`); }
    else if (selic > 13) { score -= 15; motivos.push(`🟠 Selic alta (${selic}%) — bolsa perde atratividade`); }
    else if (selic >= 10) { score += 0; motivos.push(`🟡 Selic em nível neutro (${selic}%)`); }
    else if (selic >= 7) { score += 15; motivos.push(`🟢 Selic baixa (${selic}%) — favorece bolsa`); }
    else { score += 25; motivos.push(`🟢 Selic muito baixa (${selic}%) — ideal pra RV`); }
  }

  // IPCA
  const ipca = data.taxas.ipca;
  if (ipca !== undefined) {
    if (ipca > 7) { score -= 20; motivos.push(`🔴 IPCA alto (${ipca}%) — pressão inflacionária`); }
    else if (ipca > 5) { score -= 5; motivos.push(`🟡 IPCA acima da meta (${ipca}%)`); }
    else if (ipca < 3.5) { score += 5; motivos.push(`🟢 IPCA controlado (${ipca}%)`); }
  }

  // DÓLAR (volatilidade)
  if (data.usd) {
    const u = data.usd;
    if (u.variacao_30d > 5) { score -= 15; motivos.push(`🔴 Dólar subiu ${u.variacao_30d.toFixed(1)}% em 30d`); }
    else if (u.variacao_30d < -3) { score += 10; motivos.push(`🟢 Dólar caindo (${u.variacao_30d.toFixed(1)}% em 30d) — bolsa tende a subir`); }
    if (u.volatilidade_30d > 10) { score -= 10; motivos.push(`⚠️ Alta volatilidade cambial (${u.volatilidade_30d.toFixed(1)}%)`); }
  }

  // IBOV (se dispo)
  if (data.ibov?.variacao_20d !== undefined) {
    const v = data.ibov.variacao_20d;
    if (v < -10) { score -= 30; motivos.push(`📉 Ibov caiu ${v.toFixed(1)}% em 20 pregões`); }
    else if (v < -5) { score -= 15; motivos.push(`📉 Ibov negativo no mês (${v.toFixed(1)}%)`); }
    else if (v > 10) { score += 20; motivos.push(`📈 Ibov +${v.toFixed(1)}% em 20 pregões`); }
    else if (v > 5) { score += 10; motivos.push(`📈 Ibov positivo no mês (+${v.toFixed(1)}%)`); }
  }

  let status;
  if (score >= 25) status = "excelente";
  else if (score >= 10) status = "bom";
  else if (score >= -10) status = "neutro";
  else if (score >= -25) status = "atencao";
  else status = "ruim";

  return { status, score, motivos };
}

function recomendacao(status) {
  switch (status) {
    case "excelente":
      return "🚀 Cenário macro muito positivo. Se pensa em aporte extra, momento favorável pra Mix 60.";
    case "bom":
      return "✅ Cenário favorável. Continue DCA (aporte mensal). Mix 60 deve performar bem.";
    case "neutro":
      return "⚖️ Cenário neutro. Mantenha disciplina do aporte mensal. Sem ações especiais.";
    case "atencao":
      return "⚠️ Sinais de fraqueza no cenário. DCA continua — aporte mensal compra barato. Evite aportar valor EXTRA agora. Se a migração pra Mix 60 ainda está planejada, espere 1-2 meses.";
    case "ruim":
      return "🚨 Cenário macro ruim. Mix 60 vai sofrer no curto prazo. NÃO PARE os aportes mensais — volatilidade beneficia DCA. Se está estressado com quedas, considere ficar no Mix 40 (menos exposto).";
    default:
      return "Dados de mercado indisponíveis. Mantém estratégia.";
  }
}

async function check() {
  const data = await fetchAll();
  const assessment = assess(data);
  return { ...data, assessment, recomendacao: recomendacao(assessment.status) };
}

async function checkAndNotify() {
  const r = await check();
  if (!["atencao", "ruim"].includes(r.assessment.status)) {
    return { sent: false, status: r.assessment.status };
  }

  const topic = window.Store?.data?.settings?.channels?.ntfy?.topic;
  if (!topic) return { sent: false, reason: "ntfy não configurado" };

  const today = new Date().toISOString().slice(0, 10);
  const lastNotif = localStorage.getItem("fa_mm_last_notif");
  if (lastNotif === today + "_" + r.assessment.status) {
    return { sent: false, reason: "já notificado hoje com este status" };
  }

  const title = r.assessment.status === "ruim"
    ? "🚨 Mercado RUIM para Mix 60"
    : "⚠️ Mercado em ATENÇÃO";

  const body = r.assessment.motivos.slice(0, 3).join("\n") + "\n\n" + r.recomendacao;

  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        "Title": title,
        "Priority": r.assessment.status === "ruim" ? "high" : "default",
        "Tags": "warning,chart_with_downwards_trend",
        "Click": "https://andersonassissouza.github.io/finance-ai/frontend/#/fire"
      },
      body: body
    });
    localStorage.setItem("fa_mm_last_notif", today + "_" + r.assessment.status);
    return { sent: true, status: r.assessment.status };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

function start() {
  setTimeout(() => { checkAndNotify().catch(() => {}); }, 5000);
  setInterval(() => { checkAndNotify().catch(() => {}); }, 1000 * 60 * 60 * 4);
}

window.MarketMonitor = { fetchAll, assess, check, checkAndNotify, start };
