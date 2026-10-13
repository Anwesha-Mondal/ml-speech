"""Interactive practice-mode endpoints (megaev.md §11.2-§11.5; Phases M3-M6).

Stateless by design: the browser keeps the turn history, so the server stores nothing new about
the user. Recordings are scored by the existing /api/analyze job with the matching mode.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.auth.db import User
from backend.auth.sessions import require_user
from backend.rag.retriever import Document, get_retriever

from . import logic

router = APIRouter(prefix="/modes", tags=["modes"], dependencies=[Depends(require_user)])


def _doc(domain: str, document_id: str) -> Document:
    d = get_retriever().get(document_id)
    if d is None or d["domain"] != domain:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    return d


# ---------- M3: interviewer ----------
@router.get("/interview/catalog")
def interview_catalog() -> dict[str, Any]:
    cfg = logic.get_modes_config()["interview"]
    industries: dict[str, dict[str, Any]] = {}
    for d in get_retriever().in_domain("interviewer"):
        m = d["metadata"]
        ind = industries.setdefault(
            m["industry"],
            {"id": m["industry"], "name": m["industry_name"], "scope": m["industry_scope"], "roles": m["roles"], "question_types": []},
        )
        ind["question_types"].append(m["question_type"])
    return {"industries": list(industries.values()), "seniorities": cfg["seniorities"], "max_turns": cfg["max_turns"]}


class InterviewStart(BaseModel):
    industry: str = Field(max_length=64)
    role: str = Field(default="", max_length=120)
    seniority: str = Field(default="mid", max_length=20)
    interview_type: str = Field(default="", max_length=64)


@router.post("/interview/start")
def interview_start(body: InterviewStart) -> dict[str, Any]:
    cfg = logic.get_modes_config()["interview"]
    doc = logic.first_question(get_retriever(), body.industry, body.interview_type)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown industry.")
    return {
        "industry": body.industry,
        "industry_name": doc["metadata"]["industry_name"],
        "role": body.role,
        "seniority": body.seniority,
        "interviewer_name": cfg["interviewer_name"],
        "turn_index": 1,
        "max_turns": cfg["max_turns"],
        "next": logic.question_payload(doc),
    }


class InterviewTurn(BaseModel):
    industry: str = Field(max_length=64)
    last_question_id: str = Field(max_length=96)
    transcript: str = Field(default="", max_length=8000)
    asked_ids: list[str] = Field(default_factory=list, max_length=20)
    turn_index: int = Field(ge=1, le=20)
    duration_sec: float | None = Field(default=None, ge=0, le=3600)


@router.post("/interview/next")
def interview_next(body: InterviewTurn) -> dict[str, Any]:
    cfg = logic.get_modes_config()["interview"]
    retriever = get_retriever()
    base = retriever.get(body.last_question_id.split("#", 1)[0])
    if base is None or base["domain"] != "interviewer" or base["metadata"]["industry"] != body.industry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown question.")
    hit, missing = logic.keyword_hits(body.transcript, base["metadata"]["keywords"])
    feedback = {
        "star": logic.star_coverage(body.transcript),
        "keywords_mentioned": hit,
        "keywords_not_mentioned": missing,
        "length_note": logic.answer_length_note(body.duration_sec),
        "exemplar": base["metadata"]["exemplar"],
    }
    finished = body.turn_index >= cfg["max_turns"]
    nxt = None if finished else logic.next_turn(retriever, body.industry, body.last_question_id, body.transcript, body.asked_ids)
    return {"feedback": feedback, "finished": finished or nxt is None, "turn_index": body.turn_index + 1, "next": nxt}


# ---------- M4: news anchor ----------
@router.get("/news/config")
def news_config() -> dict[str, Any]:
    return logic.get_modes_config()["news"]  # type: ignore[no-any-return]


@router.get("/news/scripts")
def news_scripts() -> dict[str, Any]:
    return {
        "scripts": [
            {"script_id": d["document_id"], "title": d["title"], "category": d["metadata"]["category"],
             "target_wpm": d["metadata"]["target_wpm"], "estimated_duration_sec": d["metadata"]["estimated_duration_sec"]}
            for d in get_retriever().in_domain("newsroom")
        ]
    }


@router.get("/news/scripts/{script_id}")
def news_script(script_id: str) -> dict[str, Any]:
    d = _doc("newsroom", script_id)
    return {"script_id": d["document_id"], "title": d["title"], "text": d["content"], **d["metadata"]}


# ---------- M5: public speaking & debate ----------
@router.get("/public/config")
def public_config() -> dict[str, Any]:
    return logic.get_modes_config()["public_speaking"]  # type: ignore[no-any-return]


@router.get("/public/motions")
def public_motions() -> dict[str, Any]:
    return {
        "motions": [
            {"motion_id": d["document_id"], "title": d["title"], "motion": d["metadata"]["motion"], "format": d["metadata"]["format"]}
            for d in get_retriever().in_domain("debate")
        ]
    }


class SparIn(BaseModel):
    motion_id: str = Field(max_length=64)
    user_stance: Literal["affirmative", "negative"]


@router.post("/public/spar")
def public_spar(body: SparIn) -> dict[str, Any]:
    return logic.spar(_doc("debate", body.motion_id), body.user_stance)


# ---------- M6: storytelling ----------
@router.get("/story/scripts")
def story_scripts() -> dict[str, Any]:
    return {
        "scripts": [
            {"script_id": d["document_id"], "title": d["title"], "format": d["metadata"]["format"], "genre": d["metadata"]["genre"]}
            for d in get_retriever().in_domain("storytelling")
        ]
    }


@router.get("/story/scripts/{script_id}")
def story_script(script_id: str) -> dict[str, Any]:
    d = _doc("storytelling", script_id)
    return {"script_id": d["document_id"], "title": d["title"], "text": d["content"], **d["metadata"]}


class ArcIn(BaseModel):
    job_id: str = Field(max_length=64)


@router.post("/story/arc")
def story_arc(body: ArcIn, user: User = Depends(require_user)) -> dict[str, Any]:
    """Freytag arc of a finished analysis job (owner only, like /api/jobs)."""
    from backend.api.routers.analysis import job_store  # deferred: heavy ML imports

    job = job_store.get(body.job_id)
    if job is None or job.get("owner_id") != user.id or job.get("status") != "completed":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found.")
    result = job["result"]
    return logic.arc_evaluation(result.get("contours") or {}, float(result.get("duration") or 0.0))
