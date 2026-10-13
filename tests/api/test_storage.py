"""MongoDB storage guarantees: session indexes and expiry, atomic leaderboard writes, and an
analysis that survives a leaderboard failure."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.auth.config import get_settings
from backend.auth.db import LEADERBOARD, SESSIONS, utcnow
from backend.leaderboard import store
from backend.privacy.config import get_privacy_settings
from backend.privacy.retention import purge

from .conftest import STRONG, csrf_headers, register


def test_session_indexes_exist(db: Any) -> None:
    idx = {i["name"]: i for i in db[SESSIONS].list_indexes()}
    assert idx["token_hash_unique"]["unique"] is True
    assert "by_user" in idx
    assert idx["ttl_purge_at"]["expireAfterSeconds"] == 0  # MongoDB deletes sessions at purge_at
    names = {i["name"] for i in db[LEADERBOARD].list_indexes()}
    assert {"by_board", "by_user"} <= names


def test_purge_at_is_idle_expiry_capped_by_absolute(client: TestClient, db: Any) -> None:
    register(client)
    cfg = get_settings()
    s = db[SESSIONS].find_one()
    assert s is not None
    assert s["purge_at"] == min(s["last_seen_at"] + timedelta(hours=cfg.idle_timeout_hours), s["expires_at"])

    # Activity pushes purge_at forward (after the touch interval).
    old = utcnow() - timedelta(seconds=cfg.touch_interval_seconds + 5)
    db[SESSIONS].update_one({"_id": s["_id"]}, {"$set": {"last_seen_at": old}})
    assert client.get("/api/auth/me").status_code == 200
    s2 = db[SESSIONS].find_one({"_id": s["_id"]})
    assert s2 is not None and s2["last_seen_at"] > old and s2["purge_at"] > s["purge_at"] - timedelta(seconds=10)


def test_purge_removes_ended_sessions_without_purge_at(client: TestClient, db: Any) -> None:
    """Backstop for documents created before purge_at existed, or where the TTL monitor is off."""
    db[SESSIONS].drop_index("ttl_purge_at")
    register(client)
    cfg = get_settings()
    now = utcnow()
    base = {"csrf_token": "c", "user_id": "u", "created_at": now, "ip": "1.2.3.4", "user_agent": "x"}
    db[SESSIONS].insert_many(
        [
            {**base, "_id": "idle", "token_hash": "a" * 64, "last_seen_at": now - timedelta(hours=cfg.idle_timeout_hours + 1), "expires_at": now + timedelta(days=1)},
            {**base, "_id": "expired", "token_hash": "b" * 64, "last_seen_at": now, "expires_at": now - timedelta(seconds=1)},
        ]
    )
    result = purge(db, get_privacy_settings())
    assert result["sessions"] == 2
    assert db[SESSIONS].count_documents({}) == 1  # the live session is kept
    assert client.get("/api/auth/me").status_code == 200


def _opted_in(app: FastAPI) -> str:
    c = TestClient(app, base_url="http://testserver")
    s = register(c)
    assert c.put("/api/leaderboard/opt-in", json={"opt_in": True}, headers=csrf_headers(s)).status_code == 200
    return str(s["user"]["id"])


def test_leaderboard_keeps_the_best_in_one_document(app: FastAPI, db: Any) -> None:
    uid = _opted_in(app)
    assert store.submit(uid, "asset-07", 70.0) is True
    assert store.submit(uid, "asset-07", 60.0) is False
    assert store.submit(uid, "asset-07", 70.0) is False  # a tie is not a new best
    assert store.submit(uid, "asset-07", 81.234) is True
    docs = list(db[LEADERBOARD].find({"user_id": uid}))
    assert len(docs) == 1 and docs[0]["best_score"] == 81.23 and docs[0]["prompt_id"] == "asset-07"


def test_leaderboard_lower_score_never_overwrites(app: FastAPI, db: Any) -> None:
    """$max makes the write order irrelevant: a late, lower result can't replace a higher one."""
    uid = _opted_in(app)
    store.submit(uid, "asset-07", 90.0)
    db_doc_id = db[LEADERBOARD].find_one({"user_id": uid})["_id"]
    store.submit(uid, "asset-07", 10.0)
    assert db[LEADERBOARD].find_one({"_id": db_doc_id})["best_score"] == 90.0


def test_analysis_survives_a_leaderboard_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression: a local `import traceback` made the leaderboard's error handler raise
    UnboundLocalError, which turned a finished analysis into an error."""
    from backend.api.routers import analysis
    from backend.leaderboard import router as lb_router
    from ml.inference import predict

    class FakePredictor:
        def predict_audio(self, **_: Any) -> dict[str, Any]:
            return {"mode": "sandbox", "score": {"total": 77.0, "buckets": {}}, "flaws": []}

    monkeypatch.setattr(predict.SpeechFlawPredictor, "get_instance", classmethod(lambda cls: FakePredictor()))

    def boom(*_: Any) -> dict[str, object]:
        raise RuntimeError("leaderboard down")

    monkeypatch.setattr(lb_router, "submit_result", boom)
    analysis.job_store["j1"] = {"status": "processing", "owner_id": "u1", "created_at": 0}
    analysis.process_audio_pipeline("j1", b"audio", None, "sandbox", "hello", "asset-07")
    job = analysis.job_store.pop("j1")
    assert job["status"] == "completed"
    assert job["result"]["score"]["total"] == 77.0
    assert job["result"]["leaderboard"]["submitted"] is False


def test_sign_in_with_strong_password_still_works(client: TestClient) -> None:
    """Smoke test: the index changes don't break the normal sign-in path."""
    register(client)
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers={"X-Requested-With": "SpeechArena"})
    assert r.status_code == 200
