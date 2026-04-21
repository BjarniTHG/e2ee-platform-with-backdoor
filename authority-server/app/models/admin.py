from ..extensions import db
import datetime

class Admin(db.Model):
    __tablename__ = "admin"

    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.datetime.utcnow)