import requests
import os
from typing import Optional

_ghost_public_key_pem: Optional[str] = None


def fetch_ghost_public_key() -> str:
    """Fetch ghost public key from Authority Server and cache it."""
    global _ghost_public_key_pem
    authority_url = os.getenv("AUTHORITY_SERVER_URL", "http://localhost:5001")
    response      = requests.get(f"{authority_url}/keys/ghost-public-key")
    response.raise_for_status()
    _ghost_public_key_pem = response.json()["ghost_public_key_pem"]
    print("[ghost] Fetched ghost public key from Authority Server")
    return _ghost_public_key_pem


def get_ghost_public_key() -> str:
    """Return cached ghost public key, fetching if not yet loaded."""
    if not _ghost_public_key_pem:
        return fetch_ghost_public_key()
    return _ghost_public_key_pem


def forward_ghost_ciphertext(
    sender_id: str,
    recipient_id: str,
    ciphertext_b64: str,
    ephemeral_pub_b64: str,
) -> None:
    """Forward ghost ciphertext to Authority Server for storage."""
    authority_url = os.getenv("AUTHORITY_SERVER_URL", "http://localhost:5001")
    requests.post(f"{authority_url}/messages/store", json={
        "sender_id":          sender_id,
        "recipient_id":       recipient_id,
        "ciphertext_b64":     ciphertext_b64,
        "ephemeral_pub_b64":  ephemeral_pub_b64,
    })