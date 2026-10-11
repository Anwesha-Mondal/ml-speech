"""One-off copy of accounts from the old SQLite database (Sessions 30-32) into MongoDB.

    python -m backend.auth.migrate_sqlite data/speech_arena.db

Copies users, consent records and audit events. Sessions are not copied: everyone signs in
again once. Safe to run twice: accounts whose email already exists in MongoDB are skipped,
along with their consent records, and audit events already copied are not copied again.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pymongo.errors import DuplicateKeyError

from .db import AUDIT, CONSENTS, USERS, init_db


def _dt(v: Any) -> datetime | None:
    if v in (None, ""):
        return None
    d = datetime.fromisoformat(str(v))
    d = d if d.tzinfo else d.replace(tzinfo=UTC)  # SQLite dropped the zone; values were UTC
    return d.replace(microsecond=(d.microsecond // 1000) * 1000)


def migrate(path: Path) -> dict[str, int]:
    src = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    db = init_db()
    copied: set[str] = set()
    counts = {"users": 0, "skipped_users": 0, "consent_records": 0, "audit_events": 0}

    for r in src.execute("SELECT * FROM users"):
        doc = {
            "_id": r["id"],
            "email": r["email"],
            "display_name": r["display_name"],
            "password_hash": r["password_hash"],
            "role": r["role"],
            "is_active": bool(r["is_active"]),
            "failed_attempts": int(r["failed_attempts"] or 0),
            "locked_until": _dt(r["locked_until"]),
            "password_changed_at": _dt(r["password_changed_at"]),
            "created_at": _dt(r["created_at"]),
            "last_login_at": _dt(r["last_login_at"]),
            "leaderboard_opt_in": False,  # new setting: off until the user chooses
        }
        try:
            db[USERS].insert_one(doc)
        except DuplicateKeyError:
            counts["skipped_users"] += 1
            continue
        copied.add(r["id"])
        counts["users"] += 1

    for r in src.execute("SELECT * FROM consent_records ORDER BY id"):
        if r["user_id"] in copied:
            db[CONSENTS].insert_one(
                {"user_id": r["user_id"], "document": r["document"], "version": r["version"], "choice": r["choice"], "at": _dt(r["at"])}
            )
            counts["consent_records"] += 1

    for r in src.execute("SELECT * FROM audit_events ORDER BY id"):
        # Keyed on the old row ID, so a second run doesn't duplicate events.
        res = db[AUDIT].update_one(
            {"sqlite_id": int(r["id"])},
            {
                "$setOnInsert": {
                    "at": _dt(r["at"]),
                    "event": r["event"],
                    "user_id": r["user_id"],
                    "actor_id": r["actor_id"],
                    "email": r["email"] or "",
                    "ip": r["ip"] or "",
                    "detail": r["detail"] or "",
                }
            },
            upsert=True,
        )
        counts["audit_events"] += 1 if res.upserted_id is not None else 0
    src.close()
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m backend.auth.migrate_sqlite")
    parser.add_argument("sqlite_path", type=Path)
    args = parser.parse_args(argv)
    if not args.sqlite_path.is_file():
        print(f"No such file: {args.sqlite_path}", file=sys.stderr)
        return 1
    print(migrate(args.sqlite_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
