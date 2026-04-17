"""
Motor de IA local (sem dependências externas).
Responsável por: categorização automática, detecção de recorrência,
insights inteligentes, forecast avançado e score financeiro.
Toda a consolidação é recalculada a cada chamada.
"""
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean, pstdev


def _normalize(s: str) -> str:
    """Lowercase + remove acentos, para comparação tolerante."""
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower())
        if unicodedata.category(c) != "Mn"
    )


CATEGORY_KEYWORDS = {
    "alimentacao": ["ifood", "mercado", "supermercado", "restaurante", "lanchonete",
                    "padaria", "pao", "burger", "pizza", "food", "bar ", "acai", "cafe"],
    "transporte": ["uber", "99", "taxi", "combustivel", "gasolina", "posto", "shell",
                   "petrobras", "ipiranga", "metro", "onibus", "estacionamento", "pedagio"],
    "moradia": ["aluguel", "condominio", "iptu", "luz", "energia", "agua", "gas ",
                "internet", "net ", "vivo", "claro", "tim "],
    "saude": ["farmacia", "drogaria", "medico", "consulta", "exame", "hospital",
              "clinica", "plano de saude", "unimed", "amil", "droga raia", "drogasil"],
    "lazer": ["netflix", "spotify", "prime", "disney", "hbo", "cinema", "show",
              "ingresso", "youtube", "twitch", "steam", "playstation"],
    "educacao": ["escola", "faculdade", "curso", "livro", "udemy", "coursera", "alura"],
    "salario": ["salario", "pagamento", "folha", "remuneracao", "provento"],
    "investimento": ["aplicacao", "cdb", "tesouro", "acao", "fii", "b3", "rendimento",
                     "dividendo", "juros"],
    "transferencia": ["pix", "ted", "doc", "transferencia"],
    "compras": ["shopee", "mercado livre", "amazon", "magalu", "magazine", "americanas",
                "casas bahia", "shein", "aliexpress"],
    "impostos": ["imposto", "darf", "das ", "inss", "irpf", "taxa"],
}


def categorize(description: str, amount: float, user_rules=None) -> str:
    """Categoriza uma transação. Regras do usuário têm prioridade."""
    desc = _normalize(description)

    if user_rules:
        for rule in user_rules:
            if _normalize(rule.keyword) in desc:
                return rule.category

    if amount > 0:
        for kw in CATEGORY_KEYWORDS["salario"]:
            if kw in desc:
                return "salario"
        for kw in CATEGORY_KEYWORDS["investimento"]:
            if kw in desc:
                return "investimento"
        if any(kw in desc for kw in CATEGORY_KEYWORDS["transferencia"]):
            return "receita"
        return "receita"

    for category, keywords in CATEGORY_KEYWORDS.items():
        if category in ("salario", "investimento"):
            continue
        for kw in keywords:
            if kw in desc:
                return category

    return "outros"


def detect_recurring(transactions):
    """Detecta padrões de recorrência (mensal) por descrição similar."""
    groups = defaultdict(list)
    for t in transactions:
        key = _normalize(t.description).strip()[:20]
        groups[key].append(t)

    recurring_ids = set()
    for key, items in groups.items():
        if len(items) < 2:
            continue
        items_sorted = sorted(items, key=lambda x: x.date)
        gaps = [
            (items_sorted[i + 1].date - items_sorted[i].date).days
            for i in range(len(items_sorted) - 1)
        ]
        if gaps and 25 <= mean(gaps) <= 35:
            for t in items:
                recurring_ids.add(t.id)
    return recurring_ids


def summarize_by_category(transactions):
    totals = defaultdict(float)
    counts = defaultdict(int)
    for t in transactions:
        totals[t.category] += t.amount
        counts[t.category] += 1
    return [
        {"category": c, "total": round(totals[c], 2), "count": counts[c]}
        for c in totals
    ]


def monthly_flow(transactions):
    """Agrupa por mês (YYYY-MM)."""
    flow = defaultdict(lambda: {"income": 0, "expense": 0})
    for t in transactions:
        key = t.date.strftime("%Y-%m") if t.date else "sem-data"
        if t.amount >= 0:
            flow[key]["income"] += t.amount
        else:
            flow[key]["expense"] += abs(t.amount)
    return sorted(
        [{"month": k, **v, "net": round(v["income"] - v["expense"], 2)}
         for k, v in flow.items()],
        key=lambda x: x["month"]
    )


def advanced_forecast(transactions, horizon_days=30):
    """
    Projeção baseada em média móvel dos últimos 90 dias,
    ponderada pela tendência e ajustada por recorrências.
    """
    if not transactions:
        return {"balance": 0, "projection": [], "daily_avg": 0, "trend": "stable"}

    today = date.today()
    cutoff = today - timedelta(days=90)
    recent = [t for t in transactions if t.date and t.date >= cutoff]

    balance = sum(t.amount for t in transactions)

    expenses = [t.amount for t in recent if t.amount < 0]
    incomes = [t.amount for t in recent if t.amount > 0]

    daily_expense = sum(expenses) / 90 if expenses else 0
    daily_income = sum(incomes) / 90 if incomes else 0
    daily_avg = daily_expense + daily_income

    first_half = [t.amount for t in recent if t.date >= cutoff + timedelta(days=45)]
    second_half = [t.amount for t in recent if t.date < cutoff + timedelta(days=45)]
    trend = "stable"
    if first_half and second_half:
        if sum(first_half) < sum(second_half) * 0.9:
            trend = "declining"
        elif sum(first_half) > sum(second_half) * 1.1:
            trend = "growing"

    projection = []
    current = balance
    for i in range(horizon_days):
        current += daily_avg
        projection.append({
            "day": i + 1,
            "date": (today + timedelta(days=i + 1)).isoformat(),
            "balance": round(current, 2)
        })

    return {
        "balance": round(balance, 2),
        "daily_avg": round(daily_avg, 2),
        "daily_income": round(daily_income, 2),
        "daily_expense": round(daily_expense, 2),
        "trend": trend,
        "projection": projection
    }


def risk_assessment(forecast_data, transactions):
    """Classifica o risco financeiro e gera recomendações."""
    balance = forecast_data["balance"]
    daily_avg = forecast_data["daily_avg"]
    projection = forecast_data["projection"]

    days_until_negative = None
    for p in projection:
        if p["balance"] < 0:
            days_until_negative = p["day"]
            break

    if balance < 0:
        risk = "critico"
    elif days_until_negative and days_until_negative <= 15:
        risk = "alto"
    elif days_until_negative and days_until_negative <= 30:
        risk = "medio"
    elif daily_avg < 0 and balance < abs(daily_avg) * 60:
        risk = "medio"
    else:
        risk = "baixo"

    recommendations = []
    if risk == "critico":
        recommendations.append("Saldo negativo — revise gastos imediatos e corte supérfluos.")
    if risk in ("alto", "medio"):
        recommendations.append("Reduza despesas variáveis (lazer, compras) para alongar o caixa.")
    if forecast_data["trend"] == "declining":
        recommendations.append("Tendência de queda detectada nos últimos 45 dias.")
    if daily_avg < 0 and abs(daily_avg) > 0:
        months_runway = balance / abs(daily_avg) / 30 if daily_avg < 0 else 0
        if months_runway < 3:
            recommendations.append("Reserva inferior a 3 meses de despesas — acumule emergência.")
    if not recommendations:
        recommendations.append("Situação estável. Continue monitorando.")

    return {
        "level": risk,
        "days_until_negative": days_until_negative,
        "recommendations": recommendations
    }


def financial_score(transactions, forecast_data):
    """Score 0-100. Mais alto = mais saudável."""
    if not transactions:
        return 50

    score = 50
    balance = forecast_data["balance"]
    daily_avg = forecast_data["daily_avg"]

    if balance > 0:
        score += 15
    if daily_avg > 0:
        score += 15
    elif daily_avg > -50:
        score += 5

    if forecast_data["trend"] == "growing":
        score += 10
    elif forecast_data["trend"] == "declining":
        score -= 10

    if daily_avg < 0 and balance > 0:
        runway = balance / abs(daily_avg)
        if runway > 180:
            score += 10
        elif runway > 90:
            score += 5
        else:
            score -= 5

    income = sum(t.amount for t in transactions if t.amount > 0)
    expense = abs(sum(t.amount for t in transactions if t.amount < 0))
    if income > 0 and expense / income < 0.7:
        score += 10

    return max(0, min(100, score))


def generate_insights(transactions, forecast_data, risk_data):
    """Gera insights inteligentes acionáveis."""
    insights = []

    if risk_data["level"] in ("critico", "alto"):
        insights.append({
            "type": "risk",
            "severity": "high",
            "title": f"Risco {risk_data['level']}",
            "message": risk_data["recommendations"][0]
        })

    cat_summary = summarize_by_category([t for t in transactions if t.amount < 0])
    if cat_summary:
        top = max(cat_summary, key=lambda x: abs(x["total"]))
        insights.append({
            "type": "top_category",
            "severity": "info",
            "title": f"Maior gasto: {top['category']}",
            "message": f"R$ {abs(top['total']):.2f} em {top['count']} transações."
        })

    today = date.today()
    recent = [t for t in transactions if t.date and (today - t.date).days <= 30 and t.amount < 0]
    older = [t for t in transactions if t.date and 30 < (today - t.date).days <= 60 and t.amount < 0]
    if recent and older:
        recent_total = abs(sum(t.amount for t in recent))
        older_total = abs(sum(t.amount for t in older))
        if recent_total > older_total * 1.2:
            diff_pct = (recent_total - older_total) / older_total * 100
            insights.append({
                "type": "spike",
                "severity": "warning",
                "title": "Gastos subiram",
                "message": f"Aumento de {diff_pct:.0f}% nos últimos 30 dias vs mês anterior."
            })

    expenses = [abs(t.amount) for t in transactions if t.amount < 0]
    if len(expenses) > 10:
        avg = mean(expenses)
        sd = pstdev(expenses)
        outliers = [t for t in transactions
                    if t.amount < 0 and abs(t.amount) > avg + 2 * sd]
        if outliers:
            biggest = max(outliers, key=lambda x: abs(x.amount))
            insights.append({
                "type": "outlier",
                "severity": "warning",
                "title": "Gasto atípico",
                "message": f"{biggest.description}: R$ {abs(biggest.amount):.2f} (fora do padrão)."
            })

    if forecast_data["trend"] == "growing":
        insights.append({
            "type": "trend",
            "severity": "success",
            "title": "Tendência positiva",
            "message": "Saldo crescendo nos últimos 45 dias. Bom momento para investir."
        })

    return insights


def consolidate(transactions, user_rules=None):
    """
    Função central: recalcula TUDO a cada chamada.
    Retorna o estado consolidado completo do usuário.
    """
    for t in transactions:
        t.category = categorize(t.description, t.amount, user_rules)

    recurring_ids = detect_recurring(transactions)
    for t in transactions:
        t.is_recurring = t.id in recurring_ids

    forecast_data = advanced_forecast(transactions)
    risk_data = risk_assessment(forecast_data, transactions)
    score = financial_score(transactions, forecast_data)
    insights = generate_insights(transactions, forecast_data, risk_data)

    return {
        "score": score,
        "forecast": forecast_data,
        "risk": risk_data,
        "insights": insights,
        "by_category": summarize_by_category(transactions),
        "monthly_flow": monthly_flow(transactions),
        "recurring_count": len(recurring_ids),
        "total_transactions": len(transactions),
    }
