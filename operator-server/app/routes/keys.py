from flask import Blueprint, request, jsonify, g
from ..extensions import db
from ..models.prekey_bundle import IdentityKey, SignedPrekey, OneTimePrekey
from ..models.user import User
from ..middleware.auth import require_auth

keys_bp = Blueprint("keys", __name__)


@keys_bp.route("/upload", methods=["POST"])
@require_auth
def upload_prekey_bundle():
    """
    Called once after registration. Uploads the full prekey bundle.
    Expects JSON:
    {
        "ik_public":    "...",   base64
        "spk_id":       1,
        "spk_public":   "...",   base64
        "spk_signature":"...",   base64
        "opks": [
            { "id": 1, "public": "..." },
            { "id": 2, "public": "..." },
            ...
        ]
    }
    """
    data = request.get_json()
    user = g.user

    required = ["ik_public", "spk_id", "spk_public", "spk_signature", "opks"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    ik = IdentityKey.query.filter_by(user_id=user.id).first()
    if ik:
        ik.ik_public = data["ik_public"]
    else:
        ik = IdentityKey(user_id=user.id, ik_public=data["ik_public"])
        db.session.add(ik)

    spk = SignedPrekey.query.filter_by(user_id=user.id).first()
    if spk:
        spk.spk_id        = data["spk_id"]
        spk.spk_public    = data["spk_public"]
        spk.spk_signature = data["spk_signature"]
    else:
        spk = SignedPrekey(
            user_id=user.id,
            spk_id=data["spk_id"],
            spk_public=data["spk_public"],
            spk_signature=data["spk_signature"],
        )
        db.session.add(spk)

    for opk_data in data["opks"]:
        opk = OneTimePrekey(
            user_id=user.id,
            opk_id=opk_data["id"],
            opk_public=opk_data["public"],
        )
        db.session.add(opk)

    db.session.commit()
    return jsonify({"status": "uploaded"}), 201


@keys_bp.route("/<short_code>", methods=["GET"])
@require_auth
def fetch_prekey_bundle(short_code):
    """
    Fetch a user's prekey bundle by their short code.
    Returns one OPK and marks it as used.
    """
    target = User.query.filter_by(short_code=short_code).first()
    if not target:
        return jsonify({"error": "User not found"}), 404

    ik  = IdentityKey.query.filter_by(user_id=target.id).first()
    spk = SignedPrekey.query.filter_by(user_id=target.id).first()

    if not ik or not spk:
        return jsonify({"error": "Prekey bundle not uploaded yet"}), 404

    opk = OneTimePrekey.query.filter_by(user_id=target.id, used=False).first()
    if opk:
        opk.used = True
        db.session.commit()

    bundle = {
        "short_code":    short_code,
        "ik_public":     ik.ik_public,
        "spk_id":        spk.spk_id,
        "spk_public":    spk.spk_public,
        "spk_signature": spk.spk_signature,
        "opk": {
            "id":     opk.opk_id,
            "public": opk.opk_public,
        } if opk else None,
    }

    return jsonify(bundle), 200


@keys_bp.route("/opk-count", methods=["GET"])
@require_auth
def opk_count():
    """
    Returns the number of unused OPKs remaining for the authenticated user.
    """
    count = OneTimePrekey.query.filter_by(
        user_id=g.user.id, used=False
    ).count()
    return jsonify({"opk_count": count}), 200