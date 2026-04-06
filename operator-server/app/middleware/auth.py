from functools import wraps
from flask import request, jsonify, g
from ..models.user import User
from ..utils.token import hash_token


def require_auth(f):
    """
    Decorator for protecting routes. Expects:
    Authorization: Bearer <token>
    Sets g.user so the route can access the current user.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        user  = User.query.filter_by(token_hash=hash_token(token)).first()
        if not user:
            return jsonify({"error": "Invalid token"}), 401

        g.user = user
        return f(*args, **kwargs)
    return decorated