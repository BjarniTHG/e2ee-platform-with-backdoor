from app import create_app
from app.crypto.ghost_key import generate_ghost_keypair
from app.auth import seed_admin
import os

app = create_app()

if __name__ == "__main__":
    generate_ghost_keypair()
    with app.app_context():
        seed_admin()
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5001)),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true"
    )