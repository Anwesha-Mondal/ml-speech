"""Sign-in sessions (stored in MongoDB) and the FastAPI dependencies that enforce sign-in, CSRF and roles.

Sessions live in the MongoDB `sessions` collection. Only the SHA-256 of the cookie token is
stored. Each document carries `purge_at`, the earlier of its idle expiry (pushed forward on
activity) and its absolute expiry, and a TTL index on it lets MongoDB delete the session as soon
as it ends. Expiry is also checked on every request, and signing out deletes it at once.
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

from fastapi import Depends, HTTPException, Request, Response, status
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import PyMongoError

from .config import AuthSettings, get_settings
from .db import AUDIT, SESSIONS, USERS, User, get_db, utcnow

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

    def to_doc(self) -> dict[str, Any]:
        return {
            "_id": self.id,
            "id": self.id,
            "token_hash": self.token_hash,
            "csrf_token": self.csrf_token,
            "user_id": self.user_id,
            "created_at": self.created_at,
            "last_seen_at": self.last_seen_at,
            "expires_at": self.expires_at,
            "purge_at": self.expires_at,  # replaced by _purge_at() when stored
            "ip": self.ip,
            "user_agent": self.user_agent,
        }

    @classmethod
    def from_doc(cls, d: dict[str, Any]) -> AuthSession:
        return cls(
            id=str(d.get("_id", d.get("id", ""))),
            token_hash=str(d["token_hash"]),
            csrf_token=str(d["csrf_token"]),
            user_id=str(d["user_id"]),
            expires_at=aware(d["expires_at"]) or utcnow(),
            created_at=aware(d.get("created_at")) or utcnow(),
            last_seen_at=aware(d.get("last_seen_at")) or utcnow(),
            ip=str(d.get("ip", "")),
            user_agent=str(d.get("user_agent", "")),
        )


@contextmanager
def _session_col(db: Db | None = None) -> Iterator[Collection[dict[str, Any]]]:
    """MongoDB collection; an outage becomes a clear 503 instead of a crash."""
    try:
        database = db if db is not None else get_db()
        yield database[SESSIONS]
    except PyMongoError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, STORE_DOWN) from None


def _purge_at(s: AuthSession, cfg: AuthSettings) -> datetime:
    """When MongoDB may delete the session: idle expiry, but never past the absolute expiry."""
    return min(s.last_seen_at + timedelta(hours=cfg.idle_timeout_hours), s.expires_at)


def create_session(
    user: User, request: Request, response: Response, cfg: AuthSettings, db: Db | None = None
) -> AuthSession:
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
    doc = sess.to_doc()
    doc["purge_at"] = _purge_at(sess, cfg)
    with _session_col(db) as col:
        col.insert_one(doc)

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


def get_session_by_id(
    session_id: str, cfg: AuthSettings | None = None, db: Db | None = None
) -> AuthSession | None:
    with _session_col(db) as col:
        d = col.find_one({"_id": session_id})
        return AuthSession.from_doc(d) if d else None


def revoke_session(session_id: str, cfg: AuthSettings | None = None, db: Db | None = None) -> bool:
    """End one session now. Returns False if it had already ended."""
    with _session_col(db) as col:
        res = col.delete_one({"_id": session_id})
        return bool(res.deleted_count > 0)


def list_user_sessions(
    user_id: str, cfg: AuthSettings | None = None, db: Db | None = None
) -> list[AuthSession]:
    """The user's live sessions, most recently used first. Drops IDs whose session already expired."""
    cfg = cfg or get_settings()
    now = utcnow()
    with _session_col(db) as col:
        docs = col.find({"user_id": user_id, "expires_at": {"$gt": now}})
        out: list[AuthSession] = []
        for d in docs:
            sess = AuthSession.from_doc(d)
            if now - sess.last_seen_at < timedelta(hours=cfg.idle_timeout_hours):
                out.append(sess)
            else:
                col.delete_one({"_id": sess.id})
    return sorted(out, key=lambda s: s.last_seen_at, reverse=True)


def revoke_user_sessions(
    user_id: str, except_id: str | None = None, cfg: AuthSettings | None = None, db: Db | None = None
) -> int:
    """End every session of a user (optionally keeping one). Returns how many were ended."""
    query: dict[str, Any] = {"user_id": user_id}
    if except_id:
        query["_id"] = {"$ne": except_id}
    with _session_col(db) as col:
        res = col.delete_many(query)
        return int(res.deleted_count)


@dataclass
class Principal:
    user: User
    session: AuthSession


def _load_principal(request: Request, db: Db, cfg: AuthSettings) -> Principal | None:
    token = request.cookies.get(cfg.cookie_name)
    if not token:
        return None
    th = token_hash(token)
    with _session_col(db) as col:
        d = col.find_one({"token_hash": th})
        if not d:
            return None  # never existed, signed out, or expired
        sess = AuthSession.from_doc(d)
        now = utcnow()
        if now >= sess.expires_at or now - sess.last_seen_at >= timedelta(hours=cfg.idle_timeout_hours):
            col.delete_one({"_id": sess.id})
            return None
        user = get_user(db, sess.user_id)
        if user is None or not user.is_active:
            return None
        if (now - sess.last_seen_at).total_seconds() >= cfg.touch_interval_seconds:
            # Sliding idle window: record the activity and push last_seen_at forward
            sess.last_seen_at = now
            col.update_one({"_id": sess.id}, {"$set": {"last_seen_at": now, "purge_at": _purge_at(sess, cfg)}})
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
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Missing or invalid CSRF token. Reload the page and try again.",
            )
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
