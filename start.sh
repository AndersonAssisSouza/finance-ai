#!/usr/bin/env bash
# =========================================================
# Finance AI - Setup e execucao local (Linux/Mac)
# =========================================================
set -e

cd "$(dirname "$0")/backend"

echo
echo "========================================="
echo " Finance AI - iniciando ambiente local"
echo "========================================="
echo

if [ ! -d ".venv" ]; then
  echo "[1/3] Criando ambiente virtual Python..."
  python3 -m venv .venv
fi

echo "[2/3] Instalando dependencias..."
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null 2>&1 || true
python -m pip install -r requirements.txt

if [ ! -f ".env" ]; then
  echo "[extra] Criando .env padrao..."
  cp .env.example .env
fi

echo "[3/3] Abrindo frontend..."
FRONTEND="$(cd .. && pwd)/frontend/index.html"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$FRONTEND" &
elif command -v open >/dev/null 2>&1; then open "$FRONTEND" &
fi

echo
echo "Backend:  http://localhost:8000"
echo "Docs:     http://localhost:8000/docs"
echo "Frontend: $FRONTEND"
echo
echo "CTRL+C para parar."
echo "========================================="

exec uvicorn main:app --reload --host 0.0.0.0 --port 8000
