"""Consent bookkeeping: what each user accepted, and whether it is still current."""

from __future__ import annotations

from typing import Any

from pymongo import ASCENDING
from pymongo.database import Database

from backend.auth.db import CONSENTS, utcnow

from .config import get_privacy_settings
from .legal import current_versions

Db = Database[dict[str, Any]]


def record(db: Db, user_id: str, document: str, version: str, choice: str = "accepted") -> None:
    db[CONSENTS].insert_one(
        {"user_id": user_id, "document": document, "version": version, "choice": choice[:128], "at": utcnow()}
    )


def record_signup_acceptance(db: Db, user_id: str) -> None:
    versions = current_versions()
    for doc in get_privacy_settings().required_on_signup:
        record(db, user_id, doc, versions[doc])


def history(db: Db, user_id: str) -> list[dict[str, Any]]:
    """Every consent record for the user, oldest first (ObjectIds sort by insertion time)."""
    return list(db[CONSENTS].find({"user_id": user_id}).sort("_id", ASCENDING))


def latest(db: Db, user_id: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in history(db, user_id):
        out[r["document"]] = r  # later records win
    return out


def outstanding(db: Db, user_id: str) -> list[str]:
    """Required documents the user hasn't accepted in their current version."""
    versions = current_versions()
    have = latest(db, user_id)
    return [
        doc
        for doc in get_privacy_settings().required_on_signup
        if doc not in have or have[doc]["version"] != versions[doc] or have[doc]["choice"] != "accepted"
    ]
