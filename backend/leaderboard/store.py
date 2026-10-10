"""Redis storage for leaderboards.

One sorted set per (scoring version, passage): member = user ID, score = best total score.
Display names are never written to Redis. They are read from MongoDB when a board is shown,
and only for users who currently opt in, so opting out or deleting the account takes a name
off every board at once, even if Redis still holds the ID.
"""

from __future__ import annotations

from typing import Any, TypedDict

import redis

from backend.redis_client import client as shared_client
from backend.redis_client import ping as shared_ping

from .config import LeaderboardSettings, get_leaderboard_settings


class Entry(TypedDict):
    prompt_id: str
    scoring_version: str
    best_score: float
    rank: int | None


class LeaderboardUnavailable(RuntimeError):
    """Redis can't be reached."""


def client() -> redis.Redis:
    return shared_client()


def ping() -> bool:
    return shared_ping()


def board_key(prompt_id: str, cfg: LeaderboardSettings | None = None) -> str:
    cfg = cfg or get_leaderboard_settings()
    return f"{cfg.key_prefix}:{cfg.scoring_version}:{prompt_id}"


def _all_keys(cfg: LeaderboardSettings) -> list[str]:
    return [board_key(p, cfg) for p in cfg.prompts]


def submit(user_id: str, prompt_id: str, score: float) -> bool:
    """Record a score if it beats the user's best for this passage. Returns True when it did."""
    cfg = get_leaderboard_settings()
    if prompt_id not in cfg.prompts:
        return False
    try:
        # GT: only ever raise a member's score, atomically, so concurrent results can't lower it.
        # CH: the reply counts changed members, which tells us whether this was a new best.
        changed = client().zadd(board_key(prompt_id, cfg), {user_id: round(float(score), 2)}, gt=True, ch=True)
    except redis.RedisError as e:
        raise LeaderboardUnavailable(str(e)) from e
    return bool(changed)


def top(prompt_id: str | None, limit: int) -> list[tuple[str, float]]:
    """(user_id, score) best first. prompt_id=None: the global board, summing each user's best per passage."""
    cfg = get_leaderboard_settings()
    try:
        r = client()
        if prompt_id is None:
            rows: Any = r.zunion(_all_keys(cfg), aggregate="SUM", withscores=True)
            ranked = sorted(rows, key=lambda t: (-t[1], t[0]))
            return [(str(m), float(s)) for m, s in ranked[:limit]]
        rows = r.zrevrange(board_key(prompt_id, cfg), 0, limit - 1, withscores=True)
        return [(str(m), float(s)) for m, s in rows]
    except redis.RedisError as e:
        raise LeaderboardUnavailable(str(e)) from e


def user_entries(user_id: str) -> list[Entry]:
    """The user's own scores on every board (for the data export and the 'your best' line)."""
    cfg = get_leaderboard_settings()
    try:
        r = client()
        out: list[Entry] = []
        for prompt_id in cfg.prompts:
            key = board_key(prompt_id, cfg)
            s = r.zscore(key, user_id)
            if s is not None:
                rank: Any = r.zrevrank(key, user_id)  # int (list only with withscore=True)
                out.append(
                    {
                        "prompt_id": prompt_id,
                        "scoring_version": cfg.scoring_version,
                        "best_score": float(s),
                        "rank": int(rank) + 1 if rank is not None else None,
                    }
                )
        return out
    except redis.RedisError as e:
        raise LeaderboardUnavailable(str(e)) from e


def remove_user(user_id: str) -> int:
    """Delete the user's scores from every board, including boards of older scoring versions."""
    cfg = get_leaderboard_settings()
    try:
        r = client()
        removed = 0
        for key in r.scan_iter(match=f"{cfg.key_prefix}:*", count=500):
            removed += int(r.zrem(key, user_id))
        return removed
    except redis.RedisError as e:
        raise LeaderboardUnavailable(str(e)) from e
