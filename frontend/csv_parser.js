/* Finance AI — CSV parser multi-banco (Brasil)
 *
 * Detecta formato automaticamente e normaliza para
 * { date, description, amount, currency }
 *
 * Bancos suportados:
 *  - Nubank (fatura cartão e conta)
 *  - Itaú
 *  - Bradesco
 *  - Santander
 *  - Banco do Brasil
 *  - Caixa
 *  - Inter
 *  - C6 Bank
 *  - Formato genérico: data,descrição,valor
 */

const FORMATS = [
  {
    name: "Nubank (cartão)",
    test: (h) => /date,title,amount/i.test(h) || /date,category,title,amount/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r.date),
      description: r.title || r.description || "",
      amount: -Math.abs(parseBR(r.amount))
    }))
  },
  {
    name: "Nubank (conta)",
    test: (h) => /^data,valor,identificador,descricao/i.test(h) || /^data.*identificador.*descri/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r.data),
      description: r.descricao || r["descrição"] || "",
      amount: parseBR(r.valor)
    }))
  },
  {
    name: "Itaú",
    test: (h) => /dt\./i.test(h) && /histórico|historico/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r["dt."] || r["data"]),
      description: r["histórico"] || r["historico"] || "",
      amount: parseBR(r["valor"] || r["valor (r$)"])
    }))
  },
  {
    name: "Bradesco",
    test: (h) => /data.*histórico.*valor/i.test(h) || /data.*lançamento/i.test(h),
    parse: (rows) => rows.map(r => {
      const credito = parseBR(r["crédito"] || r["credito"] || "");
      const debito = parseBR(r["débito"] || r["debito"] || "");
      let amount = parseBR(r.valor || "0");
      if (credito && !debito) amount = Math.abs(credito);
      else if (debito && !credito) amount = -Math.abs(debito);
      return {
        date: toIsoDate(r.data || r["data movimento"]),
        description: r["histórico"] || r["historico"] || r["lançamento"] || "",
        amount
      };
    })
  },
  {
    name: "Santander",
    test: (h) => /data.*descrição.*documento.*valor/i.test(h) || /santander/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r.data),
      description: r["descrição"] || r["descricao"] || "",
      amount: parseBR(r.valor)
    }))
  },
  {
    name: "Banco do Brasil",
    test: (h) => /data.*lançamento|data.*dependência/i.test(h) && /valor/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r.data),
      description: r["lançamento"] || r["histórico"] || r["descrição"] || "",
      amount: parseBR(r.valor)
    }))
  },
  {
    name: "Caixa",
    test: (h) => /data.*nr.*histórico.*valor/i.test(h) || /caixa/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r["data mov\\."] || r.data),
      description: r["histórico"] || r["historico"] || "",
      amount: parseBR(r.valor)
    }))
  },
  {
    name: "Inter",
    test: (h) => /data lançamento.*histórico.*descrição.*valor/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r["data lançamento"] || r["data inclusão"] || r.data),
      description: r["descrição"] || r["descricao"] || r["histórico"] || "",
      amount: parseBR(r.valor)
    }))
  },
  {
    name: "C6 Bank",
    test: (h) => /data transação.*descrição|data.*parcela.*valor \(us\$\)/i.test(h),
    parse: (rows) => rows.map(r => ({
      date: toIsoDate(r["data transação"] || r["data lançamento"] || r.data),
      description: r["descrição"] || r.descricao || "",
      amount: parseBR(r["valor (r$)"] || r.valor)
    }))
  },
  {
    name: "Genérico",
    test: () => true, // fallback
    parse: (rows, header) => {
      const cols = header.map(c => c.toLowerCase().trim());
      const dateIdx = cols.findIndex(c => /data|date/i.test(c));
      const descIdx = cols.findIndex(c => /descri|histór|title|label|memo/i.test(c));
      const amountIdx = cols.findIndex(c => /valor|amount|value/i.test(c));
      if (dateIdx < 0 || amountIdx < 0) return [];
      return rows.map(r => {
        const vals = Object.values(r);
        return {
          date: toIsoDate(vals[dateIdx]),
          description: descIdx >= 0 ? vals[descIdx] : "",
          amount: parseBR(vals[amountIdx])
        };
      });
    }
  }
];

function parseBR(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v).trim().replace(/R\$/g, "").replace(/\s+/g, "");
  // Formato BR: 1.234,56 — troca . por "" e , por .
  // Formato EN: 1,234.56 — troca , por ""
  let clean;
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    clean = s.replace(/\./g, "").replace(",", ".");
  } else {
    clean = s.replace(/,/g, "");
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function toIsoDate(s) {
  if (!s) return "";
  s = String(s).trim();
  // DD/MM/YYYY ou DD/MM/YY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return s;
}

/* Parser CSV simples (sem lib externa) — respeita aspas */
function parseCsv(text) {
  const lines = [];
  let cur = "", row = [], inQuotes = false;
  // Detecta separador: ; ou ,
  const sep = text.includes(";") && !text.match(/^[^;]+,[^;]+$/m) ? ";" : ",";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i+1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      row.push(cur); cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i+1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(v => v.length)) lines.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur || row.length) { row.push(cur); if (row.some(v => v.length)) lines.push(row); }
  return lines;
}

function detectAndParse(text) {
  const lines = parseCsv(text);
  if (lines.length < 2) return { format: null, transactions: [] };
  const header = lines[0].map(h => h.trim());
  const headerStr = header.join(",");

  const fmt = FORMATS.find(f => f.test(headerStr));
  const rows = lines.slice(1).map(cols => {
    const obj = {};
    header.forEach((h, i) => { obj[h.toLowerCase().trim()] = cols[i] || ""; });
    return obj;
  });

  let parsed;
  try { parsed = fmt.parse(rows, header); }
  catch (e) { console.warn("Parse error:", e); parsed = []; }
  parsed = (parsed || []).filter(t => t.date && (t.amount !== 0 || t.description));

  return { format: fmt.name, transactions: parsed };
}

async function importBulk(files, account_id) {
  const reports = [];
  for (const f of files) {
    try {
      const text = await f.text();
      const { format, transactions } = detectAndParse(text);
      const r = AI.reconcile(Store.data.transactions, transactions);
      for (const n of r.new) {
        Store.addTransaction({
          date: n.date, description: n.description, amount: n.amount,
          account_id, category_id: n.suggested_category,
          type: n.amount >= 0 ? "income" : "expense"
        });
      }
      reports.push({ file: f.name, format, total: transactions.length, new: r.new.length, dup: r.duplicates.length });
    } catch (e) {
      reports.push({ file: f.name, error: e.message });
    }
  }
  return reports;
}

window.CSVParser = { FORMATS, detectAndParse, parseCsv, parseBR, toIsoDate, importBulk };
