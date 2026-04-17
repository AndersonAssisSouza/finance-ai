# 💰 Finance AI

Sistema de gestão financeira pessoal com **inteligência artificial local**, categorização automática, previsões e automação.

**🌐 App online (GitHub Pages):** https://andersonassissouza.github.io/finance-ai/

> **Dual-mode:** funciona 100% no navegador (localStorage + IA em JS) OU com backend FastAPI completo (SQLite/PostgreSQL + Pluggy). O frontend detecta e escolhe automaticamente.

---

## 🎯 O que este sistema faz

### Passo 1 — Profissional
- Dashboard moderno (TailwindCSS + Chart.js)
- KPIs: saldo, score financeiro (0-100), nível de risco, tendência
- Gráficos: projeção 30 dias, gastos por categoria, fluxo mensal
- Dark mode, responsivo, transições suaves
- Login/registro integrados

### Passo 2 — IA e automação
- **Categorização automática** por dicionário expandido (11 categorias)
- **Detecção de recorrência**: identifica assinaturas e pagamentos mensais
- **Insights da IA**: picos de gasto, outliers estatísticos, tendências
- **Forecast avançado**: projeção ponderada com média móvel de 90 dias
- **Score financeiro**: avalia runway, tendência, relação receita/despesa
- **Regras personalizadas**: `palavra → categoria` aplicada a todas as transações
- **Metas** com acompanhamento de progresso

### Consolidação contínua
Toda operação que altera dados aciona **re-consolidação completa**: re-categoriza, re-detecta recorrências, recalcula forecast/risco/score, regenera insights.

---

## 📁 Estrutura

```
finance-ai/
├── backend/                # API FastAPI (opcional)
│   ├── main.py
│   ├── ai_engine.py
│   ├── database.py
│   ├── models.py
│   ├── pluggy.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html          # SPA principal
│   ├── ai_engine.js        # Motor de IA em JS (modo offline)
│   └── storage.js          # Camada dual (API ↔ localStorage)
├── start.bat               # Setup e execução local (Windows)
├── start.sh                # Setup e execução local (Linux/Mac)
└── index.html              # Redirect raiz para GitHub Pages
```

---

## 🚀 Como executar

### Modo 1 — 100% no navegador (sem instalação)
Abra https://andersonassissouza.github.io/finance-ai/ e use. Dados ficam no seu `localStorage` e o motor de IA roda em JavaScript no browser.

### Modo 2 — Local completo (com backend FastAPI)

**Windows:**
```cmd
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

O script cria venv, instala dependências, copia `.env.example` e inicia:
- Backend em http://localhost:8000 (docs: `/docs`)
- Frontend abre automaticamente no navegador

Se preferir manual:
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate  |  Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

### Como o frontend escolhe o modo
1. Tenta `GET {API}/` (default: `http://localhost:8000`) em até 1,5s
2. Respondeu → **modo API** (backend Python)
3. Timeout → **modo local** (localStorage)

O badge no topo mostra qual modo está ativo.

### Testar rapidamente
1. Abrir o app (online ou local)
2. Criar conta
3. Clicar **"Carregar demo"** — 21 transações de exemplo
4. Explorar KPIs, gráficos, insights, metas e regras

---

## 🔌 Integração bancária (Pluggy)

Modo API apenas. Configure `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` em `backend/.env`:
```bash
POST /sync  { "item_id": "<item_id_do_pluggy>" }
```

---

## 🧠 Como a IA funciona

| Componente | Abordagem |
|------------|-----------|
| Categorização | Dicionário de palavras-chave + regras do usuário (prioridade) |
| Recorrência | Agrupamento por descrição + análise de gaps 25-35 dias |
| Forecast | Média móvel 90d ponderada por tendência |
| Risco | Classificação em 4 níveis (crítico/alto/médio/baixo) |
| Score | 0-100 considerando saldo, runway, tendência, ratio receita/despesa |
| Outliers | Detecção por desvio-padrão (> μ + 2σ) |
| Spike | Comparação últimos 30d vs 30-60d anteriores |

**Sem APIs externas.** Processamento 100% local — em Python (backend) ou JavaScript (browser). Mesmo algoritmo nos dois lados.

---

## 🔐 Endpoints principais (modo API)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Cria conta |
| POST | `/auth/login` | Retorna JWT |
| GET | `/dashboard` | **Consolidação completa** |
| GET/POST/DELETE | `/transactions` | CRUD transações (aciona consolidação) |
| POST | `/sync` | Importa do Pluggy |
| GET/POST/DELETE | `/goals` | CRUD metas |
| GET/POST/DELETE | `/rules` | CRUD regras de automação |
| POST | `/reconsolidate` | Força re-consolidação |
| POST | `/demo` | Popula transações de exemplo |

Autenticação: header `Authorization: Bearer <token>`.

---

## 📌 Roadmap

- [ ] Mobile (PWA)
- [ ] Importação OFX/CSV manual
- [ ] Sincronização cloud dos dados do modo local
- [ ] Exportação relatório PDF
- [ ] Integração com IA externa (LLM) para insights em linguagem natural
- [ ] Alertas proativos via push/email
