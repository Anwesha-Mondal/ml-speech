"""Fixtures: a minimal FastAPI app around the real auth code, in-memory MongoDB (mongomock)
and Redis (fakeredis), test-only .env values and fast scrypt."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import fakeredis
import mongomock
import pytest
import yaml
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from backend.auth import SecurityMiddleware, admin_router, auth_router, require_admin, require_user
from backend.auth.config import DEFAULT_CONFIG, get_settings
from backend.auth.db import User, use_database
from backend.auth.ratelimit import limiter
from backend.leaderboard import leaderboard_router
from backend.leaderboard.config import get_leaderboard_settings
from backend.privacy import privacy_router
from backend.privacy.config import get_privacy_settings
from backend.redis_client import use_client as use_redis

# Placeholder values for the keys .env provides. Tests never touch a real server:
# MongoDB and Redis are replaced in memory below.
TEST_ENV = {
    "MONGODB_URI": "mongodb://test.invalid:27017",
    "MONGODB_DB": "speech_arena_test",
    "REDIS_URL": "redis://test.invalid:6379/0",
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
    use_redis(fakeredis.FakeRedis(decode_responses=True))  # sessions + leaderboards

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
    use_redis(None)
    _clear_caches()
    limiter.reset()


def _clear_caches() -> None:
    get_settings.cache_clear()
    get_privacy_settings.cache_clear()
    get_leaderboard_settings.cache_clear()


@pytest.fixture()
def rds(app: FastAPI) -> Any:
    """The in-memory Redis behind `app` (sessions and leaderboards)."""
    from backend.redis_client import client

    return client()


def session_keys(rds: Any) -> list[str]:
    return sorted(rds.scan_iter(match="sa:sess:tok:*"))


@pytest.fixture()
def db(app: FastAPI) -> Any:
    """The in-memory database behind `app`."""
    from backend.auth.db import get_db

    return get_db()


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    # The session cookie has Path=/api, so requests use the testserver host over http.
    return TestClient(app, base_url="http://testserver")


def register(c: TestClient, email: str = "ana@example.com", name: str = "Ana", pw: str = STRONG) -> dict:
    r = c.post("/api/auth/register", json={"email": email, "display_name": name, "password": pw, **AGREE}, headers=HDR)
    assert r.status_code == 201, r.text
    return r.json()


def csrf_headers(session: dict) -> dict[str, str]:
    return {**HDR, "X-CSRF-Token": session["csrf_token"]}
