# 💎 Finance AI — Sistema de Gestão Financeira Pessoal

> Inspirado em Monarch Money, YNAB, Mobills e Copilot — tudo em português, 100% no navegador, com IA focada em **economia** e **investimento**.

**🌐 App online:** https://andersonassissouza.github.io/finance-ai/

---

## ✨ Módulos

| Módulo | Funcionalidades |
|--------|-----------------|
| 📊 **Dashboard** | Patrimônio líquido, score financeiro, insights IA, fluxo 6 meses, top categorias, vencimentos |
| 🏦 **Contas** | Múltiplas contas (corrente, poupança, carteira, investimento), saldo em tempo real |
| 💳 **Cartões** | Limite, vencimento, fechamento, fatura atual, uso por cartão |
| 📝 **Transações** | Despesa, receita, transferência, **parcelamento automático**, filtros |
| 🧮 **Orçamentos** | Limites mensais por categoria, alertas ao se aproximar do teto |
| 🎯 **Metas** | Com aporte mensal, estimativa de prazo, barra de progresso |
| 📉 **Dívidas** | Saldo, juros, comparação **avalanche vs snowball** (melhor estratégia) |
| 📈 **Investimentos** | Carteira, posição, rentabilidade por ativo |
| 💎 **Patrimônio** | Ativos vs passivos em tempo real |
| 💰 **Economizar** | Top oportunidades de corte, assinaturas detectadas, reserva de emergência |
| 🔥 **FIRE & Investir** | Número FIRE, projeção de independência, simulador juros compostos |
| 🔄 **Conciliar** | Importação CSV, JSON Pluggy, sincronização com backend Pluggy, dedup automática |
| 🤖 **Chat IA** | Perguntas em português: saldo, economia, FIRE, assinaturas, dívidas, cartões |
| ⚙️ **Configurações** | Tema, regras de categorização, export/import JSON |

---

## 🧠 Inteligência Artificial (local, sem API externa)

| Recurso | Como funciona |
|---------|---------------|
| **Categorização automática** | 17 regras regex + regras personalizadas do usuário |
| **Detecção de assinaturas** | Agrupa por descrição, analisa intervalo 25-40d + estabilidade do valor |
| **Oportunidades de economia** | Top gastos mensais com projeção de corte 10%/30% |
| **Reserva de emergência** | Despesa média × 6 vs patrimônio líquido |
| **Projeção FIRE (regra 4%)** | 25× despesa anual, projeção com juros compostos |
| **Estratégia de dívidas** | Simulação avalanche vs bola de neve, escolhe a que economiza mais juros |
| **Score financeiro 0-100** | Taxa de poupança, reserva, dívidas, investimentos, orçamentos |
| **Conciliação bancária** | Detecta duplicatas (descrição + valor + data ±2d), sugere categoria |
| **Insights proativos** | Picos de gasto, orçamento estourado, uso alto de cartão, trend analysis |
| **Chat em linguagem natural** | Intent-based: 15+ intents (saldo, gastos, FIRE, metas, dívidas…) |
| **Simulador juros compostos** | Parametrizável (inicial, aporte, taxa, anos) com gráfico |

---

## 🏦 Conciliação bancária (Pluggy)

Três modos de importação:

### 1. CSV simples (100% navegador)
`data,descrição,valor` — importa direto no localStorage.

### 2. JSON Pluggy (colar)
Exporte do Pluggy e cole. A IA detecta duplicatas e sugere categoria.

### 3. Backend Pluggy (sync automático)
Rode o backend FastAPI, configure `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env    # editar com credenciais Pluggy
uvicorn main:app --reload
```
No frontend, vá em **Conciliar → Backend Pluggy → Sincronizar** e informe seu Item ID.

---

## 📁 Estrutura

```
finance-ai/
├── frontend/                    # SPA 100% navegador (GitHub Pages)
│   ├── index.html               # Shell
│   ├── styles.css               # Design system próprio
│   ├── storage.js               # Modelo de dados completo (localStorage)
│   ├── ai_engine.js             # IA: insights, FIRE, reconcile, chat
│   └── app.js                   # Router + 14 views
├── backend/                     # API FastAPI (opcional, para Pluggy real)
│   ├── main.py                  # Rotas + /pluggy/fetch
│   ├── ai_engine.py
│   ├── models.py
│   ├── database.py
│   ├── pluggy.py
│   └── requirements.txt
├── start.bat / start.sh         # Setup + run local
├── index.html                   # Redirect raiz → /frontend/
└── README.md
```

---

## 🚀 Como rodar

### Opção A — Online (recomendado, sem instalar nada)
Abra https://andersonassissouza.github.io/finance-ai/

**Conta demo:** clique em "preencher com conta demo" na tela de login (email: `demo@finance.ai`, senha: `demo1234`). Crie, depois clique em "Dados demo" no dashboard para popular.

### Opção B — Local completo (com backend Pluggy)
```bash
# Windows
start.bat

# Linux / Mac
chmod +x start.sh && ./start.sh
```
- Frontend: `frontend/index.html`
- Backend: http://localhost:8000 (docs em `/docs`)

---

## 🔐 Privacidade

**Modo navegador (Pages):** dados ficam apenas no seu `localStorage`. Nada sai do computador. Exporte JSON para backup.

**Modo backend:** dados em SQLite/PostgreSQL local, senha via `pbkdf2_sha256`, JWT para sessão.

---

## 🛣️ Roadmap

- [ ] PWA (instalável offline)
- [ ] Sync multi-dispositivo (opt-in)
- [ ] IA externa (LLM) para insights mais ricos
- [ ] Conexão direta Open Finance BR
- [ ] Relatórios IRPF
- [ ] Compartilhamento de orçamento (família)
- [ ] Integração Telegram para alertas
