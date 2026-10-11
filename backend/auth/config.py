"""Auth settings: policy thresholds from configs/auth/auth.yaml (versioned, per AGENTS.md);
deployment values (MongoDB, Redis, origins, cookie security) from .env via backend.env."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from backend.env import csv, flag, require

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = PROJECT_ROOT / "configs" / "auth" / "auth.yaml"


@dataclass(frozen=True)
class AuthSettings:
    version: str
    mongodb_uri: str
    mongodb_db: str
    pw_min_length: int
    pw_max_length: int
    pw_min_personal_token: int
    pw_personal_window: int
    pw_sequence_run: int
    blocklist: frozenset[str]
    scrypt_n: int
    scrypt_r: int
    scrypt_p: int
    salt_bytes: int
    key_bytes: int
    session_prefix: str
    cookie_name: str
    cookie_secure: bool
    same_site: str
    token_bytes: int
    absolute_lifetime_hours: int
    idle_timeout_hours: int
    touch_interval_seconds: int
    max_failed_attempts: int
    lock_minutes: int
    login_per_minute: int
    register_per_hour: int
    registration_open: bool
    allowed_origins: tuple[str, ...] = field(default_factory=tuple)


def _load_blocklist(path: Path) -> frozenset[str]:
    if not path.exists():
        return frozenset()
    words = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip().lower()
        if line and not line.startswith("#"):
            words.append(line)
    return frozenset(words)


def load_settings(config_path: Path | None = None) -> AuthSettings:
    path = Path(os.environ.get("SA_AUTH_CONFIG", config_path or DEFAULT_CONFIG))
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))

    pw, h, s = raw["password"], raw["hashing"], raw["session"]

    return AuthSettings(
        version=str(raw["version"]),
        mongodb_uri=require("MONGODB_URI"),
        mongodb_db=require("MONGODB_DB"),
        pw_min_length=int(pw["min_length"]),
        pw_max_length=int(pw["max_length"]),
        pw_min_personal_token=int(pw["min_personal_token"]),
        pw_personal_window=int(pw.get("personal_window", 5)),
        pw_sequence_run=int(pw.get("sequence_run", 5)),
        blocklist=_load_blocklist(PROJECT_ROOT / pw["blocklist_file"]),
        scrypt_n=int(h["n"]),
        scrypt_r=int(h["r"]),
        scrypt_p=int(h["p"]),
        salt_bytes=int(h["salt_bytes"]),
        key_bytes=int(h["key_bytes"]),
        session_prefix=str(s["redis_prefix"]),
        cookie_name=str(s["cookie_name"]),
        cookie_secure=flag("COOKIE_SECURE"),
        same_site=str(s["same_site"]),
        token_bytes=int(s["token_bytes"]),
        absolute_lifetime_hours=int(s["absolute_lifetime_hours"]),
        idle_timeout_hours=int(s["idle_timeout_hours"]),
        touch_interval_seconds=int(s["touch_interval_seconds"]),
        max_failed_attempts=int(raw["lockout"]["max_failed_attempts"]),
        lock_minutes=int(raw["lockout"]["lock_minutes"]),
        login_per_minute=int(raw["rate_limit"]["login_per_minute"]),
        register_per_hour=int(raw["rate_limit"]["register_per_hour"]),
        registration_open=bool(raw["registration"]["open"]),
        allowed_origins=csv("CORS_ORIGINS"),
    )


@lru_cache(maxsize=1)
def get_settings() -> AuthSettings:
    return load_settings()
