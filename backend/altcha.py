"""
Altcha Proof-of-Work – serverseitige Implementierung ohne externe Abhängigkeit.
Protokoll: https://altcha.org/docs/api/
"""
import base64
import hashlib
import hmac
import json
import secrets
import time


def create_challenge(hmac_key: str, max_number: int = 50_000, ttl_seconds: int = 300) -> dict:
    salt = secrets.token_hex(12)
    expires = int(time.time()) + ttl_seconds
    # Salt enthält Ablaufzeit – Altcha-Konvention: salt?expires=...
    salted = f"{salt}?expires={expires}"
    number = secrets.randbelow(max_number) + 1
    challenge = hashlib.sha256(f"{salted}{number}".encode()).hexdigest()
    signature = hmac.new(hmac_key.encode(), challenge.encode(), hashlib.sha256).hexdigest()
    return {
        "algorithm": "SHA-256",
        "challenge": challenge,
        "maxnumber": max_number,
        "salt": salted,
        "signature": signature,
    }


def verify_solution(payload_b64: str, hmac_key: str) -> bool:
    """Gibt True zurück wenn das Payload gültig und nicht abgelaufen ist."""
    try:
        raw = base64.b64decode(payload_b64 + "==")  # padding tolerant
        payload = json.loads(raw)

        # Ablaufzeit aus dem Salt lesen
        salt: str = payload.get("salt", "")
        if "?expires=" in salt:
            expires = int(salt.split("?expires=")[1])
            if time.time() > expires:
                return False

        # Hash-Prüfung
        expected = hashlib.sha256(
            f"{salt}{payload['number']}".encode()
        ).hexdigest()
        if not hmac.compare_digest(expected, payload["challenge"]):
            return False

        # Signatur-Prüfung
        sig = hmac.new(
            hmac_key.encode(), payload["challenge"].encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(sig, payload["signature"])
    except Exception:
        return False
