"""Fixtures: a minimal FastAPI app around the real auth code, in-memory MongoDB (mongomock),
test-only .env values and fast scrypt."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import mongomock
import pytest
import yaml
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from backend.auth import SecurityMiddleware, admin_router, auth_router, require_admin, require_user
from backend.auth.config import DEFAULT_CONFIG, get_settings
from backend.auth.db import SESSIONS, User, use_database
from backend.auth.ratelimit import limiter
from backend.leaderboard import leaderboard_router
from backend.leaderboard.config import get_leaderboard_settings
from backend.privacy import privacy_router
from backend.privacy.config import get_privacy_settings                                                                                                                                                                                 
TEST_ENV = {
    "MONGODB_URI": "mongodb://test.invalid:27017",
    "MONGODB_DB": "speech_arena_test",
    "CORS_ORIGINS": "http://testserver",
    "COOKIE_SECURE": "0",
    "PRIVACY_CONTACT_URL": "https://example.invalid/contact",
}

HDR = {"X-Requested-With": "SpeechArena"}
AGREE = {"accept_terms": True, "confirm_age": True}
STRONG = "violet-harbor-canvas-42"


@pytest.fixture(autouse=True)
def test_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Every test sees only TEST_ENV, never the developer's own .env."""
    import backend.env

    monkeypatch.setattr(backend.env, "_loaded", True)  # skip reading the project's .env
    for k, v in TEST_ENV.items():
        monkeypatch.setenv(k, v)
    _clear_caches()
    yield
    _clear_caches()


@pytest.fixture()
def app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[FastAPI]:
    raw = yaml.safe_load(DEFAULT_CONFIG.read_text(encoding="utf-8"))
    raw["hashing"]["n"] = 1024  # fast for tests; production uses the YAML value
    cfg_path = tmp_path / "auth.yaml"
    cfg_path.write_text(yaml.safe_dump(raw), encoding="utf-8")
    monkeypatch.setenv("SA_AUTH_CONFIG", str(cfg_path))
    _clear_caches()
    limiter.reset()
    db: Any = mongomock.MongoClient(tz_aware=True)["speech_arena_test"]
    use_database(db)

    app = FastAPI()
    app.add_middleware(SecurityMiddleware)
    app.include_router(auth_router, prefix="/api")
    app.include_router(admin_router, prefix="/api")
    app.include_router(privacy_router, prefix="/api")
    app.include_router(leaderboard_router, prefix="/api")

    @app.get("/api/private")
    def private(user: User = Depends(require_user)) -> dict[str, str]:
        return {"id": user.id}

    @app.post("/api/private")
    def private_write(user: User = Depends(require_user)) -> dict[str, str]:
        return {"id": user.id}

    @app.get("/api/admin-only")
    def admin_only(user: User = Depends(require_admin)) -> dict[str, str]:
        return {"id": user.id}

    yield app
    use_database(None)
    _clear_caches()
    limiter.reset()


def _clear_caches() -> None:
    get_settings.cache_clear()
    get_privacy_settings.cache_clear()
    get_leaderboard_settings.cache_clear()


@pytest.fixture()
def db(app: FastAPI) -> Any:
    """The in-memory database behind `app`."""
    from backend.auth.db import get_db

    return get_db()


@pytest.fixture()
def rds(db: Any) -> Any:
    """Fixture alias for compatibility with tests inspecting session store."""
    return db


def session_keys(db_or_rds: Any) -> list[str]:
    from backend.auth.db import SESSIONS, get_db

    database = db_or_rds if hasattr(db_or_rds, "__getitem__") else get_db()
    return sorted(f"sa:sess:tok:{doc['token_hash']}" for doc in database[SESSIONS].find())


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    return TestClient(app, base_url="http://testserver")


def register(c: TestClient, email: str = "ana@example.com", name: str = "Ana", pw: str = STRONG) -> dict:
    r = c.post("/api/auth/register", json={"email": email, "display_name": name, "password": pw, **AGREE}, headers=HDR)
    assert r.status_code == 201, r.text
    return r.json()


def csrf_headers(session: dict) -> dict[str, str]:
    return {**HDR, "X-CSRF-Token": session["csrf_token"]}
