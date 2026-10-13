"""MongoDB storage for leaderboards.

One score document per (user_id, scoring_version, prompt_id): score = best total score.
Display names are never written to the score documents. They are read from the users
collection when a board is shown, and only for users who currently opt in, so opting out
or deleting the account takes a name off every board at once.
"""

from __future__ import annotations

from typing import Any, TypedDict

from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from backend.auth.db import LEADERBOARD, get_db, utcnow
from backend.auth.db import ping as mongo_ping

from .config import get_leaderboard_settings


class Entry(TypedDict):
    prompt_id: str
    scoring_version: str
    best_score: float
    rank: int | None


class LeaderboardUnavailable(RuntimeError):
    """Database can't be reached."""


def ping() -> bool:
    return mongo_ping()


def submit(user_id: str, prompt_id: str, score: float) -> bool:
    """Record a score if it beats the user's best for this passage. Returns True when it did.

    One atomic upsert with $max: concurrent results can never lower a stored best.
    """
    cfg = get_leaderboard_settings()
    if prompt_id not in cfg.prompts:
        return False
    score_val = round(float(score), 2)
    doc_id = f"{user_id}:{cfg.scoring_version}:{prompt_id}"
    update = {
        "$max": {"best_score": score_val},
        "$setOnInsert": {"user_id": user_id, "scoring_version": cfg.scoring_version, "prompt_id": prompt_id},
    }
    try:
        col = get_db()[LEADERBOARD]
        try:
            before = col.find_one_and_update({"_id": doc_id}, update, upsert=True, return_document=ReturnDocument.BEFORE)
        except DuplicateKeyError:
            # Two first results raced to insert; the document exists now, so update it.
            before = col.find_one_and_update({"_id": doc_id}, update, return_document=ReturnDocument.BEFORE)
        new_best = before is None or score_val > float(before.get("best_score", 0.0))
        if new_best:
            col.update_one({"_id": doc_id}, {"$set": {"updated_at": utcnow()}})
        return new_best
    except PyMongoError as e:
        raise LeaderboardUnavailable(str(e)) from e


def top(prompt_id: str | None, limit: int) -> list[tuple[str, float]]:
    """(user_id, score) best first. prompt_id=None: the global board, summing each user's best per passage."""
    cfg = get_leaderboard_settings()
    try:
        col = get_db()[LEADERBOARD]
        if prompt_id is None:
            pipeline: list[dict[str, Any]] = [
                {"$match": {"scoring_version": cfg.scoring_version, "prompt_id": {"$in": list(cfg.prompts.keys())}}},
                {"$group": {"_id": "$user_id", "total_score": {"$sum": "$best_score"}}},
                {"$sort": {"total_score": -1, "_id": 1}},
                {"$limit": limit},
            ]
            rows = list(col.aggregate(pipeline))
            ranked = [(str(r["_id"]), round(float(r["total_score"]), 2)) for r in rows]
            return ranked
        cursor = col.find(
            {"scoring_version": cfg.scoring_version, "prompt_id": prompt_id}
        ).sort([("best_score", DESCENDING), ("user_id", ASCENDING)]).limit(limit)
        return [(str(doc["user_id"]), float(doc["best_score"])) for doc in cursor]
    except PyMongoError as e:
        raise LeaderboardUnavailable(str(e)) from e


def user_entries(user_id: str) -> list[Entry]:
    """The user's own scores on every board (for the data export and the 'your best' line)."""
    cfg = get_leaderboard_settings()
    try:
        col = get_db()[LEADERBOARD]
        out: list[Entry] = []
        for prompt_id in cfg.prompts:
            doc_id = f"{user_id}:{cfg.scoring_version}:{prompt_id}"
            d = col.find_one({"_id": doc_id})
            if d is not None:
                best_score = float(d["best_score"])
                higher = col.count_documents(
                    {
                        "scoring_version": cfg.scoring_version,
                        "prompt_id": prompt_id,
                        "best_score": {"$gt": best_score},
                    }
                )
                out.append(
                    {
                        "prompt_id": prompt_id,
                        "scoring_version": cfg.scoring_version,
                        "best_score": best_score,
                        "rank": higher + 1,
                    }
                )
        return out
    except PyMongoError as e:
        raise LeaderboardUnavailable(str(e)) from e


def remove_user(user_id: str) -> int:
    """Delete the user's scores from every board, including boards of older scoring versions."""
    try:
        col = get_db()[LEADERBOARD]
        res = col.delete_many({"user_id": user_id})
        return int(res.deleted_count)
    except PyMongoError as e:
        raise LeaderboardUnavailable(str(e)) from e
