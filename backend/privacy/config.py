"""Privacy settings loaded from configs/privacy/privacy.yaml."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from backend.env import require

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = PROJECT_ROOT / "configs" / "privacy" / "privacy.yaml"


@dataclass(frozen=True)
class PrivacySettings:
    version: str
    legal_dir: Path
    documents: tuple[str, ...]
    required_on_signup: tuple[str, ...]
    controller: str
    contact_url: str
    minimum_age: int
    audit_days: int
    job_results_minutes: int
    upload_max_bytes: int
    allowed_extensions: tuple[str, ...]
    analyze_per_hour: int
    transcribe_per_hour: int
    generate_per_hour: int
    export_per_hour: int


def load_privacy_settings(path: Path | None = None) -> PrivacySettings:
    p = Path(os.environ.get("SA_PRIVACY_CONFIG", path or DEFAULT_CONFIG))
    raw: dict[str, Any] = yaml.safe_load(p.read_text(encoding="utf-8"))
    legal, ret, up, rl = raw["legal"], raw["retention"], raw["uploads"], raw["rate_limit"]
    legal_dir = Path(legal["dir"])
    return PrivacySettings(
        version=str(raw["version"]),
        legal_dir=legal_dir if legal_dir.is_absolute() else PROJECT_ROOT / legal_dir,
        documents=tuple(legal["documents"]),
        required_on_signup=tuple(legal["required_on_signup"]),
        controller=str(legal["controller"]),
        contact_url=require("PRIVACY_CONTACT_URL"),
        minimum_age=int(legal["minimum_age"]),
        audit_days=int(ret["audit_days"]),
        job_results_minutes=int(ret["job_results_minutes"]),
        upload_max_bytes=int(up["max_mb"]) * 1024 * 1024,
        allowed_extensions=tuple(e.lower() for e in up["allowed_extensions"]),
        analyze_per_hour=int(rl["analyze_per_hour"]),
        transcribe_per_hour=int(rl["transcribe_per_hour"]),
        generate_per_hour=int(rl["generate_per_hour"]),
        export_per_hour=int(rl["export_per_hour"]),
    )


@lru_cache(maxsize=1)
def get_privacy_settings() -> PrivacySettings:
    return load_privacy_settings()
