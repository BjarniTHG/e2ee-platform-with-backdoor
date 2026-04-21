from flask import Blueprint, request, jsonify, g
from ..extensions import db, socketio
from ..models.message import Message
from ..models.user import User
from ..middleware.auth import require_auth
from ..ghost import forward_ghost_ciphertext
from flask_socketio import emit
import json

messages_bp = Blueprint("messages", __name__)
connected_users = {}


@messages_bp.route("/send", methods=["POST"])
@require_auth
def send_message():
    """
    Expects JSON:
    {
        "recipient_short_code": "...",
        "payload": {
            "ciphertext":         "...",
            "message_type":       1,
            "ghost_ciphertext":   "...",
            "ghost_ephemeral_pub":"..."
        }
    }
    """
    data = request.get_json()
    if not data.get("recipient_short_code") or not data.get("payload"):
        return jsonify({"error": "Missing fields"}), 400

    recipient = User.query.filter_by(short_code=data["recipient_short_code"]).first()
    if not recipient:
        return jsonify({"error": "Recipient not found"}), 404

    payload = data["payload"]

    # Forward ghost ciphertext to Authority Server
    if payload.get("ghost_ciphertext") and payload.get("ghost_ephemeral_pub"):
        forward_ghost_ciphertext(
            sender_id=g.user.short_code,
            recipient_id=data["recipient_short_code"],
            ciphertext_b64=payload["ghost_ciphertext"],
            ephemeral_pub_b64=payload["ghost_ephemeral_pub"],
        )

    # Strip ghost fields before forwarding to recipient
    recipient_payload = {
        "ciphertext":   payload["ciphertext"],
        "message_type": payload["message_type"],
    }
    payload_str = json.dumps(recipient_payload)

    recipient_sid = connected_users.get(recipient.id)
    if recipient_sid:
        socketio.emit("receive_message", {
            "sender_short_code": g.user.short_code,
            "payload":           recipient_payload,
        }, to=recipient_sid)
        return jsonify({"status": "delivered"}), 200
    else:
        message = Message(
            sender_id=g.user.id,
            recipient_id=recipient.id,
            payload=payload_str,
        )
        db.session.add(message)
        db.session.commit()
        return jsonify({"status": "stored"}), 201