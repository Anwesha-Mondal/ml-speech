"""Legal documents (privacy policy, terms, cookie policy) served from docs/legal/*.md.

Each file starts with a front-matter header:

    ---
    title: Privacy Policy
    version: 1.0
    effective: 2026-10-10
    ---
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from .config import PrivacySettings, get_privacy_settings


@dataclass(frozen=True)
class LegalDoc:
    slug: str
    title: str
    version: str
    effective: str
    body: str


def _parse(slug: str, text: str) -> LegalDoc:
    text = text.lstrip("﻿")
    if not text.startswith("---"):
        raise ValueError(f"docs/legal/{slug}.md is missing its front-matter header")
    _, header, body = text.split("---", 2)
    meta: dict[str, str] = {}
    for line in header.strip().splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"')
    for key in ("title", "version", "effective"):
        if not meta.get(key):
            raise ValueError(f"docs/legal/{slug}.md front matter needs '{key}'")
    return LegalDoc(slug=slug, title=meta["title"], version=meta["version"], effective=meta["effective"], body=body.strip())


def load_docs(cfg: PrivacySettings) -> dict[str, LegalDoc]:
    docs = {}
    for slug in cfg.documents:
        docs[slug] = _parse(slug, (cfg.legal_dir / f"{slug}.md").read_text(encoding="utf-8"))
    return docs


@lru_cache(maxsize=1)
def get_docs() -> dict[str, LegalDoc]:
    return load_docs(get_privacy_settings())


def current_versions() -> dict[str, str]:
    return {slug: d.version for slug, d in get_docs().items()}
