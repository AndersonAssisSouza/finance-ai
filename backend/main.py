"""
Finance AI — API central.
Princípio: toda operação que altera dados aciona consolidação completa.
"""
import os
import uuid
from datetime import datetime, timedelta, date

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import SessionLocal, Base, engine, get_db
from models import User, Transaction, Goal, Rule, Insight
from ai_engine import consolidate, categorize
from pluggy import get_api_key, get_accounts, get_transactions

load_dotenv()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finance AI", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGO = "HS256"
pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


# ---------------- Schemas ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TransactionIn(BaseModel):
    description: str
    amount: float
    date: str | None = None
    category: str | None = None


class GoalIn(BaseModel):
    name: str
    target_amount: float
    deadline: str | None = None


class RuleIn(BaseModel):
    keyword: str
    category: str


class SyncIn(BaseModel):
    item_id: str


# ---------------- Auth ----------------
def create_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(hours=12)},
        SECRET, algorithm=ALGO
    )


def current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization:
        raise HTTPException(401, "Token ausente")
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        user_id = payload["sub"]
    except JWTError:
        raise HTTPException(401, "Token inválido")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(401, "Usuário inexistente")
    return user


def run_consolidation(db: Session, user: User) -> dict:
    """Executa consolidação e persiste alterações (categorias/recorrência)."""
    txs = db.query(Transaction).filter_by(user_id=user.id).all()
    rules = db.query(Rule).filter_by(user_id=user.id).all()
    result = consolidate(txs, user_rules=rules)

    db.query(Insight).filter_by(user_id=user.id).delete()
    for ins in result["insights"]:
        db.add(Insight(
            user_id=user.id, type=ins["type"], severity=ins["severity"],
            title=ins["title"], message=ins["message"]
        ))
    db.commit()
    return result


# ---------------- Health ----------------
@app.get("/")
def root():
    return {"app": "Finance AI", "version": "2.0", "status": "ok"}


# ---------------- Auth endpoints ----------------
@app.post("/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=data.email).first():
        raise HTTPException(400, "Email já cadastrado")
    user = User(
        id=str(uuid.uuid4()),
        email=data.email,
        password=pwd.hash(data.password),
        name=data.name or data.email.split("@")[0]
    )
    db.add(user)
    db.commit()
    return {"ok": True, "token": create_token(user.id), "user": {"email": user.email, "name": user.name}}


@app.post("/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=data.email).first()
    if not user or not pwd.verify(data.password, user.password):
        raise HTTPException(401, "Credenciais inválidas")
    return {"token": create_token(user.id), "user": {"email": user.email, "name": user.name}}


@app.get("/me")
def me(user: User = Depends(current_user)):
    return {"email": user.email, "name": user.name}


# ---------------- Transações ----------------
@app.get("/transactions")
def list_transactions(
    limit: int = 200,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    txs = (db.query(Transaction)
             .filter_by(user_id=user.id)
             .order_by(Transaction.date.desc())
             .limit(limit).all())
    return [{
        "id": t.id,
        "description": t.description,
        "amount": t.amount,
        "date": t.date.isoformat() if t.date else None,
        "category": t.category,
        "is_recurring": t.is_recurring,
        "source": t.source
    } for t in txs]


@app.post("/transactions")
def create_transaction(
    data: TransactionIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    tx_date = date.fromisoformat(data.date) if data.date else date.today()
    rules = db.query(Rule).filter_by(user_id=user.id).all()
    cat = data.category or categorize(data.description, data.amount, rules)
    tx = Transaction(
        id=str(uuid.uuid4()),
        user_id=user.id,
        description=data.description,
        amount=data.amount,
        date=tx_date,
        category=cat,
        source="manual"
    )
    db.add(tx)
    db.commit()
    run_consolidation(db, user)
    return {"ok": True, "id": tx.id}


@app.delete("/transactions/{tx_id}")
def delete_transaction(
    tx_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter_by(id=tx_id, user_id=user.id).first()
    if not tx:
        raise HTTPException(404, "Transação não encontrada")
    db.delete(tx)
    db.commit()
    run_consolidation(db, user)
    return {"ok": True}


# ---------------- Pluggy ----------------
@app.post("/pluggy/connect-token")
def pluggy_connect_token():
    """Gera Connect Token para o Pluggy Widget no frontend.
    Sem autenticação de usuário — use apenas localmente ou com CORS restrito."""
    import requests as rq
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(400, "Pluggy não configurado")
    try:
        r = rq.post("https://api.pluggy.ai/connect_token",
                    headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"options": {"clientUserId": "finance-ai-user"}},
                    timeout=10)
        r.raise_for_status()
        return {"accessToken": r.json().get("accessToken")}
    except Exception as e:
        raise HTTPException(502, f"Falha ao gerar connect token: {e}")


@app.post("/pluggy/fetch")
def pluggy_fetch(data: SyncIn):
    """Busca transações do Pluggy e retorna (sem persistir).
    Usado pelo frontend local para reconciliação no storage do browser."""
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(400, "Pluggy não configurado. Defina PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET")
    out_accounts = []
    out_txs = []
    try:
        accounts = get_accounts(api_key, data.item_id)
        for acc in accounts.get("results", []):
            out_accounts.append({
                "id": acc["id"], "name": acc.get("name"),
                "type": acc.get("type"), "balance": acc.get("balance")
            })
            txs = get_transactions(api_key, acc["id"])
            for t in txs.get("results", []):
                out_txs.append({
                    "id": t["id"], "account_id": acc["id"],
                    "date": t["date"][:10],
                    "description": t.get("description") or t.get("descriptionRaw", ""),
                    "amount": t.get("amount", 0),
                    "currency": t.get("currencyCode", "BRL"),
                    "type": "income" if t.get("amount", 0) > 0 else "expense"
                })
    except Exception as e:
        raise HTTPException(502, f"Falha ao buscar no Pluggy: {e}")
    return {"accounts": out_accounts, "transactions": out_txs}


@app.post("/sync")
def sync(
    data: SyncIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(400, "Pluggy não configurado. Defina PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET")
    accounts = get_accounts(api_key, data.item_id)
    imported = 0
    rules = db.query(Rule).filter_by(user_id=user.id).all()
    for acc in accounts.get("results", []):
        txs = get_transactions(api_key, acc["id"])
        for t in txs.get("results", []):
            if db.query(Transaction).filter_by(id=t["id"]).first():
                continue
            tx_date = datetime.fromisoformat(t["date"].replace("Z", "")).date()
            db.add(Transaction(
                id=t["id"],
                user_id=user.id,
                description=t.get("description", ""),
                amount=t.get("amount", 0),
                date=tx_date,
                category=categorize(t.get("description", ""), t.get("amount", 0), rules),
                source="pluggy"
            ))
            imported += 1
    db.commit()
    run_consolidation(db, user)
    return {"ok": True, "imported": imported}


# ---------------- Consolidação / Dashboard ----------------
@app.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    result = run_consolidation(db, user)
    goals = db.query(Goal).filter_by(user_id=user.id).all()
    result["goals"] = [{
        "id": g.id, "name": g.name,
        "target": g.target_amount, "current": g.current_amount,
        "deadline": g.deadline.isoformat() if g.deadline else None,
        "progress": round((g.current_amount / g.target_amount * 100) if g.target_amount else 0, 1)
    } for g in goals]
    result["user"] = {"email": user.email, "name": user.name}
    return result


@app.post("/reconsolidate")
def reconsolidate(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return run_consolidation(db, user)


# ---------------- Metas ----------------
@app.get("/goals")
def list_goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    goals = db.query(Goal).filter_by(user_id=user.id).all()
    return [{
        "id": g.id, "name": g.name,
        "target": g.target_amount, "current": g.current_amount,
        "deadline": g.deadline.isoformat() if g.deadline else None
    } for g in goals]


@app.post("/goals")
def create_goal(
    data: GoalIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    g = Goal(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=data.name,
        target_amount=data.target_amount,
        deadline=date.fromisoformat(data.deadline) if data.deadline else None
    )
    db.add(g)
    db.commit()
    return {"ok": True, "id": g.id}


@app.delete("/goals/{goal_id}")
def delete_goal(
    goal_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    g = db.query(Goal).filter_by(id=goal_id, user_id=user.id).first()
    if not g:
        raise HTTPException(404)
    db.delete(g)
    db.commit()
    return {"ok": True}


# ---------------- Regras (automação) ----------------
@app.get("/rules")
def list_rules(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rules = db.query(Rule).filter_by(user_id=user.id).all()
    return [{"id": r.id, "keyword": r.keyword, "category": r.category} for r in rules]


@app.post("/rules")
def create_rule(
    data: RuleIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    r = Rule(
        id=str(uuid.uuid4()),
        user_id=user.id,
        keyword=data.keyword,
        category=data.category
    )
    db.add(r)
    db.commit()
    run_consolidation(db, user)
    return {"ok": True, "id": r.id}


@app.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    r = db.query(Rule).filter_by(id=rule_id, user_id=user.id).first()
    if not r:
        raise HTTPException(404)
    db.delete(r)
    db.commit()
    run_consolidation(db, user)
    return {"ok": True}


# ---------------- Seed demo ----------------
@app.post("/demo")
def seed_demo(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Popula conta com transações de exemplo para demonstração."""
    db.query(Transaction).filter_by(user_id=user.id).delete()
    today = date.today()
    samples = [
        ("Salário mensal", 8500, 0),
        ("Aluguel apartamento", -2200, 2),
        ("iFood almoço", -45, 1),
        ("Uber para reunião", -28, 3),
        ("Supermercado Pão de Açúcar", -420, 5),
        ("Netflix assinatura", -55, 7),
        ("Spotify Premium", -22, 7),
        ("Farmácia Drogasil", -85, 8),
        ("Posto Shell gasolina", -180, 10),
        ("Shopee compras", -230, 12),
        ("Conta de luz", -195, 15),
        ("Conta de internet Vivo", -110, 15),
        ("iFood jantar", -62, 16),
        ("Amazon livros", -140, 18),
        ("Restaurante Outback", -240, 20),
        ("Salário mensal", 8500, 30),
        ("Aluguel apartamento", -2200, 32),
        ("iFood almoço", -48, 31),
        ("Netflix assinatura", -55, 37),
        ("Spotify Premium", -22, 37),
        ("Rendimento CDB", 320, 35),
    ]
    rules = db.query(Rule).filter_by(user_id=user.id).all()
    for desc, amt, days_ago in samples:
        db.add(Transaction(
            id=str(uuid.uuid4()),
            user_id=user.id,
            description=desc,
            amount=amt,
            date=today - timedelta(days=days_ago),
            category=categorize(desc, amt, rules),
            source="demo"
        ))
    db.commit()
    run_consolidation(db, user)
    return {"ok": True, "imported": len(samples)}
