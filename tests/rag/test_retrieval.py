"""Phase M2: corpus integrity and deterministic BM25 retrieval (megaev.md §8, §32.2)."""

from __future__ import annotations

import json
import time

import pytest

from backend.rag.retriever import get_rag_settings, get_retriever
from scripts.build_rag_corpus import build


def test_corpus_matches_megaev() -> None:
    """The committed JSON is exactly what the builder extracts from megaev.md."""
    cfg = get_rag_settings()
    built = build()
    for domain, docs in built.items():
        on_disk = json.loads((cfg.corpus_dir / f"{domain}.json").read_text(encoding="utf-8"))
        assert on_disk == json.loads(json.dumps(docs)), f"{domain}.json is stale: run scripts/build_rag_corpus.py"


def test_corpus_completeness() -> None:
    r = get_retriever()
    iv = r.in_domain("interviewer")
    industries = {d["metadata"]["industry"] for d in iv}
    assert len(industries) >= 21 and len(iv) >= 105
    assert all(d["metadata"]["question"] and d["metadata"]["keywords"] and d["metadata"]["probes"] for d in iv)
    assert len(r.in_domain("newsroom")) == 6 and len(r.in_domain("debate")) == 10 and len(r.in_domain("storytelling")) == 5
    ids = [d["document_id"] for d in r.docs]
    assert len(ids) == len(set(ids))


def test_no_rights_restricted_speeches_in_corpus() -> None:
    text = json.dumps(get_retriever().docs).lower()
    for phrase in ("i still have a dream", "stay hungry", "blood, toil, tears"):
        assert phrase not in text


def test_distributed_systems_query_finds_rate_limiter_card() -> None:
    """megaev §14.2 exit criterion: relevant card on top, well under 25 ms."""
    r = get_retriever()
    start = time.perf_counter()
    hits = r.search("interviewer", "distributed rate limiter token bucket redis", top_k=2)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert hits[0][0]["document_id"] == "int_software_engineering_01"
    assert elapsed_ms < 25


def test_metadata_filter_and_exclusion() -> None:
    r = get_retriever()
    hits = r.search("interviewer", "patient diagnosis", {"industry": "healthcare_medicine"}, top_k=10)
    assert hits and all(d["metadata"]["industry"] == "healthcare_medicine" for d, _ in hits)
    first = hits[0][0]["document_id"]
    again = r.search("interviewer", "patient diagnosis", {"industry": "healthcare_medicine"}, top_k=10, exclude_ids={first})
    assert first not in {d["document_id"] for d, _ in again}


def test_search_is_deterministic_and_drops_irrelevant() -> None:
    r = get_retriever()
    runs = [[(d["document_id"], s) for d, s in r.search("newsroom", "hurricane storm surge evacuation")] for _ in range(5)]
    assert all(x == runs[0] for x in runs) and runs[0][0][0].startswith("wire_weather")
    assert r.search("debate", "zzzz qqqq") == []


@pytest.mark.parametrize("domain", ["interviewer", "newsroom", "debate", "storytelling"])
def test_every_domain_is_searchable(domain: str) -> None:
    assert get_retriever().in_domain(domain)
