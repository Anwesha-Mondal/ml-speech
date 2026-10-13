"""Multi-mode scoring (megaev.md §10, Phase M1-Ext).

Pure, deterministic functions: the same flaws, words and contours with the same config always
give the same score. Every number comes from configs/scoring/modes_v2.0.yaml.

Pipeline (see `score_analysis`):
  rule-based detectors (up-talk, filled pauses) → mode multipliers → bucket caps → bonus rules.
"""

from __future__ import annotations

import hashlib
import json
import operator
import re
from collections.abc import Callable, Sequence
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG = PROJECT_ROOT / "configs" / "scoring" / "modes_v2.0.yaml"
BUCKETS = ("pacing", "pitch", "pauses", "energy_clarity")

Flaw = dict[str, Any]
Word = dict[str, Any]

_OPS: dict[str, Callable[[Any, Any], bool]] = {
    "<": operator.lt,
    "<=": operator.le,
    ">": operator.gt,
    ">=": operator.ge,
    "==": operator.eq,
}


# ---------- config ----------
def load_mode_config(path: Path | None = None) -> dict[str, Any]:
    raw: dict[str, Any] = yaml.safe_load((path or DEFAULT_CONFIG).read_text(encoding="utf-8"))
    canonical = json.dumps(raw, sort_keys=True, separators=(",", ":"))
    raw["config_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]
    return raw


@lru_cache(maxsize=1)
def get_mode_config() -> dict[str, Any]:
    return load_mode_config()


def known_modes(cfg: dict[str, Any] | None = None) -> tuple[str, ...]:
    return tuple((cfg or get_mode_config())["modes"])


def _mode(cfg: dict[str, Any], mode: str) -> dict[str, Any]:
    modes: dict[str, Any] = cfg["modes"]
    return modes.get(mode, modes["sandbox"])  # type: ignore[no-any-return]


# ---------- helpers ----------
def flaw_id(flaw_type: str, start: float, end: float, word: str = "") -> str:
    """Stable ID: the same flaw at the same place always gets the same ID (no randomness)."""
    key = f"{flaw_type}|{start:.2f}|{end:.2f}|{word}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:8]


def with_stable_ids(flaws: Sequence[Flaw]) -> list[Flaw]:
    out = []
    for f in flaws:
        g = dict(f)
        g["flaw_id"] = flaw_id(str(g.get("type", "")), float(g.get("start_time", 0.0)), float(g.get("end_time", 0.0)), str(g.get("word", "")))
        out.append(g)
    return out


def _clean_token(text: str) -> str:
    return re.sub(r"[^a-z']", "", text.lower())


def _voiced_semitones(contours: dict[str, Any], cfg: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
    """(times, semitones relative to the speaker's own median F0) for voiced points (ADR-001)."""
    det = cfg["detectors"]
    t = contours.get("t") or []
    p = contours.get("pitchPart") or []
    pairs = [
        (float(ti), float(pi))
        for ti, pi in zip(t, p, strict=False)
        if pi is not None and det["pitch_floor_hz"] <= float(pi) <= det["pitch_ceiling_hz"]
    ]
    if not pairs:
        return np.zeros(0), np.zeros(0)
    times = np.array([a for a, _ in pairs])
    hz = np.array([b for _, b in pairs])
    return times, 12.0 * np.log2(hz / float(np.median(hz)))


# ---------- rule-based detectors ----------
def detect_uptalk(words: Sequence[Word], contours: dict[str, Any], cfg: dict[str, Any] | None = None) -> list[Flaw]:
    """Rising pitch at the end of a phrase (before a pause or at the end of the take)."""
    cfg = cfg or get_mode_config()
    det = cfg["detectors"]["uptalk"]
    times, st = _voiced_semitones(contours, cfg)
    if len(times) == 0 or not words:
        return []
    defn = cfg["flaw_definitions"]["PITCH_UPTALK"]
    flaws: list[Flaw] = []
    for i, w in enumerate(words):
        end = float(w["end"])
        nxt = float(words[i + 1]["start"]) if i + 1 < len(words) else None
        if nxt is not None and nxt - end < det["phrase_end_pause_sec"]:
            continue  # not a phrase end
        start = max(float(w["start"]), end - det["window_sec"])
        mask = (times >= start) & (times <= end)
        if int(mask.sum()) < det["min_voiced_points"]:
            continue
        slope = float(np.polyfit(times[mask], st[mask], 1)[0])
        if slope <= det["min_slope_st_per_sec"]:
            continue
        word = str(w.get("text", ""))
        flaws.append(
            {
                "type": "PITCH_UPTALK",
                "bucket": defn["bucket"],
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "penalty": defn["base_penalty"],
                "confidence": det["confidence"],
                "word": word,
                "explanation": (
                    f"Pitch rose by {slope:.1f} semitones per second over the last {end - start:.2f}s "
                    f"before the pause after '{word}' (rising terminal; limit {det['min_slope_st_per_sec']} st/s)."
                ),
                "evidence": {
                    "metric": "terminal_slope_st_per_sec",
                    "reference_value": det["min_slope_st_per_sec"],
                    "participant_value": round(slope, 2),
                    "delta_abs": round(slope - det["min_slope_st_per_sec"], 2),
                    "delta_rel": round(slope / det["min_slope_st_per_sec"], 2),
                },
            }
        )
    return flaws


def detect_fillers(words: Sequence[Word], cfg: dict[str, Any] | None = None) -> list[Flaw]:
    """Filled pauses ('um', 'uh', ...) found in the word timings."""
    cfg = cfg or get_mode_config()
    det = cfg["detectors"]["fillers"]
    tokens = set(det["tokens"])
    defn = cfg["flaw_definitions"]["FILLER_HEAVY"]
    flaws: list[Flaw] = []
    for w in words:
        tok = _clean_token(str(w.get("text", "")))
        if tok not in tokens:
            continue
        start, end = float(w["start"]), float(w["end"])
        flaws.append(
            {
                "type": "FILLER_HEAVY",
                "bucket": defn["bucket"],
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "penalty": defn["base_penalty"],
                "confidence": det["confidence"],
                "word": tok,
                "explanation": f"Filled pause '{tok}' lasting {end - start:.2f}s.",
                "evidence": {
                    "metric": "filled_pause_sec",
                    "reference_value": 0.0,
                    "participant_value": round(end - start, 2),
                    "delta_abs": round(end - start, 2),
                    "delta_rel": 1.0,
                },
            }
        )
    return flaws


# ---------- delivery metrics ----------
def compute_metrics(
    words: Sequence[Word], contours: dict[str, Any], flaws: Sequence[Flaw], duration: float, cfg: dict[str, Any] | None = None
) -> dict[str, Any]:
    cfg = cfg or get_mode_config()
    m = cfg["metrics"]
    filler_tokens = set(cfg["detectors"]["fillers"]["tokens"])
    spoken = [w for w in words if _clean_token(str(w.get("text", ""))) not in filler_tokens]
    word_count = len(spoken)
    wpm = word_count / duration * 60.0 if duration > 0 else 0.0

    # Local speaking rate per window → standard deviation (cadence steadiness).
    win = float(m["wpm_window_sec"])
    local: list[float] = []
    if duration >= win and spoken:
        n = int(duration // win)
        for k in range(n):
            a, b = k * win, (k + 1) * win
            local.append(sum(1 for w in spoken if a <= float(w["start"]) < b) / win * 60.0)
    wpm_stdev = float(np.std(local)) if len(local) >= 2 else 0.0

    _, st = _voiced_semitones(contours, cfg)
    lo, hi = m["pitch_range_percentiles"]
    pitch_range = float(np.percentile(st, hi) - np.percentile(st, lo)) if len(st) >= 2 else 0.0

    energy = [float(e) for e in (contours.get("energyPart") or []) if e is not None]
    elo, ehi = m["energy_range_percentiles"]
    energy_range = float(np.percentile(energy, ehi) - np.percentile(energy, elo)) if len(energy) >= 2 else 0.0
    climax = bool(energy) and (max(energy) - float(np.median(energy))) >= m["climax_peak_over_median_db"]

    gaps = [float(words[i + 1]["start"]) - float(words[i]["end"]) for i in range(len(words) - 1)]
    pmin, pmax = m["deliberate_pause_sec"]
    return {
        "duration_sec": round(duration, 2),
        "word_count": word_count,
        "wpm": round(wpm, 1),
        "wpm_stdev": round(wpm_stdev, 2),
        "filler_count": sum(1 for f in flaws if f.get("type") == "FILLER_HEAVY"),
        "uptalk_count": sum(1 for f in flaws if f.get("type") == "PITCH_UPTALK"),
        "pitch_range_st": round(pitch_range, 2),
        "energy_range_db": round(energy_range, 2),
        "climax_peak": climax,
        "longest_pause_sec": round(max(gaps), 2) if gaps else 0.0,
        "deliberate_pause_count": sum(1 for g in gaps if pmin <= g <= pmax),
    }


# ---------- weighting, caps and bonuses ----------
def apply_mode_weights(flaws: Sequence[Flaw], mode: str, cfg: dict[str, Any] | None = None) -> list[Flaw]:
    cfg = cfg or get_mode_config()
    mults = _mode(cfg, mode)["multipliers"]
    out = []
    for f in flaws:
        g = dict(f)
        g["base_penalty"] = f.get("base_penalty", f["penalty"])
        g["penalty"] = round(float(g["base_penalty"]) * float(mults.get(f.get("bucket", "pacing"), 1.0)), 2)
        out.append(g)
    return out


def evaluate_bonuses(metrics: dict[str, Any], mode: str, cfg: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    cfg = cfg or get_mode_config()
    applied = []
    for rule in _mode(cfg, mode).get("bonus_rules") or []:
        ok = all(
            c["metric"] in metrics and _OPS[c["op"]](metrics[c["metric"]], c["value"]) for c in rule["conditions"]
        )
        if ok:
            applied.append({"rule_id": rule["rule_id"], "description": rule["description"], "points": float(rule["bonus_points"])})
    return applied


def compute_score(
    flaws: Sequence[Flaw], mode: str, metrics: dict[str, Any] | None = None, cfg: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Total and per-bucket deductions (capped), plus bonuses; never above start_score."""
    cfg = cfg or get_mode_config()
    caps = {**cfg["bucket_caps"], **_mode(cfg, mode).get("bucket_caps", {})}
    sums = dict.fromkeys(BUCKETS, 0.0)
    for f in flaws:
        b = f.get("bucket")
        if b in sums:
            sums[b] += float(f["penalty"])
    buckets = {b: round(max(s, float(caps[b])), 1) for b, s in sums.items()}
    bonuses = evaluate_bonuses(metrics or {}, mode, cfg)
    start = float(cfg["start_score"])
    total = start + sum(buckets.values()) + sum(b["points"] for b in bonuses)
    return {
        "total": round(min(start, max(0.0, total)), 1),
        "buckets": buckets,
        "bonuses": round(sum(b["points"] for b in bonuses), 1),
        "bonus_rules": bonuses,
        "scoring_version": cfg["scoring_version"],
        "config_hash": cfg["config_hash"],
    }


def score_analysis(
    flaws: Sequence[Flaw],
    words: Sequence[Word],
    contours: dict[str, Any],
    duration: float,
    mode: str,
    cfg: dict[str, Any] | None = None,
) -> tuple[list[Flaw], dict[str, Any], dict[str, Any]]:
    """Full M1-Ext scoring: add rule-based flaws, weight by mode, cap, add bonuses.

    Returns (weighted flaws with stable IDs sorted by time, score, delivery metrics).
    """
    cfg = cfg or get_mode_config()
    all_flaws = list(flaws) + detect_uptalk(words, contours, cfg) + detect_fillers(words, cfg)
    metrics = compute_metrics(words, contours, all_flaws, duration, cfg)
    weighted = with_stable_ids(apply_mode_weights(all_flaws, mode, cfg))
    weighted.sort(key=lambda f: (float(f.get("start_time", 0.0)), str(f.get("type", ""))))
    return weighted, compute_score(weighted, mode, metrics, cfg), metrics
