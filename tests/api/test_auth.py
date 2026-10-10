from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.auth.cli import _update
from backend.auth.config import get_settings
from backend.auth.db import USERS, utcnow
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
    keys = session_keys(rds)
    assert len(keys) == 1
    token = client.cookies.get("sa_session")
    # Only the token's hash is stored, and the session is in Redis, not MongoDB.
    assert token and token not in keys[0] and token not in str(rds.hgetall(keys[0]))
    assert "sessions" not in db.list_collection_names()
    cfg = get_settings()
    assert 0 < rds.ttl(keys[0]) <= cfg.idle_timeout_hours * 3600  # Redis expires idle sessions itself


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
    register(client)
    cfg = get_settings()
    (key,) = session_keys(rds)
    rds.hset(key, "last_seen_at", (utcnow() - timedelta(hours=cfg.idle_timeout_hours + 1)).isoformat())
    assert client.get("/api/private").status_code == 401
    assert session_keys(rds) == []  # the stale session was deleted

    client.cookies.clear()
    register(client, email="bo@example.com", name="Bo")
    (key,) = session_keys(rds)
    rds.hset(key, "expires_at", (utcnow() - timedelta(seconds=1)).isoformat())
    assert client.get("/api/private").status_code == 401

    # And when Redis's own expiry fires, the session is simply gone.
    client.cookies.clear()
    register(client, email="cy@example.com", name="Cy")
    for k in rds.scan_iter(match="sa:sess:*"):
        rds.delete(k)
    assert client.get("/api/private").status_code == 401


def test_sign_out_deletes_the_session_from_redis(client: TestClient, rds: Any) -> None:
    s = register(client)
    assert len(session_keys(rds)) == 1
    assert client.post("/api/auth/logout", headers=csrf_headers(s)).status_code == 200
    assert session_keys(rds) == [] and list(rds.scan_iter(match="sa:sess:id:*")) == []


def test_session_store_down_gives_503(app: FastAPI) -> None:
    import fakeredis

    from backend.redis_client import use_client

    c = TestClient(app, base_url="http://testserver")
    register(c)
    server = fakeredis.FakeServer()
    server.connected = False  # every command, pipelines included, raises ConnectionError
    use_client(fakeredis.FakeRedis(server=server, decode_responses=True))
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
