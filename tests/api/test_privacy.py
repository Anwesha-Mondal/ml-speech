from __future__ import annotations

import io
import wave
from collections.abc import Iterator
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.auth.cli import _update
from backend.auth.config import get_settings
from backend.auth.db import AUDIT, CONSENTS, USERS, User, utcnow
from backend.auth.ratelimit import limiter
from backend.privacy.config import DEFAULT_CONFIG, PrivacySettings, get_privacy_settings
from backend.privacy.legal import get_docs
from backend.privacy.retention import purge

from .conftest import AGREE, HDR, STRONG, csrf_headers, register, session_keys


@pytest.fixture(autouse=True)
def small_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    raw = yaml.safe_load(DEFAULT_CONFIG.read_text(encoding="utf-8"))
    raw["uploads"]["max_mb"] = 1
    p = tmp_path / "privacy.yaml"
    p.write_text(yaml.safe_dump(raw), encoding="utf-8")
    monkeypatch.setenv("SA_PRIVACY_CONFIG", str(p))
    get_privacy_settings.cache_clear()
    get_docs.cache_clear()
    yield
    get_privacy_settings.cache_clear()
    get_docs.cache_clear()


def wav_bytes(seconds: float = 0.2) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"\x00\x01" * int(16000 * seconds))
    return buf.getvalue()


# ---------- legal documents ----------
def test_legal_documents_are_public_and_versioned(client: TestClient) -> None:
    idx = client.get("/api/legal").json()
    slugs = {d["slug"] for d in idx["documents"]}
    assert slugs == {"privacy", "terms", "cookies"}
    assert all(d["version"] and d["effective"] for d in idx["documents"])
    doc = client.get("/api/legal/privacy").json()
    assert doc["title"] == "Privacy Policy" and "never stored" in doc["body"]
    assert client.get("/api/legal/nope").status_code == 404


# ---------- consent at sign-up and on policy updates ----------
def test_signup_requires_agreement_and_records_it(client: TestClient, db: Any) -> None:
    body = {"email": "ana@example.com", "display_name": "Ana", "password": STRONG}
    assert client.post("/api/auth/register", json=body, headers=HDR).status_code == 422
    assert client.post("/api/auth/register", json={**body, "accept_terms": True}, headers=HDR).status_code == 422
    r = client.post("/api/auth/register", json={**body, **AGREE}, headers=HDR)
    assert r.status_code == 201 and r.json()["consent_needed"] == []
    docs = {c["document"]: c["version"] for c in db[CONSENTS].find()}
    versions = {d.slug: d.version for d in get_docs().values()}
    assert docs == {"terms": versions["terms"], "privacy": versions["privacy"]}


def test_updated_terms_block_features_until_accepted(app: FastAPI, db: Any) -> None:
    from fastapi import Depends

    from backend.auth import require_user

    @app.get("/api/feature")
    def feature(_: User = Depends(require_user)) -> dict[str, bool]:
        return {"ok": True}

    c = TestClient(app, base_url="http://testserver")
    s = register(c)
    assert c.get("/api/feature").status_code == 200

    # Simulate a new Terms version: the user's accepted version is now out of date.
    db[CONSENTS].update_many({"document": "terms"}, {"$set": {"version": "0.9"}})
    assert c.get("/api/auth/me").json()["consent_needed"] == ["terms"]
    blocked = c.get("/api/feature")
    assert blocked.status_code == 403 and blocked.json()["detail"].startswith("CONSENT_REQUIRED")
    # Account endpoints stay usable (settings, sign-out, export, delete).
    assert c.get("/api/auth/sessions").status_code == 200

    assert c.post("/api/privacy/accept", json={"documents": ["bogus"]}, headers=csrf_headers(s)).status_code == 422
    r = c.post("/api/privacy/accept", json={"documents": ["terms"]}, headers=csrf_headers(s))
    assert r.status_code == 200 and r.json()["outstanding"] == []
    assert c.get("/api/feature").status_code == 200


def test_cookie_choice_is_recorded(client: TestClient, db: Any) -> None:
    s = register(client)
    r = client.post("/api/privacy/cookie-consent", json={"preferences": True, "history": False}, headers=csrf_headers(s))
    assert r.status_code == 200
    recs = list(db[CONSENTS].find({"document": "cookies"}))
    assert len(recs) == 1 and recs[0]["choice"] == "preferences=1,history=0"


# ---------- export and deletion ----------
def test_export_contains_my_data_and_no_secrets(client: TestClient, rds: Any) -> None:
    register(client)
    r = client.get("/api/privacy/export")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    data = r.json()
    assert data["account"]["email"] == "ana@example.com"
    text = r.text
    assert "scrypt$" not in text and "token_hash" not in text and "csrf" not in text.lower()
    (key,) = session_keys(rds)
    assert key.rsplit(":", 1)[1] not in text  # no token hash
    assert len(data["sessions"]) == 1 and data["sessions"][0]["ip"]
    assert {c["document"] for c in data["consents"]} == {"terms", "privacy"}
    assert data["account"]["leaderboard_opt_in"] is False and data["leaderboard"] == []


def test_delete_account(app: FastAPI, db: Any, rds: Any) -> None:
    c = TestClient(app, base_url="http://testserver")
    s = register(c)
    assert c.post("/api/privacy/delete-account", json={"password": STRONG, "confirm": "yes"}, headers=csrf_headers(s)).status_code == 422
    assert c.post("/api/privacy/delete-account", json={"password": "wrong-pass-xyz", "confirm": "DELETE"}, headers=csrf_headers(s)).status_code == 400
    assert c.post("/api/privacy/delete-account", json={"password": STRONG, "confirm": "DELETE"}).status_code == 403  # no CSRF
    ok = c.post("/api/privacy/delete-account", json={"password": STRONG, "confirm": "DELETE"}, headers=csrf_headers(s))
    assert ok.status_code == 200
    assert c.get("/api/auth/me").status_code == 401

    assert db[USERS].count_documents({}) == 0
    assert session_keys(rds) == []
    assert db[CONSENTS].count_documents({}) == 0
    events = list(db[AUDIT].find())
    assert events and all(e["email"] == "" and e["user_id"] is None and e["ip"] == "" for e in events)
    c.cookies.clear()
    assert c.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR).status_code == 401


def test_last_admin_cannot_delete_themselves(client: TestClient) -> None:
    s = register(client, email="admin@example.com", name="Admin")
    _update("admin@example.com", promote=True)
    r = client.post("/api/privacy/delete-account", json={"password": STRONG, "confirm": "DELETE"}, headers=csrf_headers(s))
    assert r.status_code == 400 and "administrator" in r.json()["detail"]


# ---------- enumeration ----------
def test_unknown_email_locks_like_a_real_account(client: TestClient) -> None:
    register(client)
    client.cookies.clear()
    cfg = get_settings()

    def attempts(email: str) -> list[int]:
        return [
            client.post("/api/auth/login", json={"email": email, "password": "wrong-password-123"}, headers=HDR).status_code
            for _ in range(cfg.max_failed_attempts + 1)
        ]

    real = attempts("ana@example.com")
    limiter.reset()  # the per-IP sign-in limit (10/min) is a separate control; isolate the lockout
    fake = attempts("ghost@example.com")
    assert real == fake == [401] * cfg.max_failed_attempts + [423]


# ---------- retention ----------
def test_retention_purges_old_audit_events(client: TestClient, db: Any) -> None:
    """The explicit purge applies the same rule as the TTL index (for servers where the
    TTL monitor is off). Drop the index so only `purge` can remove anything here."""
    db[AUDIT].drop_index("ttl_at")
    register(client)
    db[AUDIT].insert_one({"event": "login", "at": utcnow() - timedelta(days=400), "email": "old@example.com"})
    assert purge(db, get_privacy_settings()) == {"audit_events": 1}
    assert db[AUDIT].count_documents({}) >= 1  # recent events kept
    assert client.get("/api/auth/me").status_code == 200


def test_sign_in_still_works_when_retention_runs(client: TestClient, db: Any) -> None:
    """Regression: purge used to crash when it ran inside sign-in (aware vs naive datetimes)."""
    from backend.privacy import retention

    register(client)
    db[AUDIT].drop_index("ttl_at")
    db[AUDIT].insert_one({"event": "login", "at": utcnow() - timedelta(days=400), "email": "old@example.com"})
    client.cookies.clear()
    retention._last_run = 0.0  # force the purge to run during this sign-in
    r = client.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR)
    assert r.status_code == 200
    assert db[AUDIT].find_one({"email": "old@example.com"}) is None


def test_retention_ttl_index(db: Any) -> None:
    """MongoDB deletes old audit events itself, even while the API is down."""
    cfg = get_privacy_settings()
    idx = {i["name"]: i for i in db[AUDIT].list_indexes()}
    assert idx["ttl_at"]["expireAfterSeconds"] == cfg.audit_days * 86400


def test_privacy_settings_loaded() -> None:
    cfg = get_privacy_settings()
    assert isinstance(cfg, PrivacySettings) and cfg.upload_max_bytes == 1024 * 1024


# ---------- analysis endpoints: uploads and job privacy ----------
@pytest.fixture()
def analysis_app(app: FastAPI) -> FastAPI:
    from backend.api.routers import analysis

    analysis.job_store.clear()
    app.include_router(analysis.router, prefix="/api")
    return app


def test_upload_limits(analysis_app: FastAPI) -> None:
    c = TestClient(analysis_app, base_url="http://testserver")
    s = register(c)
    h = csrf_headers(s)
    form = {"mode": "sandbox", "transcript": ""}
    txt = c.post("/api/analyze", files={"participant": ("notes.txt", b"hello", "text/plain")}, data=form, headers=h)
    assert txt.status_code == 415
    big = c.post("/api/analyze", files={"participant": ("big.wav", b"\0" * (1024 * 1024 + 1), "audio/wav")}, data=form, headers=h)
    assert big.status_code == 413
    empty = c.post("/api/analyze", files={"participant": ("e.wav", b"", "audio/wav")}, data=form, headers=h)
    assert empty.status_code == 422
    bad_mode = c.post("/api/analyze", files={"participant": ("a.wav", wav_bytes(), "audio/wav")}, data={**form, "mode": "x"}, headers=h)
    assert bad_mode.status_code == 422


def test_jobs_are_private_even_from_admins(analysis_app: FastAPI) -> None:
    from backend.api.routers import analysis

    owner = TestClient(analysis_app, base_url="http://testserver")
    other = TestClient(analysis_app, base_url="http://testserver")
    admin = TestClient(analysis_app, base_url="http://testserver")
    so = register(owner, email="owner@example.com", name="Owner")
    register(other, email="other@example.com", name="Other")
    register(admin, email="admin@example.com", name="Admin")
    _update("admin@example.com", promote=True)

    r = owner.post(
        "/api/analyze",
        files={"participant": ("a.wav", wav_bytes(), "audio/wav")},
        data={"mode": "sandbox", "transcript": "hello there"},
        headers=csrf_headers(so),
    )
    assert r.status_code == 200
    job = r.json()["job_id"]
    for c in (other, admin):
        assert c.get(f"/api/jobs/{job}").json()["status"] == "not_found"
    mine = owner.get(f"/api/jobs/{job}").json()
    assert mine["status"] in {"completed", "error"}
    assert "owner_id" not in mine and "created_at" not in mine
    if mine["status"] == "error":
        assert "Traceback" not in mine["message"] and "\\" not in mine["message"]

    # Expired results disappear.
    analysis.job_store[job]["created_at"] -= get_privacy_settings().job_results_minutes * 60 + 1
    assert owner.get(f"/api/jobs/{job}").json()["status"] == "not_found"


def test_api_responses_forbid_framing_and_loading(client: TestClient) -> None:
    r = client.get("/api/legal")
    assert r.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert r.headers["x-frame-options"] == "DENY"
    assert "strict-transport-security" not in r.headers  # only with COOKIE_SECURE=1
