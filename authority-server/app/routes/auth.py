from flask import Blueprint, request, jsonify
import bcrypt
from ..models.admin import Admin
from ..auth import generate_token

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Expects JSON: { "username": "...", "password": "..." }
    Returns JWT token on success.
    """
    data     = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400

    admin = Admin.query.filter_by(username=username).first()
    if not admin:
        return jsonify({"error": "Invalid credentials"}), 401

    if not bcrypt.checkpw(password.encode(), admin.password_hash.encode()):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_token(username)
    return jsonify({"token": token}), 200