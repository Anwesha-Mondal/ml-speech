"""Sign-in sessions (stored in Redis) and the FastAPI dependencies that enforce sign-in, CSRF and roles.

Redis keys (prefix from configs/auth/auth.yaml → session.redis_prefix):
  <prefix>:tok:<sha256(token)>  hash with the session's fields. The cookie token itself is never stored.
  <prefix>:id:<session id>      → token hash, so a session can be ended by its ID (device list).
  <prefix>:user:<user id>       set of the user's session IDs.

Each session key expires on its own: Redis deletes it after the idle timeout, and never later
than the absolute lifetime. Signing out deletes it at once. Accounts, consent records and the
audit log stay in MongoDB.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import redis
from fastapi import Depends, HTTPException, Request, Response, status
from pymongo.database import Database

from backend.redis_client import client as redis_client

from .config import AuthSettings, get_settings
from .db import AUDIT, USERS, User, get_db, utcnow

Db = Database[dict[str, Any]]

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "X-CSRF-Token"
STORE_DOWN = "Sign-in is temporarily unavailable (the session store can't be reached). Try again shortly."


def aware(dt: datetime | None) -> datetime | None:
    """All stored times are UTC; attach the zone if a driver returned a naive value."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def client_ip(request: Request) -> str:
    # Direct peer only. Put a trusted proxy's forwarded header here if one is added.
    return request.client.host if request.client else ""


def audit(
    db: Db,
    event: str,
    *,
    request: Request | None = None,
    user: User | None = None,
    user_id: str | None = None,
    actor_id: str | None = None,
    email: str = "",
    detail: str = "",
) -> None:
    db[AUDIT].insert_one(
        {
            "at": utcnow(),
            "event": event,
            "user_id": user.id if user else user_id,
            "actor_id": actor_id,
            "email": (user.email if user else email)[:254],
            "ip": client_ip(request) if request else "",
            "detail": detail[:256],
        }
    )


def get_user(db: Db, user_id: str) -> User | None:
    d = db[USERS].find_one({"_id": user_id})
    return User.from_doc(d) if d else None


def get_user_by_email(db: Db, email: str) -> User | None:
    d = db[USERS].find_one({"email": email})
    return User.from_doc(d) if d else None


# ---------- session records ----------
@dataclass
class AuthSession:
    token_hash: str
    csrf_token: str
    user_id: str
    expires_at: datetime
    created_at: datetime = field(default_factory=utcnow)
    last_seen_at: datetime = field(default_factory=utcnow)
    ip: str = ""
    user_agent: str = ""
    id: str = field(default_factory=lambda: uuid.uuid4().hex)

    def to_hash(self) -> dict[str, str]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "csrf_token": self.csrf_token,
            "created_at": self.created_at.isoformat(),
            "last_seen_at": self.last_seen_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "ip": self.ip,
            "user_agent": self.user_agent,
        }

    @classmethod
    def from_hash(cls, th: str, h: dict[str, str]) -> AuthSession:
        return cls(
            token_hash=th,
            csrf_token=h["csrf_token"],
            user_id=h["user_id"],
            expires_at=datetime.fromisoformat(h["expires_at"]),
            created_at=datetime.fromisoformat(h["created_at"]),
            last_seen_at=datetime.fromisoformat(h["last_seen_at"]),
            ip=h.get("ip", ""),
            user_agent=h.get("user_agent", ""),
            id=h["id"],
        )


def _k_tok(cfg: AuthSettings, th: str) -> str:
    return f"{cfg.session_prefix}:tok:{th}"


def _k_id(cfg: AuthSettings, sid: str) -> str:
    return f"{cfg.session_prefix}:id:{sid}"


def _k_user(cfg: AuthSettings, uid: str) -> str:
    return f"{cfg.session_prefix}:user:{uid}"


def _ttl_seconds(s: AuthSession, now: datetime, cfg: AuthSettings) -> int:
    """Idle timeout, but never past the absolute expiry."""
    idle = cfg.idle_timeout_hours * 3600
    left = int((s.expires_at - now).total_seconds())
    return max(1, min(idle, left))


@contextmanager
def _store() -> Iterator[redis.Redis]:
    """The Redis client; an outage becomes a clear 503 instead of a crash."""
    try:
        yield redis_client()
    except redis.RedisError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, STORE_DOWN) from None


def create_session(user: User, request: Request, response: Response, cfg: AuthSettings) -> AuthSession:
    token = secrets.token_urlsafe(cfg.token_bytes)
    now = utcnow()
    sess = AuthSession(
        token_hash=token_hash(token),
        csrf_token=secrets.token_urlsafe(32),
        user_id=user.id,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=cfg.absolute_lifetime_hours),
        ip=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:256],
    )
    ttl = _ttl_seconds(sess, now, cfg)
    with _store() as r:
        pipe = r.pipeline(transaction=True)
        pipe.hset(_k_tok(cfg, sess.token_hash), mapping=sess.to_hash())
        pipe.expire(_k_tok(cfg, sess.token_hash), ttl)
        pipe.set(_k_id(cfg, sess.id), sess.token_hash, ex=ttl)
        pipe.sadd(_k_user(cfg, user.id), sess.id)
        pipe.expire(_k_user(cfg, user.id), cfg.absolute_lifetime_hours * 3600)
        pipe.execute()
    response.set_cookie(
        cfg.cookie_name,
        token,
        max_age=cfg.absolute_lifetime_hours * 3600,
        httponly=True,
        secure=cfg.cookie_secure,
        samesite=cfg.same_site,  # type: ignore[arg-type]
        path="/api",
    )
    return sess


def clear_cookie(response: Response, cfg: AuthSettings) -> None:
    response.delete_cookie(
        cfg.cookie_name, path="/api", httponly=True, secure=cfg.cookie_secure, samesite=cfg.same_site  # type: ignore[arg-type]
    )


def get_session_by_id(session_id: str, cfg: AuthSettings | None = None) -> AuthSession | None:
    cfg = cfg or get_settings()
    with _store() as r:
        th = r.get(_k_id(cfg, session_id))
        if not th:
            return None
        h = r.hgetall(_k_tok(cfg, str(th)))
    return AuthSession.from_hash(str(th), h) if h else None


def revoke_session(session_id: str, cfg: AuthSettings | None = None) -> bool:
    """End one session now. Returns False if it had already ended."""
    cfg = cfg or get_settings()
    with _store() as r:
        th = r.get(_k_id(cfg, session_id))
        uid = r.hget(_k_tok(cfg, str(th)), "user_id") if th else None
        pipe = r.pipeline(transaction=True)
        if th:
            pipe.delete(_k_tok(cfg, str(th)))
        pipe.delete(_k_id(cfg, session_id))
        if uid:
            pipe.srem(_k_user(cfg, str(uid)), session_id)
        pipe.execute()
    return bool(th)


def list_user_sessions(user_id: str, cfg: AuthSettings | None = None) -> list[AuthSession]:
    """The user's live sessions, most recently used first. Drops IDs whose session already expired."""
    cfg = cfg or get_settings()
    out: list[AuthSession] = []
    with _store() as r:
        stale: list[str] = []
        for sid in r.smembers(_k_user(cfg, user_id)):
            th = r.get(_k_id(cfg, str(sid)))
            h = r.hgetall(_k_tok(cfg, str(th))) if th else {}
            if h:
                out.append(AuthSession.from_hash(str(th), h))
            else:
                stale.append(str(sid))
        if stale:
            r.srem(_k_user(cfg, user_id), *stale)
    return sorted(out, key=lambda s: s.last_seen_at, reverse=True)


def revoke_user_sessions(user_id: str, except_id: str | None = None, cfg: AuthSettings | None = None) -> int:
    """End every session of a user (optionally keeping one). Returns how many were ended."""
    cfg = cfg or get_settings()
    n = 0
    for s in list_user_sessions(user_id, cfg):
        if s.id != except_id and revoke_session(s.id, cfg):
            n += 1
    return n


@dataclass
class Principal:
    user: User
    session: AuthSession


def _load_principal(request: Request, db: Db, cfg: AuthSettings) -> Principal | None:
    token = request.cookies.get(cfg.cookie_name)
    if not token:
        return None
    th = token_hash(token)
    with _store() as r:
        h = r.hgetall(_k_tok(cfg, th))
    if not h:
        return None  # never existed, signed out, or expired (Redis removed it)
    sess = AuthSession.from_hash(th, h)
    now = utcnow()
    if now >= sess.expires_at or now - sess.last_seen_at >= timedelta(hours=cfg.idle_timeout_hours):
        revoke_session(sess.id, cfg)
        return None
    user = get_user(db, sess.user_id)
    if user is None or not user.is_active:
        return None
    if (now - sess.last_seen_at).total_seconds() >= cfg.touch_interval_seconds:
        # Sliding idle window: record the activity and push the expiry forward.
        sess.last_seen_at = now
        ttl = _ttl_seconds(sess, now, cfg)
        with _store() as r:
            pipe = r.pipeline(transaction=True)
            pipe.hset(_k_tok(cfg, th), "last_seen_at", now.isoformat())
            pipe.expire(_k_tok(cfg, th), ttl)
            pipe.expire(_k_id(cfg, sess.id), ttl)
            pipe.execute()
    return Principal(user=user, session=sess)


def optional_principal(
    request: Request, db: Db = Depends(get_db), cfg: AuthSettings = Depends(get_settings)
) -> Principal | None:
    return _load_principal(request, db, cfg)


def require_principal(
    request: Request, db: Db = Depends(get_db), cfg: AuthSettings = Depends(get_settings)
) -> Principal:
    """Signed-in user required. State-changing requests must also carry the session's CSRF token."""
    p = _load_principal(request, db, cfg)
    if p is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")
    if request.method not in SAFE_METHODS:
        sent = request.headers.get(CSRF_HEADER, "")
        if not sent or not hmac.compare_digest(sent, p.session.csrf_token):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing or invalid CSRF token. Reload the page and try again.")
    return p


CONSENT_REQUIRED = "CONSENT_REQUIRED"


def _require_current_consent(p: Principal, db: Db) -> None:
    """App features stay locked until the current Terms and Privacy Policy are accepted.
    Account endpoints (sign-out, settings, export, delete) use require_principal and stay open."""
    from backend.privacy.consent import outstanding  # deferred: privacy imports auth

    missing = outstanding(db, p.user.id)
    if missing:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"{CONSENT_REQUIRED}: accept the updated {' and '.join(missing)} to continue.",
        )


def require_user(p: Principal = Depends(require_principal), db: Db = Depends(get_db)) -> User:
    _require_current_consent(p, db)
    return p.user


def require_admin(p: Principal = Depends(require_principal), db: Db = Depends(get_db)) -> User:
    _require_current_consent(p, db)
    if p.user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access required.")
    return p.user
