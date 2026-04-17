/* Finance AI — Multi-moeda
 * Cotações via exchangerate.host (gratuito, sem API key)
 * Fallback: frankfurter.app
 * Cache local de 12 horas.
 */

const FX_CACHE_KEY = "fa_fx_cache";
const FX_CACHE_TTL = 1000 * 60 * 60 * 12; // 12h

const SUPPORTED = [
  { code: "BRL", name: "Real (R$)",          symbol: "R$" },
  { code: "USD", name: "Dólar (US$)",        symbol: "$" },
  { code: "EUR", name: "Euro (€)",           symbol: "€" },
  { code: "GBP", name: "Libra (£)",          symbol: "£" },
  { code: "JPY", name: "Iene japonês (¥)",   symbol: "¥" },
  { code: "ARS", name: "Peso argentino",     symbol: "$" },
  { code: "CAD", name: "Dólar canadense",    symbol: "C$" },
  { code: "AUD", name: "Dólar australiano",  symbol: "A$" },
  { code: "CHF", name: "Franco suíço",       symbol: "Fr" },
  { code: "CNY", name: "Yuan chinês",        symbol: "¥" },
  { code: "CLP", name: "Peso chileno",       symbol: "$" },
  { code: "MXN", name: "Peso mexicano",      symbol: "$" },
  { code: "UYU", name: "Peso uruguaio",      symbol: "$U" },
];

function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(FX_CACHE_KEY)) || {};
    if (Date.now() - (c.ts || 0) > FX_CACHE_TTL) return null;
    return c.rates || null;
  } catch { return null; }
}
function saveCache(rates) {
  localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ ts: Date.now(), rates }));
}

async function fetchRates(base = "BRL") {
  const cached = loadCache();
  if (cached && cached.base === base) return cached;

  // Tentativa 1: exchangerate.host
  try {
    const r = await fetch(`https://api.exchangerate.host/latest?base=${base}`);
    if (r.ok) {
      const j = await r.json();
      if (j.rates && Object.keys(j.rates).length) {
        const out = { base, rates: j.rates, date: j.date, source: "exchangerate.host" };
        saveCache(out);
        return out;
      }
    }
  } catch (e) { console.warn("exchangerate.host:", e.message); }

  // Tentativa 2: frankfurter.app (só moedas principais)
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
    if (r.ok) {
      const j = await r.json();
      const out = { base, rates: { ...j.rates, [base]: 1 }, date: j.date, source: "frankfurter" };
      saveCache(out);
      return out;
    }
  } catch (e) { console.warn("frankfurter:", e.message); }

  // Tentativa 3: taxas fallback hard-coded (aproximadas)
  const fallback = {
    BRL: { USD: 0.2, EUR: 0.18, GBP: 0.15, JPY: 30, ARS: 200, BRL: 1 },
    USD: { BRL: 5.0, EUR: 0.92, GBP: 0.78, JPY: 150, USD: 1 },
    EUR: { BRL: 5.4, USD: 1.08, GBP: 0.85, JPY: 162, EUR: 1 },
  };
  return { base, rates: fallback[base] || fallback.BRL, date: "fallback", source: "offline" };
}

async function convert(amount, from, to) {
  if (from === to) return amount;
  const data = await fetchRates(from);
  const rate = data.rates[to];
  if (!rate) throw new Error(`Taxa ${from}->${to} indisponível`);
  return amount * rate;
}

/** Converte valor da moeda da conta para moeda base do usuário (sync se cache). */
function convertSync(amount, from, to) {
  if (from === to) return amount;
  const cached = loadCache();
  if (!cached) return amount; // sem conversão se offline
  if (cached.base === from) {
    const rate = cached.rates[to];
    return rate ? amount * rate : amount;
  }
  if (cached.base === to) {
    const rate = cached.rates[from];
    return rate ? amount / rate : amount;
  }
  // Triangulação: from -> cacheBase -> to
  const rFrom = cached.rates[from];
  const rTo = cached.rates[to];
  if (rFrom && rTo) return amount / rFrom * rTo;
  return amount;
}

function symbol(code) {
  return SUPPORTED.find(s => s.code === code)?.symbol || code;
}
function format(amount, code = "BRL") {
  try {
    return amount.toLocaleString("pt-BR", { style: "currency", currency: code });
  } catch {
    return `${symbol(code)} ${amount.toFixed(2)}`;
  }
}

function isMultiCurrency() {
  if (!window.Store?.accounts) return false;
  const currencies = new Set(Store.accounts().map(a => a.currency || "BRL"));
  return currencies.size > 1;
}

function userCurrency() {
  return window.Store?.data?.settings?.currency || "BRL";
}

async function preloadRates() {
  const base = userCurrency();
  try { await fetchRates(base); } catch {}
}

window.FX = { SUPPORTED, fetchRates, convert, convertSync, symbol, format, isMultiCurrency, userCurrency, preloadRates };
