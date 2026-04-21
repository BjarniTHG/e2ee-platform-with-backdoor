import os
import bcrypt
import jwt
import datetime
from .models.admin import Admin
from .extensions import db
from typing import Optional


def seed_admin():
    """Create the admin account on first startup if it does not exist."""
    username = os.getenv("ADMIN_USERNAME", "authority")
    password = os.getenv("ADMIN_PASSWORD")

    if not password:
        print("[auth] WARNING: ADMIN_PASSWORD not set in .env — skipping seed")
        return

    existing = Admin.query.filter_by(username=username).first()
    if existing:
        print("[auth] Admin account already exists — skipping seed")
        return

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    admin  = Admin(username=username, password_hash=hashed)
    db.session.add(admin)
    db.session.commit()
    print(f"[auth] Admin account created: {username}")


def generate_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12),
    }
    return jwt.encode(payload, os.getenv("SECRET_KEY"), algorithm="HS256")


def verify_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
        return payload["sub"]
    except Exception:
        return None