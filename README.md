# 💰 Finance AI

Sistema de gestão financeira pessoal com **inteligência artificial local**, categorização automática, previsões e automação.

> **Nível:** produto MVP pronto para evolução — interface profissional + motor de IA + integração bancária.

---

## 🎯 O que este sistema faz

### Passo 1 — Profissional
- Dashboard moderno (TailwindCSS + Chart.js)
- KPIs: saldo, score financeiro (0-100), nível de risco, tendência
- Gráficos: projeção 30 dias, gastos por categoria, fluxo mensal
- Dark mode, responsivo, transições suaves
- Login/registro integrados

### Passo 2 — IA e automação
- **Categorização automática** por dicionário expandido (alimentação, transporte, moradia, saúde, lazer, educação, investimento…)
- **Detecção de recorrência**: identifica assinaturas e pagamentos mensais
- **Insights da IA**: picos de gasto, outliers estatísticos, tendências
- **Forecast avançado**: projeção ponderada com média móvel de 90 dias
- **Score financeiro**: avalia runway, tendência, relação receita/despesa
- **Regras personalizadas**: usuário cria `palavra → categoria` e o motor aplica em todas as transações
- **Metas** com acompanhamento de progresso

### Consolidação contínua
Toda operação que altera dados (nova transação, exclusão, sync bancário, criação de regra) aciona **re-consolidação completa**:
- Re-categoriza todas as transações
- Re-detecta recorrências
- Recalcula forecast + risco + score
- Regenera insights

---

## 📁 Estrutura

```
finance-ai/
├── backend/
│   ├── main.py          # API FastAPI (auth, CRUD, sync, dashboard)
│   ├── ai_engine.py     # Motor de IA (categorização, insights, forecast)
│   ├── database.py      # SQLAlchemy + SQLite/PostgreSQL
│   ├── models.py        # User, Transaction, Goal, Rule, Insight
│   ├── pluggy.py        # Integração Pluggy (Open Finance BR)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── index.html       # Dashboard único (SPA)
```

---

## 🚀 Como executar

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # edite conforme necessário
uvicorn main:app --reload
```
- API: http://localhost:8000
- Docs: http://localhost:8000/docs

### Frontend
Abra `frontend/index.html` no navegador. No campo "API do backend", deixe `http://localhost:8000`.

### Testar rapidamente
1. Crie conta na tela inicial
2. Clique **"Carregar demo"** no topo — gera 21 transações de exemplo
3. Navegue pelo dashboard: KPIs, gráficos, insights, metas e regras

---

## 🔌 Integração bancária (Pluggy)

Configure `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` no `.env`, então chame:
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

**Sem APIs externas** — todo processamento roda localmente em Python puro.

---

## 🔐 Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Cria conta |
| POST | `/auth/login` | Retorna JWT |
| GET | `/dashboard` | **Consolidação completa** (KPIs + gráficos + insights) |
| GET | `/transactions` | Lista transações |
| POST | `/transactions` | Cria transação (aciona consolidação) |
| DELETE | `/transactions/{id}` | Remove (aciona consolidação) |
| POST | `/sync` | Importa do Pluggy |
| GET/POST/DELETE | `/goals` | CRUD metas |
| GET/POST/DELETE | `/rules` | CRUD regras de automação |
| POST | `/reconsolidate` | Força re-consolidação manual |
| POST | `/demo` | Popula transações de exemplo |

Autenticação: header `Authorization: Bearer <token>`.

---

## 📌 Roadmap

- [ ] Mobile (PWA)
- [ ] Importação OFX/CSV manual
- [ ] Categorias customizadas via UI
- [ ] Exportação relatório PDF
- [ ] Integração com IA externa (LLM) para insights em linguagem natural
- [ ] Alertas proativos via push/email
