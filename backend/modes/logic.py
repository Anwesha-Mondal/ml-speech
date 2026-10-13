"""Pure, deterministic logic behind the interactive practice modes (megaev.md §4-§7).

Pillar A only: question selection, STAR structure checks and narrative-arc measurements.
Nothing here changes a speech score; scores come from the acoustic pipeline (Pillar B).
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import yaml

from backend.rag.retriever import Document, Retriever

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = PROJECT_ROOT / "configs" / "modes" / "modes.yaml"
STAR_PARTS = ("situation", "task", "action", "result")


def load_modes_config(path: Path = DEFAULT_CONFIG) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


@lru_cache(maxsize=1)
def get_modes_config() -> dict[str, Any]:
    return load_modes_config()


def _norm(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9%' ]+", " ", text.lower()) + " "


# ---------- interview ----------
def star_coverage(transcript: str, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Which STAR parts have cue phrases in the answer, and which phrases matched."""
    icfg = (cfg or get_modes_config())["interview"]
    text = _norm(transcript)
    parts: dict[str, Any] = {}
    for part in STAR_PARTS:
        hits = [c for c in icfg["star_cues"][part] if f" {c} " in text or (c == "%" and "%" in text)]
        if part == "result" and icfg.get("numbers_count_as_result") and re.search(r"\d", transcript):
            hits.append("a number")
        parts[part] = {"present": bool(hits), "cues": hits[:3]}
    return {"parts": parts, "covered": sum(1 for p in parts.values() if p["present"]), "of": len(STAR_PARTS)}


def keyword_hits(transcript: str, keywords: Sequence[str]) -> tuple[list[str], list[str]]:
    text = _norm(transcript)
    hit = [k for k in keywords if _norm(k).strip() and f" {_norm(k).strip()} " in text]
    return hit, [k for k in keywords if k not in hit]


def answer_length_note(duration_sec: float | None, cfg: dict[str, Any] | None = None) -> str | None:
    if duration_sec is None:
        return None
    b = (cfg or get_modes_config())["interview"]["answer_bounds_sec"]
    if duration_sec < b["min"]:
        return f"The answer lasted {duration_sec:.0f} s, under the {b['min']} s guide for a developed answer."
    if duration_sec > b["max"]:
        return f"The answer lasted {duration_sec:.0f} s, over the {b['max']} s guide."
    return None


def question_payload(doc: Document, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    icfg = (cfg or get_modes_config())["interview"]
    m = doc["metadata"]
    return {
        "question_id": doc["document_id"],
        "kind": "question",
        "question": m["question"],
        "question_type": m["question_type"],
        "rubric_hints": m["keywords"][: icfg["hint_keywords"]],
        "star_criteria": m["star_criteria"],
    }


def first_question(retriever: Retriever, industry: str, interview_type: str = "") -> Document | None:
    bank = retriever.in_domain("interviewer", {"industry": industry})
    if not bank:
        return None
    if interview_type:
        want = interview_type.lower()
        for d in bank:
            if want in d["metadata"]["question_type"].lower():
                return d
    return bank[0]


def next_turn(
    retriever: Retriever, industry: str, last_question_id: str, transcript: str, asked_ids: Sequence[str]
) -> dict[str, Any] | None:
    """Follow-up for the next turn: a probe triggered by something the candidate said, else the
    most related unasked question from the same industry, else the next one in order."""
    asked = set(asked_ids) | {last_question_id}
    base_id = last_question_id.split("#", 1)[0]
    last = retriever.get(base_id)
    text = _norm(transcript)
    if last is not None:
        for i, probe in enumerate(last["metadata"]["probes"]):
            pid = f"{base_id}#p{i + 1}"
            trig = _norm(probe["trigger"]).strip()
            if pid not in asked and trig and f" {trig} " in text:
                return {
                    "question_id": pid,
                    "kind": "probe",
                    "question": probe["question"],
                    "question_type": "Follow-up",
                    "trigger": probe["trigger"],
                    "rubric_hints": [],
                    "star_criteria": "",
                }
    asked_bases = {a.split("#", 1)[0] for a in asked}
    hits = retriever.search("interviewer", transcript or industry, {"industry": industry}, top_k=1, exclude_ids=asked_bases)
    if hits:
        return question_payload(hits[0][0])
    rest = [d for d in retriever.in_domain("interviewer", {"industry": industry}) if d["document_id"] not in asked_bases]
    return question_payload(rest[0]) if rest else None


# ---------- debate ----------
def spar(motion: Document, user_stance: str) -> dict[str, Any]:
    """The opposing case from the corpus, plus a cross-examination question and a POI."""
    m = motion["metadata"]
    opponent = "negative" if user_stance == "affirmative" else "affirmative"
    return {
        "motion_id": motion["document_id"],
        "motion": m["motion"],
        "user_stance": user_stance,
        "opponent_stance": opponent,
        "rebuttal_text": m[opponent],
        "cross_examination": m["cross_examination_trap"],
        "point_of_information": m["point_of_information"],
    }


# ---------- storytelling ----------
def arc_evaluation(contours: dict[str, Any], duration: float, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """Mean energy (dB) per Freytag phase and whether the recording follows the arc shape."""
    scfg = (cfg or get_modes_config())["storytelling"]
    t = np.array([float(x) for x in contours.get("t") or []])
    e = np.array([float(x) if x is not None else np.nan for x in contours.get("energyPart") or []])
    phases = []
    means: dict[str, float | None] = {}
    for ph in scfg["arc_phases"]:
        a, b = ph["span"][0] * duration, ph["span"][1] * duration
        mask = (t >= a) & (t < b) & ~np.isnan(e) if len(t) == len(e) else np.zeros(0, dtype=bool)
        mean = float(np.mean(e[mask])) if mask.any() else None
        means[ph["id"]] = mean
        phases.append({"id": ph["id"], "label": ph["label"], "start_sec": round(a, 2), "end_sec": round(b, 2),
                       "mean_energy_db": None if mean is None else round(mean, 1)})
    ex, cl, res = means.get("exposition"), means.get("climax"), means.get("resolution")
    loudest = max((v for v in means.values() if v is not None), default=None)
    checks = {
        "climax_is_loudest_phase": cl is not None and loudest is not None and cl >= loudest,
        "climax_above_exposition": cl is not None and ex is not None and cl - ex >= scfg["climax_over_exposition_db"],
        "resolution_below_climax": cl is not None and res is not None and cl - res >= scfg["resolution_below_climax_db"],
    }
    return {"phases": phases, "checks": checks, "arc_match": sum(checks.values()), "of": len(checks)}
