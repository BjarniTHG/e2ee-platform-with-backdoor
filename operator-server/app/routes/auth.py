from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models.user import User
from ..utils.token import generate_token, hash_token, generate_unique_short_code

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Generates a token and short code for a new anonymous user.
    Returns the plaintext token once
    """
    token      = generate_token()
    token_hash = hash_token(token)
    short_code = generate_unique_short_code()

    user = User(token_hash=token_hash, short_code=short_code)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "token":      token,       
        "short_code": short_code,  
    }), 201


@auth_bp.route("/validate", methods=["POST"])
def validate():
    """
    Validates a token. Used by the client to check if a stored token is still valid.
    """
    data  = request.get_json()
    token = data.get("token")
    if not token:
        return jsonify({"error": "Missing token"}), 400

    user = User.query.filter_by(token_hash=hash_token(token)).first()
    if not user:
        return jsonify({"valid": False}), 401

    return jsonify({"valid": True, "short_code": user.short_code}), 200