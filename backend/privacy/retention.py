"""Data retention: delete what we no longer need (ended sessions, old audit events).

MongoDB's TTL indexes (see backend/auth/db.py) do this on their own about once a minute.
`purge` applies the same rules explicitly, so retention also holds where the TTL monitor is off
and for session documents created before `purge_at` existed, and so tests can check the rules.
"""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from pymongo.database import Database

from backend.auth.db import AUDIT, SESSIONS, utcnow

from .config import PrivacySettings

Db = Database[dict[str, Any]]


def purge(db: Db, cfg: PrivacySettings) -> dict[str, int]:
    from backend.auth.config import get_settings

    now = utcnow()
    idle_cutoff = now - timedelta(hours=get_settings().idle_timeout_hours)
    sessions = db[SESSIONS].delete_many(
        {"$or": [{"expires_at": {"$lte": now}}, {"last_seen_at": {"$lte": idle_cutoff}}]}
    )
    audit = db[AUDIT].delete_many({"at": {"$lt": now - timedelta(days=cfg.audit_days)}})
    return {"sessions": int(sessions.deleted_count), "audit_events": int(audit.deleted_count)}


_last_run = 0.0


def maybe_purge(db: Db, every_s: float = 3600) -> None:
    """Run `purge` at most once per `every_s` seconds (called on sign-in and at start-up)."""
    global _last_run
    if time.monotonic() - _last_run < every_s and _last_run:
        return
    _last_run = time.monotonic()
    from .config import get_privacy_settings

    purge(db, get_privacy_settings())
