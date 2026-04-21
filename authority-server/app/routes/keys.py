from flask import Blueprint, jsonify
from ..crypto.ghost_key import load_public_key_pem

keys_bp = Blueprint("keys", __name__)

@keys_bp.route("/ghost-public-key", methods=["GET"])
def get_ghost_public_key():
    pem = load_public_key_pem()
    return jsonify({"ghost_public_key_pem": pem})