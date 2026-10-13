"""Deterministic BM25 retrieval over the versioned RAG corpus (megaev.md §8, Phase M2).

The corpus is JSON under backend/rag/corpus/ (built from megaev.md). Each document has
document_id, domain, title, content and metadata. Search is lexical BM25 with metadata
filters; the same query always returns the same ranking (ties broken by document_id).
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = PROJECT_ROOT / "configs" / "rag" / "rag.yaml"
TOKEN = re.compile(r"[a-z0-9]+")

Document = dict[str, Any]


@dataclass(frozen=True)
class RagSettings:
    version: str
    corpus_dir: Path
    domains: tuple[str, ...]
    k1: float
    b: float
    title_weight: int
    default_top_k: int
    max_top_k: int
    max_chars: int
    stopwords: frozenset[str]


def load_rag_settings(path: Path = DEFAULT_CONFIG) -> RagSettings:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    corpus = Path(raw["corpus_dir"])
    return RagSettings(
        version=str(raw["version"]),
        corpus_dir=corpus if corpus.is_absolute() else PROJECT_ROOT / corpus,
        domains=tuple(raw["domains"]),
        k1=float(raw["bm25"]["k1"]),
        b=float(raw["bm25"]["b"]),
        title_weight=int(raw["bm25"]["title_weight"]),
        default_top_k=int(raw["query"]["default_top_k"]),
        max_top_k=int(raw["query"]["max_top_k"]),
        max_chars=int(raw["query"]["max_chars"]),
        stopwords=frozenset(raw["stopwords"]),
    )


@lru_cache(maxsize=1)
def get_rag_settings() -> RagSettings:
    return load_rag_settings()


def tokenize(text: str, stopwords: frozenset[str]) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in stopwords]


def _matches(doc: Document, filters: dict[str, Any]) -> bool:
    meta = doc.get("metadata", {})
    for key, want in filters.items():
        have = meta.get(key, doc.get(key))
        if isinstance(have, list):
            if want not in have:
                return False
        elif have != want:
            return False
    return True


class Retriever:
    def __init__(self, cfg: RagSettings) -> None:
        self.cfg = cfg
        self.docs: list[Document] = []
        for domain in cfg.domains:
            path = cfg.corpus_dir / f"{domain}.json"
            if path.exists():
                self.docs.extend(json.loads(path.read_text(encoding="utf-8")))
        self.by_id = {d["document_id"]: d for d in self.docs}
        self._tf: list[Counter[str]] = []
        self._len: list[int] = []
        df: Counter[str] = Counter()
        for d in self.docs:
            toks = tokenize(d["content"], cfg.stopwords) + tokenize(d["title"], cfg.stopwords) * cfg.title_weight
            tf = Counter(toks)
            self._tf.append(tf)
            self._len.append(len(toks))
            df.update(tf.keys())
        n = len(self.docs)
        self._avg = (sum(self._len) / n) if n else 1.0
        self._idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def get(self, document_id: str) -> Document | None:
        return self.by_id.get(document_id)

    def in_domain(self, domain: str, filters: dict[str, Any] | None = None) -> list[Document]:
        return [d for d in self.docs if d["domain"] == domain and _matches(d, filters or {})]

    def search(
        self,
        domain: str,
        query: str,
        filters: dict[str, Any] | None = None,
        top_k: int | None = None,
        exclude_ids: set[str] | None = None,
    ) -> list[tuple[Document, float]]:
        cfg = self.cfg
        k = max(1, min(top_k or cfg.default_top_k, cfg.max_top_k))
        q = tokenize(query[: cfg.max_chars], cfg.stopwords)
        scored: list[tuple[float, str, Document]] = []
        for i, d in enumerate(self.docs):
            if d["domain"] != domain or (exclude_ids and d["document_id"] in exclude_ids) or not _matches(d, filters or {}):
                continue
            tf, dl, s = self._tf[i], self._len[i], 0.0
            for t in q:
                f = tf.get(t, 0)
                if f:
                    s += self._idf[t] * f * (cfg.k1 + 1) / (f + cfg.k1 * (1 - cfg.b + cfg.b * dl / self._avg))
            if s > 0.0:  # no shared terms means not relevant
                scored.append((s, d["document_id"], d))
        scored.sort(key=lambda x: (-x[0], x[1]))
        return [(d, round(s, 4)) for s, _, d in scored[:k]]


@lru_cache(maxsize=1)
def get_retriever() -> Retriever:
    return Retriever(get_rag_settings())
