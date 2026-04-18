/* Finance AI — Integração com LLM externo
 * Suporta OpenAI, Anthropic, Groq (Llama), e endpoints compatíveis.
 * A API key é armazenada apenas no localStorage do usuário (nunca no servidor).
 */

const LLM_KEY = "fa_llm_config";

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(LLM_KEY)) || null; } catch { return null; }
}
function saveConfig(cfg) {
  if (cfg) localStorage.setItem(LLM_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(LLM_KEY);
}

const PROVIDERS = {
  openai: {
    name: "OpenAI (GPT-4o-mini)",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    format: "openai"
  },
  anthropic: {
    name: "Anthropic (Claude)",
    endpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-haiku-4-5",
    format: "anthropic"
  },
  groq: {
    name: "Groq (Llama 3 — muito rápido)",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    format: "openai"
  },
  custom: {
    name: "Custom (compatível OpenAI)",
    endpoint: "",
    defaultModel: "",
    format: "openai"
  }
};

function isConfigured() {
  const c = loadConfig();
  return !!(c && c.apiKey && c.provider);
}

function buildContext(Store) {
  const ms = Store.monthSummary();
  const nw = Store.netWorth();
  const top = AI.savingsOpportunities(Store).slice(0, 5);
  const subs = AI.subscriptions(Store).slice(0, 10);
  const goals = Store.goals();
  const ef = AI.emergencyFund(Store);
  const fire = AI.fireProjection(Store);
  const recentTx = Store.listTransactions({ limit: 15 });

  return `Você é um assistente financeiro pessoal especializado em economia e investimentos no Brasil.
Responda SEMPRE em português brasileiro, de forma concisa e prática.
Use os dados abaixo para contextualizar suas respostas. Se não houver dados suficientes, sugira o que o usuário pode fazer.

DADOS DO USUÁRIO:
- Patrimônio líquido: R$ ${nw.net.toFixed(2)} (ativos R$ ${nw.assets.toFixed(2)}, passivos R$ ${nw.liabilities.toFixed(2)})
- Receita mês: R$ ${ms.income.toFixed(2)} | Despesa: R$ ${ms.expense.toFixed(2)} | Saldo: R$ ${ms.net.toFixed(2)}
- Reserva de emergência: R$ ${ef.current.toFixed(2)} de R$ ${ef.target.toFixed(2)} (${ef.monthsCovered} meses cobertos)
- Projeção FIRE: ${fire.yearsToFire} anos (aporte atual R$ ${fire.monthlyContribution.toFixed(2)}/mês)
- Top gastos do mês: ${top.map(t => `${t.category}: R$${t.monthly.toFixed(0)}`).join(", ")}
- Assinaturas ativas: ${subs.length} totalizando R$ ${subs.reduce((s,x) => s+x.monthly, 0).toFixed(2)}/mês
- Metas: ${goals.map(g => `${g.name} (${((g.current_amount/g.target_amount)*100).toFixed(0)}%)`).join(", ") || "nenhuma"}

ÚLTIMAS 15 TRANSAÇÕES:
${recentTx.map(t => `${t.date} | ${t.description} | R$ ${t.amount.toFixed(2)}`).join("\n")}

Diretrizes:
1. Seja objetivo e prático, recomende ações concretas.
2. Para investimentos, foque em renda fixa (Tesouro, CDB) antes de renda variável.
3. Para economia, identifique oportunidades de corte no top gastos.
4. Use formatação Markdown leve (negrito, listas).
5. Se o usuário perguntar algo fora de finanças, redirecione gentilmente.`;
}

async function ask(Store, question) {
  const cfg = loadConfig();
  if (!cfg || !cfg.apiKey) {
    return AI.chat(Store, question); // Fallback local
  }

  const provider = PROVIDERS[cfg.provider];
  if (!provider) throw new Error("Provedor inválido");

  const systemPrompt = buildContext(Store);
  const endpoint = cfg.endpoint || provider.endpoint;
  const model = cfg.model || provider.defaultModel;

  try {
    if (provider.format === "anthropic") {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: question }]
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      return j.content?.[0]?.text || "Sem resposta.";
    } else {
      // OpenAI-compatible (OpenAI, Groq, custom)
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
          max_tokens: 1024,
          temperature: 0.3
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      return j.choices?.[0]?.message?.content || "Sem resposta.";
    }
  } catch (e) {
    console.warn("LLM:", e);
    return formatLlmError(e, cfg.provider) + "\n\n---\n" + AI.chat(Store, question);
  }
}

function formatLlmError(e, providerId) {
  const raw = e?.message || String(e);
  let friendly = "";
  // Tenta extrair mensagem de dentro do JSON
  let innerMsg = raw;
  try {
    const parsed = JSON.parse(raw);
    innerMsg = parsed?.error?.message || parsed?.message || raw;
  } catch {}
  const lower = innerMsg.toLowerCase();

  if (lower.includes("credit balance") || lower.includes("billing") || lower.includes("insufficient_quota") || lower.includes("quota")) {
    const provName = PROVIDERS[providerId]?.name || providerId;
    friendly = `💳 **Saldo insuficiente no ${provName}.** Adicione créditos no painel do provedor ou troque para outro em *Configurações → LLM*. ` +
               `Sugestão: **Groq** tem camada gratuita generosa para Llama 3.`;
  } else if (lower.includes("invalid") && (lower.includes("api") || lower.includes("key") || lower.includes("authentication"))) {
    friendly = `🔑 **API Key inválida.** Verifique a chave em *Configurações → LLM*.`;
  } else if (lower.includes("rate") || lower.includes("429")) {
    friendly = `⏱️ **Rate limit atingido.** Aguarde alguns segundos e tente novamente.`;
  } else if (lower.includes("model") && lower.includes("not") && lower.includes("found")) {
    friendly = `🤖 **Modelo não encontrado.** Atualize o nome do modelo em *Configurações → LLM*.`;
  } else {
    // Mensagem curta e limpa, sem JSON cru
    const short = innerMsg.length > 140 ? innerMsg.slice(0, 140) + "…" : innerMsg;
    friendly = `⚠️ LLM indisponível (${short})`;
  }
  return friendly + "\n\nUsando resposta local por enquanto:";
}

function configure({ provider, apiKey, model, endpoint }) {
  saveConfig({ provider, apiKey, model: model || null, endpoint: endpoint || null });
}
function disconnect() { saveConfig(null); }
function info() { return loadConfig(); }

window.LLM = { PROVIDERS, ask, configure, disconnect, info, isConfigured, loadConfig };
