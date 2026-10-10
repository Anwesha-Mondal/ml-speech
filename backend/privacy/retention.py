"""Data retention: delete what we no longer need (old audit events).

MongoDB's TTL index on audit events (see backend/auth/db.py) does this on its own about once
a minute. `purge` applies the same rule explicitly so retention also holds where the TTL
monitor is off, and so tests can check the rule directly. Sign-in sessions live in Redis and
expire there, so there is nothing to purge for them.
"""

from __future__ import annotations

import time
from datetime import timedelta
from typing import Any

from pymongo.database import Database

from backend.auth.db import AUDIT, utcnow

from .config import PrivacySettings

Db = Database[dict[str, Any]]


def purge(db: Db, cfg: PrivacySettings) -> dict[str, int]:
    audit = db[AUDIT].delete_many({"at": {"$lt": utcnow() - timedelta(days=cfg.audit_days)}})
    return {"audit_events": int(audit.deleted_count)}


_last_run = 0.0


def maybe_purge(db: Db, every_s: float = 3600) -> None:
    """Run `purge` at most once per `every_s` seconds (called on sign-in and at start-up)."""
    global _last_run
    if time.monotonic() - _last_run < every_s and _last_run:
        return
    _last_run = time.monotonic()
    from .config import get_privacy_settings

    purge(db, get_privacy_settings())
