"""Phase M1-Ext: multi-mode scoring from configs/scoring/modes_v2.0.yaml (megaev.md §10, §32.1)."""

from __future__ import annotations

from typing import Any

import pytest

from packages.speech_arena.scoring.modes import (
    apply_mode_weights,
    compute_metrics,
    compute_score,
    detect_fillers,
    detect_uptalk,
    evaluate_bonuses,
    flaw_id,
    get_mode_config,
    known_modes,
    score_analysis,
)

MODES = ("sandbox", "interviewer", "news_anchor", "public_speaking", "storytelling")


def _flaw(kind: str, bucket: str, penalty: float, start: float = 1.0) -> dict[str, Any]:
    return {"type": kind, "bucket": bucket, "penalty": penalty, "start_time": start, "end_time": start + 0.5, "confidence": 0.9}


def _words(spec: list[tuple[str, float, float]]) -> list[dict[str, Any]]:
    return [{"text": t, "start": a, "end": b} for t, a, b in spec]


def test_all_five_modes_are_configured() -> None:
    cfg = get_mode_config()
    assert set(MODES) == set(known_modes())
    for m in MODES:
        assert set(cfg["modes"][m]["multipliers"]) == {"pacing", "pitch", "pauses", "energy_clarity"}
    assert cfg["scoring_version"] == "s2.0" and len(cfg["config_hash"]) == 16


def test_news_anchor_uptalk_penalty_is_amplified() -> None:
    weighted = apply_mode_weights([_flaw("PITCH_UPTALK", "pitch", -2.5)], "news_anchor")
    assert weighted[0]["penalty"] == pytest.approx(-3.5)  # 1.4 × −2.5
    assert weighted[0]["base_penalty"] == -2.5


def test_interviewer_weighs_pauses_more_than_sandbox() -> None:
    f = [_flaw("PAUSE_EXCESSIVE", "pauses", -2.0)]
    assert abs(apply_mode_weights(f, "interviewer")[0]["penalty"]) > abs(apply_mode_weights(f, "sandbox")[0]["penalty"])


@pytest.mark.parametrize("mode", MODES)
def test_bucket_caps_hold_in_every_mode(mode: str) -> None:
    cfg = get_mode_config()
    flaws = apply_mode_weights([_flaw("PITCH_MONOTONE", "pitch", -3.0, start=float(i)) for i in range(40)], mode)
    score = compute_score(flaws, mode)
    assert score["buckets"]["pitch"] == cfg["modes"][mode]["bucket_caps"]["pitch"]
    assert 0.0 <= score["total"] <= 100.0


def test_clean_delivery_scores_100_and_bonuses_never_exceed_it() -> None:
    metrics = {"pitch_range_st": 12.0, "climax_peak": True}
    score = compute_score([], "storytelling", metrics)
    assert score["total"] == 100.0 and score["bonuses"] == 5.0
    assert score["bonus_rules"][0]["rule_id"] == "dramatic_excursion"


def test_bonus_rules_need_every_condition() -> None:
    ok = {"duration_sec": 60.0, "filler_count": 0}
    assert [b["rule_id"] for b in evaluate_bonuses(ok, "interviewer")] == ["concise_answer"]
    assert evaluate_bonuses({**ok, "filler_count": 2}, "interviewer") == []
    assert evaluate_bonuses({"duration_sec": 60.0}, "interviewer") == []  # missing metric never passes


def test_bonus_offsets_deductions() -> None:
    flaws = apply_mode_weights([_flaw("PACING_TOO_FAST", "pacing", -2.0, float(i)) for i in range(3)], "interviewer")
    plain = compute_score(flaws, "interviewer")
    boosted = compute_score(flaws, "interviewer", {"duration_sec": 60.0, "filler_count": 0})
    assert boosted["total"] == pytest.approx(plain["total"] + 3.0)


def test_uptalk_detected_on_rising_phrase_end_only() -> None:
    t = [round(i * 0.05, 2) for i in range(60)]  # 0.00 .. 2.95 s
    # Flat at 120 Hz, then rising sharply over the last 0.3 s before 1.5 s, then flat again.
    pitch = [120.0 * (2 ** ((max(0.0, ti - 1.2) * 12.0) / 12.0)) if 1.2 <= ti <= 1.5 else 120.0 for ti in t]
    contours = {"t": t, "pitchPart": pitch}
    words = _words([("the", 0.2, 0.5), ("plan", 0.6, 1.5), ("works", 2.2, 2.9)])
    flaws = detect_uptalk(words, contours)
    assert len(flaws) == 1 and flaws[0]["word"] == "plan" and flaws[0]["type"] == "PITCH_UPTALK"
    assert flaws[0]["evidence"]["participant_value"] > 3.5
    assert "Pitch rose" in flaws[0]["explanation"] and "you" not in flaws[0]["explanation"].lower()


def test_flat_pitch_has_no_uptalk() -> None:
    contours = {"t": [i * 0.05 for i in range(40)], "pitchPart": [130.0] * 40}
    assert detect_uptalk(_words([("hello", 0.0, 1.0), ("there", 1.5, 1.9)]), contours) == []


def test_fillers_detected_from_word_timings() -> None:
    flaws = detect_fillers(_words([("So,", 0.0, 0.2), ("um", 0.3, 0.7), ("Uh.", 1.0, 1.2), ("yes", 1.3, 1.5)]))
    assert [f["word"] for f in flaws] == ["um", "uh"]
    assert all(f["type"] == "FILLER_HEAVY" for f in flaws)


def test_metrics_from_words_and_contours() -> None:
    words = _words([(f"w{i}", i * 0.5, i * 0.5 + 0.3) for i in range(40)] + [("end", 21.6, 22.0)])
    contours = {"t": [i * 0.5 for i in range(44)], "pitchPart": [100.0, 200.0] * 22, "energyPart": [-30.0] * 43 + [-10.0]}
    m = compute_metrics(words, contours, [], 22.0)
    assert m["word_count"] == 41 and m["wpm"] == pytest.approx(111.8, abs=0.1)
    assert m["pitch_range_st"] == pytest.approx(12.0, abs=0.01)  # 100 → 200 Hz is one octave
    assert m["climax_peak"] is True and m["deliberate_pause_count"] == 1  # 1.8 s gap before "end"


def test_flaw_ids_are_stable() -> None:
    assert flaw_id("PITCH_UPTALK", 1.2, 1.5, "plan") == flaw_id("PITCH_UPTALK", 1.2, 1.5, "plan")
    assert flaw_id("PITCH_UPTALK", 1.2, 1.5) != flaw_id("PITCH_UPTALK", 1.3, 1.5)


def test_score_analysis_is_deterministic() -> None:
    words = _words([("so", 0.0, 0.3), ("um", 0.4, 0.8), ("we", 0.9, 1.1), ("shipped", 1.2, 1.6)])
    contours = {"t": [i * 0.05 for i in range(40)], "pitchPart": [130.0] * 40, "energyPart": [-20.0] * 40}
    raw = [_flaw("PACING_TOO_FAST", "pacing", -2.0, 0.5)]
    runs = [score_analysis(raw, words, contours, 2.0, "interviewer") for _ in range(5)]
    assert all(r == runs[0] for r in runs)
    flaws, score, metrics = runs[0]
    assert {f["type"] for f in flaws} == {"PACING_TOO_FAST", "FILLER_HEAVY"}
    assert metrics["filler_count"] == 1 and score["scoring_version"] == "s2.0"
