from ..extensions import db
from datetime import datetime

class Conversation(db.Model):
    __tablename__ = "conversations"

    id           = db.Column(db.Integer, primary_key=True)
    initiator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status       = db.Column(db.String(16), default="pending")  # pending, accepted, ignored
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self, current_user_id: int):
        from .user import User
        other_id   = self.recipient_id if self.initiator_id == current_user_id else self.initiator_id
        other_user = User.query.get(other_id)
        return {
            "id":         self.id,
            "short_code": other_user.short_code,
            "status":     self.status,
            "initiated":  self.initiator_id == current_user_id,
            "created_at": self.created_at.isoformat(),
        }