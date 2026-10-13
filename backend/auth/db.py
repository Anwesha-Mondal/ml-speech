"""MongoDB storage: accounts, sign-in sessions, consent records, the security audit log and
leaderboard scores (one database since D-063).

Connection settings come from .env (MONGODB_URI, MONGODB_DB). Retention is enforced by MongoDB
itself through TTL indexes, so ended sessions and old audit events disappear even while the API
is down.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import asdict, dataclass, field, fields
from datetime import UTC, datetime
from typing import Any

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import OperationFailure

from .config import get_settings

log = logging.getLogger(__name__)

USERS = "users"
AUDIT = "audit_events"
CONSENTS = "consent_records"
SESSIONS = "sessions"
LEADERBOARD = "leaderboard_scores"
PASSWORD_RESETS = "password_resets"


def utcnow() -> datetime:
    now = datetime.now(UTC)
    return now.replace(microsecond=(now.microsecond // 1000) * 1000)


def new_id() -> str:
    return uuid.uuid4().hex


# ---------- records ----------
@dataclass
class User:
    email: str
    display_name: str
    password_hash: str
    role: str = "user"  # "user" | "admin"
    is_active: bool = True
    failed_attempts: int = 0
    locked_until: datetime | None = None
    password_changed_at: datetime = field(default_factory=utcnow)
    created_at: datetime = field(default_factory=utcnow)
    last_login_at: datetime | None = None
    # Opt-in: show my display name and best scores on leaderboards.
    leaderboard_opt_in: bool = False
    id: str = field(default_factory=new_id)

    @classmethod
    def from_doc(cls, d: dict[str, Any]) -> User:
        known = {f.name for f in fields(cls)}
        return cls(id=d["_id"], **{k: v for k, v in d.items() if k in known and k != "id"})

    def to_doc(self) -> dict[str, Any]:
        d = asdict(self)
        d["_id"] = d.pop("id")
        return d


# ---------- connection ----------
_client: MongoClient[dict[str, Any]] | None = None
_db: Database[dict[str, Any]] | None = None


def use_database(db: Database[dict[str, Any]] | None) -> None:
    """Point the app at a specific database (tests pass an in-memory mongomock one)."""
    global _db
    _db = db
    if db is not None:
        ensure_indexes(db)


def init_db() -> Database[dict[str, Any]]:
    """Connect using MONGODB_URI / MONGODB_DB from .env and make sure indexes exist."""
    global _client, _db
    if _db is None:
        cfg = get_settings()
        _client = MongoClient(cfg.mongodb_uri, tz_aware=True, serverSelectionTimeoutMS=4000)
        _db = _client[cfg.mongodb_db]
        ensure_indexes(_db)
    return _db


def get_db() -> Database[dict[str, Any]]:
    """FastAPI dependency."""
    return _db if _db is not None else init_db()


def ping() -> bool:
    try:
        get_db().command("ping")
        return True
    except Exception:  # noqa: BLE001 - health check reports any failure as "down"
        return False


def _ttl_index(col: Collection[dict[str, Any]], key: str, seconds: int) -> None:
    try:
        col.create_index([(key, ASCENDING)], expireAfterSeconds=seconds, name=f"ttl_{key}")
    except OperationFailure:
        # The retention period changed in config: update the existing TTL index in place.
        col.database.command("collMod", col.name, index={"name": f"ttl_{key}", "expireAfterSeconds": seconds})


def ensure_indexes(db: Database[dict[str, Any]]) -> None:
    from backend.privacy.config import get_privacy_settings

    p = get_privacy_settings()
    db[USERS].create_index([("email", ASCENDING)], unique=True, name="email_unique")
    db[AUDIT].create_index([("user_id", ASCENDING)], name="by_user")
    _ttl_index(db[AUDIT], "at", p.audit_days * 86400)
    db[CONSENTS].create_index([("user_id", ASCENDING), ("document", ASCENDING)], name="by_user_doc")
    # Sessions: looked up by token hash on every request; listed and revoked per user;
    # deleted by MongoDB at `purge_at` (the earlier of the idle and the absolute expiry).
    db[SESSIONS].create_index([("token_hash", ASCENDING)], unique=True, name="token_hash_unique")
    db[SESSIONS].create_index([("user_id", ASCENDING)], name="by_user")
    _ttl_index(db[SESSIONS], "purge_at", 0)
    # Leaderboard: one board = (scoring_version, prompt_id), read best first.
    db[LEADERBOARD].create_index(
        [("scoring_version", ASCENDING), ("prompt_id", ASCENDING), ("best_score", DESCENDING)], name="by_board"
    )
    db[LEADERBOARD].create_index([("user_id", ASCENDING)], name="by_user")
    # Password resets: single-use tokens, deleted by MongoDB once they expire.
    db[PASSWORD_RESETS].create_index([("token_hash", ASCENDING)], unique=True, name="reset_token_unique")
    db[PASSWORD_RESETS].create_index([("email", ASCENDING)], name="reset_email")
    _ttl_index(db[PASSWORD_RESETS], "expires_at", 0)
