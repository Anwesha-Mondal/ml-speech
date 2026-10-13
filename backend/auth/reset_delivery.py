"""How a password-reset link reaches its owner.

The link is never returned by the API: whoever asks for a reset must not receive the token,
or anyone who knows an email address could take over that account.

PASSWORD_RESET_DELIVERY in .env picks the channel:
  none (default)  no link is sent. Use `python -m backend.auth.cli reset-link --email ...`
                  to give a locked-out user a link by hand.
  log             local development only: the link is written to the API console.
Real email delivery belongs here once the project has a mail service.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta
from typing import Any
from urllib.parse import quote

from pymongo.database import Database

from backend.env import optional, require

from .config import AuthSettings
from .db import PASSWORD_RESETS, utcnow

log = logging.getLogger("speech_arena.password_reset")

Db = Database[dict[str, Any]]
CHANNELS = ("none", "log")


def channel() -> str:
    c = optional("PASSWORD_RESET_DELIVERY", "none").lower()
    if c not in CHANNELS:
        raise ValueError(f"PASSWORD_RESET_DELIVERY must be one of {', '.join(CHANNELS)}, not {c!r}.")
    return c


def issue_reset_link(db: Db, email: str, cfg: AuthSettings) -> str:
    """Create a single-use token (only its SHA-256 is stored) and return the reset link.

    Any earlier unused token for the same email stops working.
    """
    raw = secrets.token_urlsafe(cfg.reset_token_bytes)
    now = utcnow()
    db[PASSWORD_RESETS].delete_many({"email": email})
    db[PASSWORD_RESETS].insert_one(
        {
            "token_hash": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
            "email": email,
            "created_at": now,
            "expires_at": now + timedelta(minutes=cfg.reset_lifetime_minutes),
            "used": False,
        }
    )
    # APP_URL (.env) is the address of the web app, e.g. the Vite dev server.
    return f"{optional('APP_URL', 'https://speech-guru-six.vercel.app').rstrip('/')}/reset-password?token={quote(raw)}"


def send_reset_link(email: str, link: str) -> None:
    """Deliver the link through the configured channel. Never put the link in an API response."""
    if channel() == "log":
        log.warning("Password reset link for %s (local development only): %s", email, link)
