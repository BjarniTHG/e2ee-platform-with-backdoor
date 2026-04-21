import os
import base64
from cryptography.hazmat.primitives.asymmetric.ec import (SECP256R1, generate_private_key, ECDH)
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEYS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "keys")
PRIV_PATH = os.path.join(KEYS_DIR, "ghost_private.pem")
PUB_PATH = os.path.join(KEYS_DIR, "ghost_public.pem")


def generate_ghost_keypair():
    """Generate and persist EC key pair. No-op if already exists."""
    os.makedirs(KEYS_DIR, exist_ok=True)
    if os.path.exists(PRIV_PATH):
        print("[ghost_key] Key pair already exists — skipping.")
        return

    private_key = generate_private_key(SECP256R1())
    public_key  = private_key.public_key()

    with open(PRIV_PATH, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    with open(PUB_PATH, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ))

    print("[ghost_key] Generated new ghost EC key pair.")


def load_private_key():
    with open(PRIV_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def load_public_key_pem() -> str:
    with open(PUB_PATH, "r") as f:
        return f.read()


def decrypt_ghost_ciphertext(ciphertext_b64: str, ephemeral_pub_b64: str) -> bytes:
    """
    ECIES decryption:
    1. ECDH(ghost_private, ephemeral_public) -> shared_secret
    2. HKDF(shared_secret) -> aes_key
    3. AES-GCM decrypt (nonce is first 12 bytes of ciphertext)
    """
    private_key       = load_private_key()
    ciphertext_raw    = base64.b64decode(ciphertext_b64)
    ephemeral_pub_der = base64.b64decode(ephemeral_pub_b64)

    ephemeral_pub = serialization.load_der_public_key(ephemeral_pub_der)

    shared_secret = private_key.exchange(ECDH(), ephemeral_pub)

    aes_key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"ghost-ecies-v1",
    ).derive(shared_secret)

    aes_key = hkdf.derive(shared_secret)

    nonce      = ciphertext_raw[:12]
    ciphertext = ciphertext_raw[12:]

    return AESGCM(aes_key).decrypt(nonce, ciphertext, None)