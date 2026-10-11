"""Deployment settings come from the environment, loaded from the project's .env file.

.env is gitignored; .env.example lists every key with placeholder values. Nothing that
identifies a server (database, Redis, origins) is hardcoded in the code: if a required key
is missing the API refuses to start and says which one.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
_loaded = False


class MissingSetting(RuntimeError):
    pass


def load_env() -> None:
    """Load PROJECT_ROOT/.env once. Real environment variables take precedence."""
    global _loaded
    if not _loaded:
        load_dotenv(PROJECT_ROOT / ".env", override=False)
        _loaded = True


def require(name: str) -> str:
    load_env()
    value = os.environ.get(name, "").strip()
    if not value:
        raise MissingSetting(
            f"{name} is not set. Copy .env.example to .env in the project root and fill it in."
        )
    return value


def optional(name: str, default: str = "") -> str:
    load_env()
    return os.environ.get(name, default).strip()


def flag(name: str) -> bool:
    return optional(name, "0").lower() in {"1", "true", "yes", "on"}


def csv(name: str) -> tuple[str, ...]:
    return tuple(v.strip() for v in require(name).split(",") if v.strip())
