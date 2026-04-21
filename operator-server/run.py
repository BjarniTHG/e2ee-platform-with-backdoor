from app import create_app
from app.extensions import socketio
import os
from app.ghost import fetch_ghost_public_key

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        fetch_ghost_public_key()
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5050)),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true"
    )