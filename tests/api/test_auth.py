from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.auth.cli import _update
from backend.auth.config import get_settings
from backend.auth.db import PASSWORD_RESETS, SESSIONS, USERS, utcnow
from backend.auth.passwords import check_policy, hash_password, needs_rehash, verify_password

from .conftest import AGREE, HDR, STRONG, csrf_headers, register, session_keys


# ---------- passwords ----------
def test_hash_roundtrip_and_tamper(app: FastAPI) -> None:
    cfg = get_settings()
    h = hash_password(STRONG, cfg)
    assert h.startswith("scrypt$") and STRONG not in h
    assert verify_password(STRONG, h)
    assert not verify_password(STRONG + "x", h)
    assert not verify_password(STRONG, h[:-4] + "AAAA")
    assert not verify_password(STRONG, "garbage")
    assert hash_password(STRONG, cfg) != h  # unique salt


def test_needs_rehash_when_parameters_change(app: FastAPI) -> None:
    cfg = get_settings()
    h = hash_password(STRONG, cfg)
    assert not needs_rehash(h, cfg)
    assert needs_rehash(h.replace("scrypt$1024$", "scrypt$512$", 1), cfg)


def test_policy() -> None:
    cfg = get_settings()
    assert check_policy(STRONG, cfg).ok
    assert check_policy("tidal-88", cfg).ok  # 8 characters passes
    assert not check_policy("tidal-8", cfg).ok  # 7 characters fails min length
    assert not check_policy("short", cfg).ok
    assert not check_policy("password1234", cfg).ok  # blocklisted base word
    assert not check_policy("aaaaaaaaaaaaaaa", cfg).ok
    assert not check_policy("abcdefghijklmn", cfg).ok
    assert not check_policy("ana.lopez-river-77", cfg, email="ana.lopez@example.com").ok
    assert not check_policy(" leading-space-pw ", cfg).ok
    assert not check_policy("x" * 129 + "Q1", cfg).ok


def test_policy_rejects_partial_name_and_sequences() -> None:
    cfg = get_settings()
    # Part of the display name ("priya" from "Priyanka") plus a number run.
    assert not check_policy("priyank98#river", cfg, email="p.k@example.com", display_name="Priyanka").ok
    # Part of the email's local part.
    assert not check_policy("studentharbor-77", cfg, email="maya.student42@example.com", display_name="Maya").ok
    # Sequential runs anywhere in the password, either direction.
    assert not check_policy("lantern-12345-xq", cfg).ok
    assert not check_policy("canvas-54321-xq", cfg).ok
    assert not check_policy("qwertharbor-77!", cfg).ok
    # Unrelated words with short digit groups still pass.
    assert check_policy("violet-harbor-canvas-42", cfg, email="p.k@example.com", display_name="Priyanka").ok
    assert check_policy("tidal-ember-lantern-9", cfg, email="maya.student42@example.com", display_name="Maya").ok


# ---------- registration & sessions ----------
def test_register_sets_secure_cookie_and_hides_hash(client: TestClient, db: Any, rds: Any) -> None:
    r = client.post(
        "/api/auth/register",
        json={"email": "Ana@Example.com ", "display_name": "Ana", "password": STRONG, **AGREE},
        headers=HDR,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "ana@example.com"
    assert body["user"]["role"] == "user"
    assert "password" not in str(body).lower().replace("password_changed_at", "")
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api" in cookie

    user = db[USERS].find_one()
    assert user is not None and user["password_hash"].startswith("scrypt$")
    sessions = list(db[SESSIONS].find())
    assert len(sessions) == 1
    token = client.cookies.get("sa_session")
    # Only the token's hash is stored in MongoDB, never the raw token.
    assert token and token != sessions[0]["token_hash"]
    assert "sessions" in db.list_collection_names()


def test_register_rejects_weak_duplicate_and_bad_email(client: TestClient) -> None:
    bad = client.post("/api/auth/register", json={"email": "a@b.co", "display_name": "A", "password": "password1234", **AGREE}, headers=HDR)
    assert bad.status_code == 422
    assert client.post("/api/auth/register", json={"email": "nope", "display_name": "A", "password": STRONG, **AGREE}, headers=HDR).status_code == 422
    register(client)
    client.cookies.clear()
    dup = client.post("/api/auth/register", json={"email": "ANA@example.com", "display_name": "Other", "password": STRONG, **AGREE}, headers=HDR)
    assert dup.status_code == 409


def test_me_requires_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    register(client)
    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["user"]["email"] == "ana@example.com"
    assert me.headers["cache-control"] == "no-store"


def test_forged_cookie_is_rejected(client: TestClient) -> None:
    register(client)
    client.cookies.set("sa_session", "forged-token-value", path="/api")
    assert client.get("/api/private").status_code == 401


# ---------- CSRF ----------
def test_state_changes_need_custom_header_and_csrf(client: TestClient) -> None:
    s = register(client)
    assert client.post("/api/private").status_code == 403  # no X-Requested-With
    assert client.post("/api/private", headers=HDR).status_code == 403  # no CSRF token
    assert client.post("/api/private", headers={**HDR, "X-CSRF-Token": "wrong"}).status_code == 403
    assert client.post("/api/private", headers=csrf_headers(s)).status_code == 200
    assert client.get("/api/private").status_code == 200  # reads need no token


def test_login_requires_custom_header(client: TestClient) -> None:
    register(client)
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG})
    assert r.status_code == 403


# ---------- login, enumeration, lockout, rate limit ----------
def test_login_errors_are_generic(client: TestClient) -> None:
    register(client)
    client.cookies.clear()
    unknown = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": STRONG}, headers=HDR)
    wrong = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "wrong-password-123"}, headers=HDR)
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]
    ok = client.post("/api/auth/login", json={"email": "ANA@example.com", "password": STRONG}, headers=HDR)
    assert ok.status_code == 200 and ok.json()["csrf_token"]


def test_lockout_after_repeated_failures(client: TestClient, db: Any) -> None:
    register(client)
    client.cookies.clear()
    cfg = get_settings()
    for _ in range(cfg.max_failed_attempts):
        r = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "wrong-password-123"}, headers=HDR)
        assert r.status_code == 401
    locked = client.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR)
    assert locked.status_code == 423  # even the right password is refused while locked

    db[USERS].update_one({}, {"$set": {"locked_until": utcnow() - timedelta(seconds=1)}})
    assert client.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR).status_code == 200


def test_login_rate_limit_per_ip(client: TestClient) -> None:
    cfg = get_settings()
    codes = [
        client.post("/api/auth/login", json={"email": f"x{i}@example.com", "password": STRONG}, headers=HDR).status_code
        for i in range(cfg.login_per_minute + 1)
    ]
    assert codes[-1] == 429 and set(codes[:-1]) == {401}


# ---------- logout, expiry, password change, sessions ----------
def test_logout_revokes_session(client: TestClient) -> None:
    s = register(client)
    token = client.cookies.get("sa_session")
    assert client.post("/api/auth/logout", headers=csrf_headers(s)).status_code == 200
    client.cookies.set("sa_session", token, path="/api")  # replaying the old cookie must fail
    assert client.get("/api/auth/me").status_code == 401


def test_idle_and_absolute_expiry(client: TestClient, rds: Any) -> None:
    from backend.auth.db import get_db

    register(client)
    cfg = get_settings()
    get_db()[SESSIONS].update_one({}, {"$set": {"last_seen_at": utcnow() - timedelta(hours=cfg.idle_timeout_hours + 1)}})
    assert client.get("/api/private").status_code == 401
    assert session_keys(rds) == []  # the stale session was deleted

    client.cookies.clear()
    register(client, email="bo@example.com", name="Bo")
    get_db()[SESSIONS].update_one({}, {"$set": {"expires_at": utcnow() - timedelta(seconds=1)}})
    assert client.get("/api/private").status_code == 401

    # And when the session is simply removed from MongoDB, the session is gone.
    client.cookies.clear()
    register(client, email="cy@example.com", name="Cy")
    get_db()[SESSIONS].delete_many({})
    assert client.get("/api/private").status_code == 401


def test_sign_out_deletes_the_session(client: TestClient, rds: Any) -> None:
    s = register(client)
    assert len(session_keys(rds)) == 1
    assert client.post("/api/auth/logout", headers=csrf_headers(s)).status_code == 200
    assert session_keys(rds) == []


def test_session_store_down_gives_503(app: FastAPI, monkeypatch: Any) -> None:
    from contextlib import contextmanager

    from fastapi import HTTPException, status

    from backend.auth import sessions

    c = TestClient(app, base_url="http://testserver")
    register(c)

    @contextmanager
    def _broken_col(*args: Any, **kwargs: Any) -> Any:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, sessions.STORE_DOWN)
        yield

    monkeypatch.setattr(sessions, "_session_col", _broken_col)
    me = c.get("/api/auth/me")
    assert me.status_code == 503 and "session store" in me.json()["detail"]
    c.cookies.clear()
    r = c.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR)
    assert r.status_code == 503


def test_change_password_revokes_other_sessions(app: FastAPI) -> None:
    a = TestClient(app, base_url="http://testserver")
    b = TestClient(app, base_url="http://testserver")
    s = register(a)
    assert b.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR).status_code == 200

    bad = a.post("/api/auth/change-password", json={"current_password": "nope-nope-nope", "new_password": "tidal-ember-lantern-9"}, headers=csrf_headers(s))
    assert bad.status_code == 400
    weak = a.post("/api/auth/change-password", json={"current_password": STRONG, "new_password": "password1234"}, headers=csrf_headers(s))
    assert weak.status_code == 422
    ok = a.post("/api/auth/change-password", json={"current_password": STRONG, "new_password": "tidal-ember-lantern-9"}, headers=csrf_headers(s))
    assert ok.status_code == 200 and ok.json()["revoked_sessions"] == 1

    assert a.get("/api/auth/me").status_code == 200  # this device stays signed in
    assert b.get("/api/auth/me").status_code == 401  # the other device is signed out
    a.cookies.clear()
    assert a.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR).status_code == 401
    assert a.post("/api/auth/login", json={"email": "ana@example.com", "password": "tidal-ember-lantern-9"}, headers=HDR).status_code == 200


def test_list_and_revoke_sessions_only_own(app: FastAPI) -> None:
    a = TestClient(app, base_url="http://testserver")
    a2 = TestClient(app, base_url="http://testserver")
    eve = TestClient(app, base_url="http://testserver")
    s = register(a)
    a2.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR)
    se = register(eve, email="eve@example.com", name="Eve")

    sessions = a.get("/api/auth/sessions").json()["sessions"]
    assert len(sessions) == 2 and sum(x["current"] for x in sessions) == 1
    other = next(x for x in sessions if not x["current"])

    # Eve can't revoke Ana's session, and can't tell it exists.
    assert eve.delete(f"/api/auth/sessions/{other['id']}", headers=csrf_headers(se)).status_code == 404
    assert a.delete(f"/api/auth/sessions/{other['id']}", headers=csrf_headers(s)).status_code == 200
    assert a2.get("/api/auth/me").status_code == 401


# ---------- authorization ----------
def test_roles_and_admin_guards(app: FastAPI) -> None:
    admin = TestClient(app, base_url="http://testserver")
    user = TestClient(app, base_url="http://testserver")
    sa = register(admin, email="admin@example.com", name="Admin")
    su = register(user, email="user@example.com", name="User")

    assert user.get("/api/admin-only").status_code == 403
    assert user.get("/api/admin/users").status_code == 403
    assert _update("admin@example.com", promote=True) == 0
    assert admin.get("/api/admin-only").status_code == 200

    users = admin.get("/api/admin/users").json()["users"]
    assert {u["email"] for u in users} == {"admin@example.com", "user@example.com"}
    assert all("password_hash" not in u for u in users)
    me_id = next(u["id"] for u in users if u["email"] == "admin@example.com")
    uid = next(u["id"] for u in users if u["email"] == "user@example.com")

    # Can't demote yourself or remove the last admin.
    assert admin.patch(f"/api/admin/users/{me_id}", json={"role": "user"}, headers=csrf_headers(sa)).status_code == 400
    # A regular user can't grant themselves admin.
    assert user.patch(f"/api/admin/users/{uid}", json={"role": "admin"}, headers=csrf_headers(su)).status_code == 403

    # Disabling a user signs them out everywhere and blocks sign-in.
    assert admin.patch(f"/api/admin/users/{uid}", json={"is_active": False}, headers=csrf_headers(sa)).status_code == 200
    assert user.get("/api/auth/me").status_code == 401
    user.cookies.clear()
    assert user.post("/api/auth/login", json={"email": "user@example.com", "password": STRONG}, headers=HDR).status_code == 403

    events = [e["event"] for e in admin.get("/api/admin/audit").json()["events"]]
    assert "admin_user_updated" in events and "login_disabled" in events


def test_admin_unlock_is_audited_and_restores_sign_in(app: FastAPI) -> None:
    admin = TestClient(app, base_url="http://testserver")
    user = TestClient(app, base_url="http://testserver")
    sa = register(admin, email="admin@example.com", name="Admin")
    register(user, email="user@example.com", name="User")
    _update("admin@example.com", promote=True)
    user.cookies.clear()
    for _ in range(get_settings().max_failed_attempts):
        user.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong-password-123"}, headers=HDR)
    assert user.post("/api/auth/login", json={"email": "user@example.com", "password": STRONG}, headers=HDR).status_code == 423

    uid = next(u["id"] for u in admin.get("/api/admin/users").json()["users"] if u["email"] == "user@example.com")
    r = admin.patch(f"/api/admin/users/{uid}", json={"is_active": True}, headers=csrf_headers(sa))
    assert r.status_code == 200 and r.json()["user"]["locked_until"] is None
    details = [e["detail"] for e in admin.get("/api/admin/audit").json()["events"] if e["event"] == "admin_user_updated"]
    assert any("unlocked" in d for d in details)
    assert user.post("/api/auth/login", json={"email": "user@example.com", "password": STRONG}, headers=HDR).status_code == 200


def _link_token(caplog: pytest.LogCaptureFixture) -> str:
    """The reset token, read from the delivered link (the 'log' channel), as its owner would."""
    links = [r.getMessage().rsplit(" ", 1)[1] for r in caplog.records if r.name == "speech_arena.password_reset"]
    assert links, "no reset link was delivered"
    url = urlparse(links[-1])
    assert url.scheme == "http" and url.netloc == "app.invalid" and url.path == "/reset-password"
    return parse_qs(url.query)["token"][0]


def test_forgot_password_never_returns_the_token(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    """Regression: the token used to be in the response, so anyone could take over any account."""
    register(client)
    caplog.set_level(logging.WARNING, logger="speech_arena.password_reset")
    real = client.post("/api/auth/forgot-password", json={"email": "ana@example.com"}, headers=HDR)
    fake = client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"}, headers=HDR)
    assert real.status_code == fake.status_code == 200
    assert real.json() == fake.json()  # no hint whether the email has an account
    token = _link_token(caplog)
    assert token not in real.text and "token" not in real.json()


def test_reset_delivery_none_sends_nothing(client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, db: Any) -> None:
    monkeypatch.setenv("PASSWORD_RESET_DELIVERY", "none")
    register(client)
    caplog.set_level(logging.DEBUG, logger="speech_arena.password_reset")
    r = client.post("/api/auth/forgot-password", json={"email": "ana@example.com"}, headers=HDR)
    assert r.status_code == 200 and "token" not in r.json()
    assert not [rec for rec in caplog.records if rec.name == "speech_arena.password_reset"]
    assert db[PASSWORD_RESETS].count_documents({"email": "ana@example.com"}) == 1  # an admin can still issue one


def test_cli_reset_link(app: FastAPI, capsys: pytest.CaptureFixture[str]) -> None:
    from backend.auth.cli import main

    c = TestClient(app, base_url="http://testserver")
    register(c)
    assert main(["reset-link", "--email", "ana@example.com"]) == 0
    link = capsys.readouterr().out.strip().splitlines()[-1]
    token = parse_qs(urlparse(link).query)["token"][0]
    r = c.post("/api/auth/reset-password", json={"token": token, "new_password": "quartz-meadow-31"}, headers=HDR)
    assert r.status_code == 200
    assert main(["reset-link", "--email", "ghost@example.com"]) == 1


def test_forgot_and_reset_password_flow(app: FastAPI, db: Any, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.WARNING, logger="speech_arena.password_reset")
    client = TestClient(app, base_url="http://testserver")
    register(client, email="ana@example.com", name="Ana")

    # Another client session is active
    other = TestClient(app, base_url="http://testserver")
    assert other.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR).status_code == 200

    # Request password reset
    r = client.post("/api/auth/forgot-password", json={"email": "Ana@example.com"}, headers=HDR)
    assert r.status_code == 200
    assert "reset link has been sent" in r.json()["message"]
    token = _link_token(caplog)

    # Check DB has hashed token, not plain token
    entry = db[PASSWORD_RESETS].find_one({"email": "ana@example.com"})
    assert entry is not None
    assert entry["token_hash"] != token
    assert not entry["used"]

    # Reset password with valid token and 8-character new password
    NEW_PW = "tidal-88"
    res = client.post("/api/auth/reset-password", json={"token": token, "new_password": NEW_PW}, headers=HDR)
    assert res.status_code == 200
    assert "Password successfully reset" in res.json()["message"]

    # Token is marked used
    entry = db[PASSWORD_RESETS].find_one({"email": "ana@example.com"})
    assert entry["used"] is True

    # Replay fails
    replay = client.post("/api/auth/reset-password", json={"token": token, "new_password": STRONG}, headers=HDR)
    assert replay.status_code == 400
    assert "invalid" in replay.json()["detail"].lower()

    # Active sessions revoked
    assert other.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 401

    # Login with old password fails
    assert client.post("/api/auth/login", json={"email": "ana@example.com", "password": STRONG}, headers=HDR).status_code == 401

    # Login with new password succeeds
    assert client.post("/api/auth/login", json={"email": "ana@example.com", "password": NEW_PW}, headers=HDR).status_code == 200


def test_reset_password_errors_and_expiry(app: FastAPI, db: Any, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.WARNING, logger="speech_arena.password_reset")
    client = TestClient(app, base_url="http://testserver")
    register(client, email="bob@example.com", name="Bob")

    # Unknown email returns 200 to prevent enumeration, but creates no DB entry
    r = client.post("/api/auth/forgot-password", json={"email": "nonexistent@example.com"}, headers=HDR)
    assert r.status_code == 200
    assert "If an account with this email exists" in r.json()["message"] and "token" not in r.json()
    assert db[PASSWORD_RESETS].find_one({"email": "nonexistent@example.com"}) is None

    # Invalid token format (< 16 chars) -> 422
    assert client.post("/api/auth/reset-password", json={"token": "short", "new_password": "tidal-ember-lantern-9"}, headers=HDR).status_code == 422

    # Unknown token (>= 16 chars) -> 400
    res = client.post("/api/auth/reset-password", json={"token": "nonexistent-reset-token-12345", "new_password": "tidal-ember-lantern-9"}, headers=HDR)
    assert res.status_code == 400

    # Generate token for Bob
    client.post("/api/auth/forgot-password", json={"email": "bob@example.com"}, headers=HDR)
    token = _link_token(caplog)

    # New password fails policy (< 8 chars)
    short_pw = client.post("/api/auth/reset-password", json={"token": token, "new_password": "tidal-8"}, headers=HDR)
    assert short_pw.status_code == 422
    assert "at least 8 characters" in short_pw.json()["detail"].lower()

    # Expire token in DB
    db[PASSWORD_RESETS].update_one({"email": "bob@example.com"}, {"$set": {"expires_at": utcnow() - timedelta(seconds=1)}})
    exp = client.post("/api/auth/reset-password", json={"token": token, "new_password": "tidal-ember-lantern-9"}, headers=HDR)
    assert exp.status_code == 400
    assert "invalid" in exp.json()["detail"].lower()
