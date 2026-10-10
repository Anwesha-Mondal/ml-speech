"""The one Redis connection the API uses (sign-in sessions and leaderboards).

The address comes from REDIS_URL in .env. Tests swap in fakeredis with `use_client`.
"""

from __future__ import annotations

import redis

from backend.env import require

_client: redis.Redis | None = None


def use_client(client: redis.Redis | None) -> None:
    """Point the API at a specific client (tests pass fakeredis); None reconnects from .env."""
    global _client
    _client = client


def client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            require("REDIS_URL"), decode_responses=True, socket_timeout=2, socket_connect_timeout=2
        )
    return _client


def ping() -> bool:
    try:
        return bool(client().ping())
    except redis.RedisError:
        return False
