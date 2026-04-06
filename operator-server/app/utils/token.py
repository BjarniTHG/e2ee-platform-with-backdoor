import os
import hashlib
import random
from .wordlist import ADJECTIVES, NOUNS
from ..extensions import db


def generate_token() -> str:
    """Generate a cryptographically secure 32-byte hex token."""
    return os.urandom(32).hex()


def hash_token(token: str) -> str:
    """SHA-256 hash of the token for safe storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_short_code() -> str:
    """Generate an adjective-noun-4digit short code e.g. swift-wolf-4821."""
    adj  = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    digits = str(random.randint(1000, 9999))
    return f"{adj}-{noun}-{digits}"


def generate_unique_short_code() -> str:
    """Keep generating until we get a code not already in the database."""
    from ..models.user import User
    while True:
        code = generate_short_code()
        if not User.query.filter_by(short_code=code).first():
            return code