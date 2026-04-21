from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models.message import GhostMessage
from ..crypto.ghost_key import decrypt_ghost_ciphertext
from ..middleware.auth import require_auth

messages_bp = Blueprint("messages", __name__)


@messages_bp.route("/store", methods=["POST"])
def store_message():
    """
    Called by the Operator Server for every message sent.
    Expects JSON:
    {
        "sender_id":          "...",
        "recipient_id":       "...",
        "ciphertext_b64":     "...",
        "ephemeral_pub_b64":  "..."
    }
    """
    data     = request.get_json()
    required = ["sender_id", "recipient_id", "ciphertext_b64", "ephemeral_pub_b64"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    msg = GhostMessage(
        sender_id=data["sender_id"],
        recipient_id=data["recipient_id"],
        ciphertext_b64=data["ciphertext_b64"],
        ephemeral_pub_b64=data["ephemeral_pub_b64"],
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"status": "stored", "id": msg.id}), 201


@messages_bp.route("/retrieve", methods=["GET"])
@require_auth
def retrieve_messages():
    """
    Called by the Authority Client.
    Decrypts all stored ghost ciphertexts and returns plaintext.
    Optional filters: ?sender_id=...  ?recipient_id=...
    """
    print("/messages/retrieve: Endpoint entered")
    query = GhostMessage.query
    if sender_id := request.args.get("sender_id"):
        query = query.filter_by(sender_id=sender_id)
    if recipient_id := request.args.get("recipient_id"):
        query = query.filter_by(recipient_id=recipient_id)

    results = []
    print("Entering query msg for-loop")
    for msg in query.all():
        try:
            print(msg)
            plaintext = decrypt_ghost_ciphertext(
                msg.ciphertext_b64,
                msg.ephemeral_pub_b64,
            )
            print("DECRYPT RESULT:", plaintext)
            print(msg.to_dict())
            results.append({
                **msg.to_dict(),
                "plaintext": plaintext.decode("utf-8"),
            })
        except Exception as e:
            results.append({**msg.to_dict(), "error": str(e)})
            print("ERROR occurred for msg")

    return jsonify(results)