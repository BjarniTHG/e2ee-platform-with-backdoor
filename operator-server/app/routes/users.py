from flask import Blueprint, jsonify
from ..models.user import User
from ..middleware.auth import require_auth

users_bp = Blueprint("users", __name__)

@users_bp.route("/exists/<short_code>", methods=["GET"])
@require_auth
def user_exists(short_code):
    user = User.query.filter_by(short_code=short_code).first()
    if not user:
        return jsonify({"exists": False}), 404
    return jsonify({"exists": True}), 200