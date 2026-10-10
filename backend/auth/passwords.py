"""Password hashing (scrypt) and the password policy."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass

from .config import AuthSettings

_PREFIX = "scrypt"


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _unb64(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int, dklen: int) -> bytes:
    # maxmem must cover 128 * n * r bytes plus overhead.
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=dklen, maxmem=256 * n * r + 1024 * 1024
    )


def hash_password(password: str, cfg: AuthSettings) -> str:
    """Return a self-describing hash: scrypt$n$r$p$salt$key."""
    salt = secrets.token_bytes(cfg.salt_bytes)
    key = _scrypt(password, salt, cfg.scrypt_n, cfg.scrypt_r, cfg.scrypt_p, cfg.key_bytes)
    return f"{_PREFIX}${cfg.scrypt_n}${cfg.scrypt_r}${cfg.scrypt_p}${_b64(salt)}${_b64(key)}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time comparison against a stored hash. False for malformed hashes."""
    try:
        prefix, n, r, p, salt_b64, key_b64 = stored.split("$")
        if prefix != _PREFIX:
            return False
        expected = _unb64(key_b64)
        actual = _scrypt(password, _unb64(salt_b64), int(n), int(r), int(p), len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def needs_rehash(stored: str, cfg: AuthSettings) -> bool:
    try:
        _, n, r, p, _, key_b64 = stored.split("$")
    except ValueError:
        return True
    return (int(n), int(r), int(p), len(_unb64(key_b64))) != (
        cfg.scrypt_n,
        cfg.scrypt_r,
        cfg.scrypt_p,
        cfg.key_bytes,
    )


_dummy_cache: dict[tuple[int, int, int], str] = {}


def dummy_verify(password: str, cfg: AuthSettings) -> None:
    """Spend the same time as a real check when the account doesn't exist,
    so response timing doesn't reveal which emails are registered."""
    key = (cfg.scrypt_n, cfg.scrypt_r, cfg.scrypt_p)
    if key not in _dummy_cache:
        _dummy_cache[key] = hash_password(secrets.token_urlsafe(16), cfg)
    verify_password(password, _dummy_cache[key])


@dataclass(frozen=True)
class PolicyResult:
    ok: bool
    problems: list[str]


_SEQUENCES = ("0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm")


def _is_trivial(pw: str) -> bool:
    low = pw.lower()
    if len(set(low)) <= 2:
        return True
    for seq in _SEQUENCES:
        if low in seq or low in seq[::-1]:
            return True
    return False


def check_policy(password: str, cfg: AuthSettings, email: str = "", display_name: str = "") -> PolicyResult:
    problems: list[str] = []
    if len(password) < cfg.pw_min_length:
        problems.append(f"Use at least {cfg.pw_min_length} characters.")
    if len(password) > cfg.pw_max_length:
        problems.append(f"Use at most {cfg.pw_max_length} characters.")
    if password != password.strip():
        problems.append("Don't start or end the password with a space.")

    low = password.strip().lower()
    base = re.sub(r"[\d\W_]+$", "", low)  # "password1234!" -> "password"
    if low in cfg.blocklist or (base and base in cfg.blocklist):
        problems.append("This password is too common. Choose something less predictable.")
    elif _is_trivial(password) or _has_sequence_run(low, cfg.pw_sequence_run):
        problems.append("Avoid repeated characters and keyboard or number sequences (like 12345 or qwert).")

    if _shares_personal_text(low, email, display_name, cfg):
        problems.append("Don't use your name or email address, or part of them, in the password.")
    return PolicyResult(ok=not problems, problems=problems)


def _has_sequence_run(low: str, run: int) -> bool:
    """True if the password contains `run` consecutive characters of a sequence, either direction."""
    for seq in _SEQUENCES:
        for s in (seq, seq[::-1]):
            if any(s[i : i + run] in low for i in range(len(s) - run + 1)):
                return True
    return False


def personal_tokens(email: str, display_name: str) -> list[str]:
    """Whole email local part and display name, plus their individual words."""
    local = email.split("@")[0].lower()
    name = display_name.strip().lower()
    parts = re.split(r"[^\w]+|_", f"{local} {name}")
    return [t for t in {local, name, *parts} if t]


def _shares_personal_text(low: str, email: str, display_name: str, cfg: AuthSettings) -> bool:
    for t in personal_tokens(email, display_name):
        if len(t) < cfg.pw_min_personal_token:
            continue
        if t in low:
            return True
        w = cfg.pw_personal_window
        if len(t) >= w and any(t[i : i + w] in low for i in range(len(t) - w + 1)):
            return True
    return False
