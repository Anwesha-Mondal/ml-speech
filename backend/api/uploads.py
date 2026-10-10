"""Bounded, validated reading of uploaded audio (size and type limits from configs/privacy/privacy.yaml)."""

from __future__ import annotations

from pathlib import PurePath

from fastapi import HTTPException, UploadFile, status

from backend.auth.ratelimit import limiter
from backend.privacy.config import get_privacy_settings

_CHUNK = 1024 * 1024


async def read_audio(upload: UploadFile, label: str = "Recording") -> bytes:
    """Read an uploaded audio file into memory, refusing oversized or non-audio files.
    The bytes are never written to disk by the API."""
    cfg = get_privacy_settings()
    ext = PurePath(upload.filename or "").suffix.lower()
    ctype = (upload.content_type or "").split(";")[0].strip().lower()
    if ext not in cfg.allowed_extensions and not ctype.startswith("audio/"):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"{label} must be an audio file ({', '.join(cfg.allowed_extensions)}).",
        )
    buf = bytearray()
    while chunk := await upload.read(_CHUNK):
        buf.extend(chunk)
        if len(buf) > cfg.upload_max_bytes:
            raise HTTPException(
                413,
                f"{label} is larger than {cfg.upload_max_bytes // (1024 * 1024)} MB.",
            )
    if not buf:
        raise HTTPException(422, f"{label} is empty.")
    return bytes(buf)


def per_user_limit(kind: str, user_id: str, per_hour: int) -> None:
    wait = limiter.hit(f"{kind}:{user_id}", per_hour, 3600)
    if wait > 0:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Hourly limit reached. Try again in {int(wait // 60) + 1} minute(s).",
            headers={"Retry-After": str(int(wait) + 1)},
        )
