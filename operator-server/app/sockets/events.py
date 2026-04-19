from ..extensions import db, socketio
from ..models.message import Message
from ..models.user import User
from ..utils.token import hash_token
from ..routes.messages import connected_users
from flask_socketio import emit, disconnect
from flask import request


@socketio.on("connect")
def on_connect(auth):
    token = auth.get("token") if auth else None
    if not token:
        disconnect()
        return

    user = User.query.filter_by(token_hash=hash_token(token)).first()
    if not user:
        disconnect()
        return

    connected_users[user.id] = request.sid
    print(f"[socket] {user.short_code} connected (sid: {request.sid})")

    # Flush pending contact requests
    from ..models.conversation import Conversation
    pending_convs = Conversation.query.filter_by(
        recipient_id=user.id,
        status="pending",
    ).all()

    for conv in pending_convs:
        from ..models.user import User as UserModel
        sender  = UserModel.query.get(conv.initiator_id)
        msg     = Message.query.filter_by(
            sender_id=conv.initiator_id,
            recipient_id=user.id,
            conversation_id=conv.id,
        ).first()
        if msg:
            import json
            emit("contact_request", {
                "conversation_id":   conv.id,
                "sender_short_code": sender.short_code,
                "payload":           json.loads(msg.payload),
            })

    # Flush pending regular messages
    pending_msgs = Message.query.filter_by(
        recipient_id=user.id,
        message_type="message",
    ).order_by(Message.created_at.asc()).all()

    for message in pending_msgs:
        sender = UserModel.query.get(message.sender_id)
        emit("receive_message", {
            "sender_short_code": sender.short_code,
            "payload":           message.to_dict()["payload"],
        })
        db.session.delete(message)

    db.session.commit()


@socketio.on("disconnect")
def on_disconnect():
    """
    remove session and disconnect
    """
    user_id = next(
        (uid for uid, sid in connected_users.items() if sid == request.sid),
        None
    )
    if user_id:
        del connected_users[user_id]
        print(f"[socket] user {user_id} disconnected")