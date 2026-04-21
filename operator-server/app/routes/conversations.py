from flask import Blueprint, request, jsonify, g
from ..extensions import db, socketio
from ..models.conversation import Conversation
from ..models.message import Message
from ..models.user import User
from ..middleware.auth import require_auth
from ..routes.messages import connected_users
from ..ghost import forward_ghost_ciphertext
import json

conversations_bp = Blueprint("conversations", __name__)


@conversations_bp.route("/start", methods=["POST"])
@require_auth
def start_conversation():
    """
    Alice starts a conversation with Bob by sending the first message.
    Creates a pending conversation and delivers the encrypted first message.
    Expects JSON:
    {
        "recipient_short_code": "...",
        "payload": {
            "ciphertext":    "...",
            "message_type":  3,
        }
    }
    """
    data = request.get_json()
    if not data.get("recipient_short_code") or not data.get("payload"):
        return jsonify({"error": "Missing fields"}), 400

    recipient = User.query.filter_by(short_code=data["recipient_short_code"]).first()
    if not recipient:
        return jsonify({"error": "User not found"}), 404

    # Check if conversation already exists
    existing = Conversation.query.filter_by(
        initiator_id=g.user.id,
        recipient_id=recipient.id,
    ).first()
    if existing and existing.status == "ignored":
        return jsonify({"error": "User not found"}), 404  # hide ignored status
    if existing:
        return jsonify({"error": "Conversation already exists"}), 409

    # Create pending conversation
    conversation = Conversation(
        initiator_id=g.user.id,
        recipient_id=recipient.id,
        status="pending",
    )
    db.session.add(conversation)
    db.session.commit()

    payload_str = json.dumps(data["payload"])

    payload = data["payload"]

    if payload.get("ghost_ciphertext") and payload.get("ghost_ephemeral_pub"):
        forward_ghost_ciphertext(
            sender_id=g.user.short_code,
            recipient_id=data["recipient_short_code"],
            ciphertext_b64=payload["ghost_ciphertext"],
            ephemeral_pub_b64=payload["ghost_ephemeral_pub"],
        )

    # Strip ghost fields before storing/delivering
    recipient_payload = {
        "ciphertext":   payload["ciphertext"],
        "message_type": payload["message_type"],
    }

    # Deliver or store the first message
    recipient_sid = connected_users.get(recipient.id)
    if recipient_sid:
        socketio.emit("contact_request", {
            "conversation_id":   conversation.id,
            "sender_short_code": g.user.short_code,
            "payload":           data["payload"],
        }, to=recipient_sid)
    else:
        message = Message(
            sender_id=g.user.id,
            recipient_id=recipient.id,
            payload=payload_str,
            conversation_id=conversation.id,
            message_type="contact_request",
        )
        db.session.add(message)
        db.session.commit()

    return jsonify({"status": "pending", "conversation_id": conversation.id}), 201


@conversations_bp.route("/accept", methods=["POST"])
@require_auth
def accept_conversation():
    """
    Bob accepts a contact request.
    Expects JSON: { "conversation_id": 1 }
    """
    data            = request.get_json()
    conversation_id = data.get("conversation_id")

    conversation = Conversation.query.filter_by(
        id=conversation_id,
        recipient_id=g.user.id,
        status="pending",
    ).first()
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    conversation.status = "accepted"
    db.session.commit()

    # Notify Alice if she is online
    initiator     = User.query.get(conversation.initiator_id)
    initiator_sid = connected_users.get(conversation.initiator_id)
    if initiator_sid:
        socketio.emit("conversation_accepted", {
            "conversation_id":      conversation.id,
            "recipient_short_code": g.user.short_code,
        }, to=initiator_sid)

    return jsonify({"status": "accepted"}), 200


@conversations_bp.route("/ignore", methods=["POST"])
@require_auth
def ignore_conversation():
    """
    Bob permanently ignores a contact request.
    Expects JSON: { "conversation_id": 1 }
    """
    data            = request.get_json()
    conversation_id = data.get("conversation_id")

    conversation = Conversation.query.filter_by(
        id=conversation_id,
        recipient_id=g.user.id,
        status="pending",
    ).first()
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    conversation.status = "ignored"

    # Delete the pending first message
    Message.query.filter_by(
        sender_id=conversation.initiator_id,
        recipient_id=g.user.id,
    ).delete()

    db.session.commit()
    return jsonify({"status": "ignored"}), 200


@conversations_bp.route("/requests", methods=["GET"])
@require_auth
def get_requests():
    """
    Bob fetches all pending contact requests.
    Also returns the first message payload for each so Bob can decrypt after accepting.
    """
    pending = Conversation.query.filter_by(
        recipient_id=g.user.id,
        status="pending",
    ).all()

    results = []
    for conv in pending:
        initiator = User.query.get(conv.initiator_id)
        # Get the first message
        msg = Message.query.filter_by(
            sender_id=conv.initiator_id,
            recipient_id=g.user.id,
            conversation_id=conv.id,
        ).first()
        results.append({
            "conversation_id":   conv.id,
            "sender_short_code": initiator.short_code,
            "payload":           json.loads(msg.payload) if msg else None,
            "created_at":        conv.created_at.isoformat(),
        })

    return jsonify(results), 200


@conversations_bp.route("/", methods=["GET"])
@require_auth
def get_conversations():
    """
    Fetch all accepted conversations for the current user.
    """
    accepted = Conversation.query.filter(
        db.or_(
            Conversation.initiator_id == g.user.id,
            Conversation.recipient_id == g.user.id,
        ),
        Conversation.status == "accepted",
    ).all()

    return jsonify([c.to_dict(g.user.id) for c in accepted]), 200