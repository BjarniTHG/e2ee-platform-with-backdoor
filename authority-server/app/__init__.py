from flask import Flask
from .extensions import db
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "SQLALCHEMY_DATABASE_URI", "sqlite:///authority.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret")

    db.init_app(app)
    CORS(app, origins=os.getenv("CORS_ORIGIN", "*"))

    from .routes.auth import auth_bp
    from .routes.keys import keys_bp
    from .routes.messages import messages_bp
    app.register_blueprint(auth_bp,     url_prefix="/auth")
    app.register_blueprint(keys_bp,     url_prefix="/keys")
    app.register_blueprint(messages_bp, url_prefix="/messages")

    with app.app_context():
        db.create_all()

    return app