"""Valida as credenciais Pluggy do .env chamando /auth e diagnostica o plano.

Uso (dentro do diretorio backend/):
    python check_pluggy.py

Saida esperada:
    - Auth OK ou erro de credencial
    - Numero de conectores disponiveis
    - Se a conta e trial (testa criacao de item em conector real)
"""
import os
import sys
import json

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("(dica) pip install python-dotenv para carregar .env automaticamente")

BASE = "https://api.pluggy.ai"


def main() -> int:
    cid = os.getenv("PLUGGY_CLIENT_ID", "").strip()
    csec = os.getenv("PLUGGY_CLIENT_SECRET", "").strip()

    if not cid or not csec:
        print("ERRO: PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET nao estao no .env")
        print("     Obtenha em https://dashboard.pluggy.ai/applications")
        return 1

    # 1) Auth
    print(f"[1/3] Auth com clientId={cid[:8]}...", end=" ", flush=True)
    r = requests.post(
        f"{BASE}/auth",
        json={"clientId": cid, "clientSecret": csec},
        timeout=10,
    )
    if not r.ok:
        print("FALHOU")
        print(f"      HTTP {r.status_code}: {r.text[:300]}")
        return 2
    api_key = r.json().get("apiKey")
    if not api_key:
        print("FALHOU (sem apiKey no retorno)")
        return 3
    print("OK")

    # 2) Conectores
    print("[2/3] Conectores disponiveis...", end=" ", flush=True)
    r = requests.get(
        f"{BASE}/connectors",
        headers={"X-API-KEY": api_key},
        timeout=10,
    )
    if not r.ok:
        print(f"FALHOU HTTP {r.status_code}")
        return 4
    connectors = r.json().get("results", [])
    print(f"{len(connectors)} encontrados")

    # 3) Detecta TRIAL tentando criar item em conector real (com credenciais bogus)
    # Encontra um conector real (Inter ID 823 ou primeiro PERSONAL_BANK nao sandbox)
    target = next(
        (c for c in connectors if c.get("id") == 823),
        None,
    ) or next(
        (c for c in connectors if c.get("type") == "PERSONAL_BANK"),
        None,
    )
    if not target:
        print("[3/3] (sem conector PERSONAL_BANK para testar)")
        return 0

    print(f"[3/3] Testando se conta e trial (connector={target['id']} {target.get('name')})...", end=" ", flush=True)
    r = requests.post(
        f"{BASE}/items",
        headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
        json={"connectorId": target["id"], "parameters": {"cpf": "00000000000", "password": "000000"}},
        timeout=10,
    )
    data = {}
    try:
        data = r.json()
    except json.JSONDecodeError:
        pass
    code_desc = data.get("codeDescription", "")
    if code_desc == "TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED":
        print("TRIAL")
        print("     => Conta em modo trial: so conecta Pluggy Bank (sandbox).")
        print("     => Para bancos reais: dashboard.pluggy.ai/applications > Request Production Access")
    elif r.status_code == 201 or data.get("status") == "LOGIN_ERROR":
        print("PRODUCAO")
        print("     => Conta liberada para bancos reais (credenciais de teste rejeitadas, como esperado).")
    elif code_desc == "CONNECTOR_RESTRICTED":
        print("OK mas conector alternativo necessario")
        print("     => " + data.get("message", ""))
    else:
        print(f"indeterminado (HTTP {r.status_code})")
        print(f"     codeDescription={code_desc} message={data.get('message', '')[:200]}")

    print()
    print("Resumo: credenciais validas. Uso no frontend via Conciliacao > Configurar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
