from ..extensions import db
import datetime

class GhostMessage(db.Model):
    __tablename__ = "ghost_messages"

    id                = db.Column(db.Integer, primary_key=True)
    sender_id         = db.Column(db.String,  nullable=False)
    recipient_id      = db.Column(db.String,  nullable=False)
    ciphertext_b64    = db.Column(db.Text,    nullable=False)
    ephemeral_pub_b64 = db.Column(db.Text,    nullable=False)
    created_at        = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "id":                 self.id,
            "sender_id":          self.sender_id,
            "recipient_id":       self.recipient_id,
            "ciphertext_b64":     self.ciphertext_b64,
            "ephemeral_pub_b64":  self.ephemeral_pub_b64,
            "created_at":         self.created_at.isoformat(),
        }