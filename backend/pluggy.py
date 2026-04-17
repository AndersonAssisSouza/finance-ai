import os
import requests

BASE = "https://api.pluggy.ai"


def get_api_key():
    client_id = os.getenv("PLUGGY_CLIENT_ID")
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None
    try:
        r = requests.post(f"{BASE}/auth", json={
            "clientId": client_id,
            "clientSecret": client_secret
        }, timeout=10)
        return r.json().get("apiKey")
    except Exception:
        return None


def get_accounts(api_key, item_id):
    r = requests.get(f"{BASE}/accounts",
                     headers={"X-API-KEY": api_key},
                     params={"itemId": item_id},
                     timeout=10)
    return r.json()


def get_transactions(api_key, account_id):
    r = requests.get(f"{BASE}/transactions",
                     headers={"X-API-KEY": api_key},
                     params={"accountId": account_id},
                     timeout=10)
    return r.json()
