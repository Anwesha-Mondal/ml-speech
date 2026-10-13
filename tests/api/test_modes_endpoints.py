"""Phases M3-M6: interactive mode endpoints (megaev.md §11, §15.2)."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.modes.logic import arc_evaluation, star_coverage

from .conftest import csrf_headers, register


def _client(app: FastAPI) -> tuple[TestClient, dict[str, str]]:
    c = TestClient(app, base_url="http://testserver")
    return c, csrf_headers(register(c))


def test_modes_require_sign_in(client: TestClient) -> None:
    assert client.get("/api/modes/interview/catalog").status_code == 401
    assert client.post("/api/rag/query", json={"domain": "debate", "query_text": "ai"}).status_code in (401, 403)


def test_interview_catalog(app: FastAPI) -> None:
    c, _ = _client(app)
    cat = c.get("/api/modes/interview/catalog").json()
    ids = {i["id"] for i in cat["industries"]}
    assert {"software_engineering", "healthcare_medicine", "education_edtech"} <= ids and len(ids) >= 21
    swe = next(i for i in cat["industries"] if i["id"] == "software_engineering")
    assert "Distributed Systems Architect" in swe["roles"] and len(swe["question_types"]) == 5
    assert cat["max_turns"] == 5


def test_three_turn_healthcare_interview(app: FastAPI) -> None:
    """megaev §14.3 exit criterion: pick Healthcare, answer three turns, get feedback each turn."""
    c, h = _client(app)
    start = c.post("/api/modes/interview/start", json={"industry": "healthcare_medicine", "interview_type": "Diagnostic"}, headers=h).json()
    q = start["next"]
    assert q["question_id"] == "int_healthcare_medicine_02" and "dyspnea" in q["question"]
    asked = [q["question_id"]]
    answers = [
        (
            "At my hospital the patient was unstable. My goal was to rule out pulmonary embolism, so I ordered a D-dimer "
            "and used the Wells criteria. As a result we confirmed the diagnosis within 40 minutes."
        ),
        "I decided on bedside ultrasound because contrast was contraindicated.",
        "The outcome improved our triage time by 20 percent.",
    ]
    for turn, answer in enumerate(answers, start=1):
        r = c.post(
            "/api/modes/interview/next",
            json={"industry": "healthcare_medicine", "last_question_id": q["question_id"], "transcript": answer,
                  "asked_ids": asked, "turn_index": turn, "duration_sec": 42.0},
            headers=h,
        ).json()
        assert r["feedback"]["star"]["of"] == 4
        if turn == 1:
            assert r["feedback"]["star"]["covered"] == 4
            assert "Wells criteria" in r["feedback"]["keywords_mentioned"]
            # A follow-up probe fires on a trigger word the candidate actually said.
            assert r["next"]["kind"] == "probe" and r["next"]["trigger"].lower() in answer.lower()
        assert r["finished"] is False and r["next"]["question_id"] not in asked
        q = r["next"]
        asked.append(q["question_id"])
    assert len(set(asked)) == 4


def test_probe_triggered_by_answer(app: FastAPI) -> None:
    c, h = _client(app)
    r = c.post(
        "/api/modes/interview/next",
        json={"industry": "software_engineering", "last_question_id": "int_software_engineering_01",
              "transcript": "We used Redis for the counters.", "asked_ids": [], "turn_index": 1},
        headers=h,
    ).json()
    assert r["next"]["kind"] == "probe" and r["next"]["question_id"] == "int_software_engineering_01#p1"
    assert "Redis" in r["next"]["question"]


def test_interview_ends_at_max_turns_and_rejects_mismatch(app: FastAPI) -> None:
    c, h = _client(app)
    body: dict[str, Any] = {"industry": "software_engineering", "last_question_id": "int_software_engineering_01",
                            "transcript": "x", "asked_ids": [], "turn_index": 5}
    r = c.post("/api/modes/interview/next", json=body, headers=h).json()
    assert r["finished"] is True and r["next"] is None
    bad = c.post("/api/modes/interview/next", json={**body, "industry": "healthcare_medicine"}, headers=h)
    assert bad.status_code == 404
    assert c.post("/api/modes/interview/start", json={"industry": "nope"}, headers=h).status_code == 404


def test_news_scripts(app: FastAPI) -> None:
    c, _ = _client(app)
    scripts = c.get("/api/modes/news/scripts").json()["scripts"]
    assert len(scripts) == 6 and all(130 <= s["target_wpm"] <= 150 for s in scripts)
    s = c.get("/api/modes/news/scripts/wire_fin_02").json()
    assert "[PAUSE" not in s["text"] and "[PAUSE" in s["teleprompter_text"]
    assert s["breaking_alert"]["flash_text"].startswith("FLASH") and 0 < s["breaking_alert"]["trigger_at_second"] < s["estimated_duration_sec"]
    assert c.get("/api/modes/news/scripts/motion_01").status_code == 404  # wrong domain


def test_debate_sparring(app: FastAPI) -> None:
    c, h = _client(app)
    motions = c.get("/api/modes/public/motions").json()["motions"]
    assert len(motions) == 10
    r = c.post("/api/modes/public/spar", json={"motion_id": "motion_02", "user_stance": "affirmative"}, headers=h).json()
    assert r["opponent_stance"] == "negative" and "inflation" in r["rebuttal_text"]
    assert r["point_of_information"].startswith("Point of Information")
    cfg = c.get("/api/modes/public/config").json()
    assert [t["tier"] for t in cfg["stage_tiers"]] == [1, 2, 3, 4] and cfg["breathing"]["hold_sec"] == 7


def test_story_scripts_and_arc(app: FastAPI) -> None:
    from backend.api.routers import analysis

    c, h = _client(app)
    stories = c.get("/api/modes/story/scripts").json()["scripts"]
    assert len(stories) == 5
    s = c.get("/api/modes/story/scripts/story_bedtime_04").json()
    assert [ch["name"] for ch in s["characters"]] == ["Narrator", "Barnaby", "Pippin"] and "[VOICE" not in s["text"]

    me = c.get("/api/auth/me").json()["user"]["id"]
    t = [i * 0.5 for i in range(40)]
    energy = [-30.0 if ti < 11 else (-15.0 if ti < 14 else -28.0) for ti in t]  # peak in the climax phase
    analysis.job_store["j-arc"] = {"status": "completed", "owner_id": me, "result": {"duration": 20.0, "contours": {"t": t, "energyPart": energy}}}
    analysis.job_store["j-other"] = {"status": "completed", "owner_id": "someone-else", "result": {"duration": 20.0, "contours": {}}}
    try:
        arc = c.post("/api/modes/story/arc", json={"job_id": "j-arc"}, headers=h).json()
        assert arc["arc_match"] == 3 and arc["checks"]["climax_is_loudest_phase"] is True
        assert c.post("/api/modes/story/arc", json={"job_id": "j-other"}, headers=h).status_code == 404
    finally:
        analysis.job_store.pop("j-arc", None)
        analysis.job_store.pop("j-other", None)


def test_rag_query_endpoint(app: FastAPI) -> None:
    c, h = _client(app)
    r = c.post("/api/rag/query", json={"domain": "interviewer", "query_text": "LBO returns IRR", "top_k": 2}, headers=h)
    assert r.status_code == 200 and r.json()["results"][0]["document_id"] == "int_investment_banking_02"
    assert c.post("/api/rag/query", json={"domain": "nope", "query_text": "x"}, headers=h).status_code == 422


def test_star_coverage_reports_structure_only() -> None:
    cov = star_coverage("We were behind schedule. I was responsible for the release, so I rebuilt the pipeline. It cut build time by 40%.")
    assert cov["covered"] == 4
    assert star_coverage("Hello.")["covered"] == 0


def test_flat_story_fails_arc_checks() -> None:
    arc = arc_evaluation({"t": [i * 0.5 for i in range(40)], "energyPart": [-20.0] * 40}, 20.0)
    assert arc["checks"]["climax_above_exposition"] is False and len(arc["phases"]) == 5
