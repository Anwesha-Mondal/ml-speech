"""Local development entrypoint for Speech Arena.

Starts the FastAPI backend with in-memory MongoDB (mongomock) and Redis (fakeredis)
so the entire platform runs out-of-the-box without requiring separate service installs.
"""

from __future__ import annotations

import os
import sys

# Ensure project root is in path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import mongomock
import uvicorn

from backend.auth.db import use_database
from backend.env import require

# Initialize in-memory datastore before importing the app
_mock_mongo = mongomock.MongoClient(tz_aware=True)["speech_guru"]
use_database(_mock_mongo)

from backend.api.main import app  # noqa: E402
from backend.auth.config import get_settings
from backend.auth.db import USERS, User
from backend.auth.passwords import hash_password
from backend.privacy import consent


def seed_dev_user() -> None:
    cfg = get_settings()
    for email in ("demo@speechguru.dev", "demo@speecharena.dev"):
        if not _mock_mongo[USERS].find_one({"email": email}):
            u = User(
                email=email,
                display_name="Demo User",
                password_hash=hash_password("violet-harbor-canvas-42", cfg),
                role="admin",
            )
            _mock_mongo[USERS].insert_one(u.to_doc())
            consent.record_signup_acceptance(_mock_mongo, u.id)
    print("[*] Seeded dev account: demo@speechguru.dev / violet-harbor-canvas-42")


if __name__ == "__main__":
    seed_dev_user()
    host = require("API_HOST")
    port = int(require("API_PORT"))
    print(f"[*] Starting Speech Guru Dev Backend on http://{host}:{port} (in-memory MongoDB)...")
    uvicorn.run(app, host=host, port=port)
