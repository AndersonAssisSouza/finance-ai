@echo off
REM =========================================================
REM Finance AI - Setup e execucao local (Windows)
REM =========================================================
setlocal

echo.
echo =========================================
echo  Finance AI - iniciando ambiente local
echo =========================================
echo.

cd /d "%~dp0backend"

if not exist ".venv" (
  echo [1/3] Criando ambiente virtual Python...
  python -m venv .venv
  if errorlevel 1 (
    echo ERRO: nao foi possivel criar venv. Python 3.10+ esta instalado?
    pause
    exit /b 1
  )
)

echo [2/3] Instalando dependencias...
call .venv\Scripts\activate.bat
pip install -q --upgrade pip
pip install -q -r requirements.txt

if not exist ".env" (
  echo [extra] Criando .env padrao...
  copy /y .env.example .env >nul
)

echo [3/3] Abrindo frontend...
start "" "%~dp0frontend\index.html"

echo.
echo Backend iniciando em http://localhost:8000
echo Docs Swagger:         http://localhost:8000/docs
echo Frontend local:        abrira no navegador
echo.
echo Pressione CTRL+C para parar o servidor.
echo =========================================
echo.

uvicorn main:app --reload --host 0.0.0.0 --port 8000

endlocal
