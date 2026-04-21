from flask import Flask
from .extensions import db, socketio
from dotenv import load_dotenv
import os
from flask_cors import CORS

load_dotenv()

def create_app():
    app = Flask(__name__)

    CORS(app, origins=["http://localhost:5100"], supports_credentials=True)
    
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

    db.init_app(app)
    socketio.init_app(app)

    from .routes.auth import auth_bp
    from .routes.keys import keys_bp
    from .routes.messages import messages_bp
    from .routes.conversations import conversations_bp
    from .routes.users import users_bp
    app.register_blueprint(auth_bp,             url_prefix="/auth")
    app.register_blueprint(keys_bp,             url_prefix="/keys")
    app.register_blueprint(messages_bp,         url_prefix="/messages")
    app.register_blueprint(conversations_bp,    url_prefix="/conversations")
    app.register_blueprint(users_bp,            url_prefix="/users")

    # Register socket event handlers
    from .sockets import events

    with app.app_context():
        db.create_all()

    return app