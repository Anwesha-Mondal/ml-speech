"""Leaderboard settings from configs/leaderboard/leaderboard.yaml (the Redis address is REDIS_URL in .env)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = PROJECT_ROOT / "configs" / "leaderboard" / "leaderboard.yaml"


@dataclass(frozen=True)
class LeaderboardSettings:
    version: str
    scoring_version: str
    prompts: dict[str, str]
    top_n: int
    key_prefix: str
    fetch_factor: int


def load_leaderboard_settings(path: Path | None = None) -> LeaderboardSettings:
    p = Path(os.environ.get("SA_LEADERBOARD_CONFIG", path or DEFAULT_CONFIG))
    raw: dict[str, Any] = yaml.safe_load(p.read_text(encoding="utf-8"))
    return LeaderboardSettings(
        version=str(raw["version"]),
        scoring_version=str(raw["scoring_version"]),
        prompts={str(k): str(v) for k, v in raw["prompts"].items()},
        top_n=int(raw["top_n"]),
        key_prefix=str(raw["key_prefix"]),
        fetch_factor=int(raw["fetch_factor"]),
    )


@lru_cache(maxsize=1)
def get_leaderboard_settings() -> LeaderboardSettings:
    return load_leaderboard_settings()
