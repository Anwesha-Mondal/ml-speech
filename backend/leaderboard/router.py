"""Leaderboard endpoints. Showing up on a board is opt-in (Settings → Leaderboard)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from backend.auth.db import USERS, User, get_db
from backend.auth.sessions import Db, audit, require_user

from . import store
from .config import LeaderboardSettings, get_leaderboard_settings

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

GLOBAL = "global"


def _unavailable() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The leaderboard is unavailable right now. Try again shortly.")


@router.get("/prompts")
def prompts(
    _: User = Depends(require_user), cfg: LeaderboardSettings = Depends(get_leaderboard_settings)
) -> dict[str, object]:
    return {
        "scoring_version": cfg.scoring_version,
        "prompts": [{"id": k, "title": v} for k, v in cfg.prompts.items()],
    }


@router.get("")
def board(
    prompt_id: str = Query(GLOBAL, max_length=64),
    user: User = Depends(require_user),
    db: Db = Depends(get_db),
    cfg: LeaderboardSettings = Depends(get_leaderboard_settings),
) -> dict[str, object]:
    if prompt_id != GLOBAL and prompt_id not in cfg.prompts:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No leaderboard for that passage.")
    try:
        rows = store.top(None if prompt_id == GLOBAL else prompt_id, cfg.top_n * cfg.fetch_factor)
        mine = store.user_entries(user.id)
    except store.LeaderboardUnavailable:
        raise _unavailable() from None

    # Names come from MongoDB, and only for accounts that currently opt in.
    ids = [uid for uid, _ in rows]
    visible = {
        d["_id"]: d["display_name"]
        for d in db[USERS].find(
            {"_id": {"$in": ids}, "leaderboard_opt_in": True, "is_active": True}, {"display_name": 1}
        )
    }
    rankings: list[dict[str, object]] = []
    for uid, score in rows:
        if uid not in visible:
            continue
        rankings.append(
            {"rank": len(rankings) + 1, "display_name": visible[uid], "score": round(score, 2), "you": uid == user.id}
        )
        if len(rankings) >= cfg.top_n:
            break

    if prompt_id == GLOBAL:
        your_best: float | None = round(sum(e["best_score"] for e in mine), 2) if mine else None
    else:
        your_best = next((e["best_score"] for e in mine if e["prompt_id"] == prompt_id), None)
    return {
        "prompt_id": prompt_id,
        "title": "All passages" if prompt_id == GLOBAL else cfg.prompts[prompt_id],
        "scoring_version": cfg.scoring_version,
        "rankings": rankings,
        "you": {"opted_in": user.leaderboard_opt_in, "best_score": your_best},
    }


class OptIn(BaseModel):
    opt_in: bool


@router.put("/opt-in")
def set_opt_in(
    body: OptIn, request: Request, user: User = Depends(require_user), db: Db = Depends(get_db)
) -> dict[str, object]:
    db[USERS].update_one({"_id": user.id}, {"$set": {"leaderboard_opt_in": body.opt_in}})
    removed = 0
    if not body.opt_in:
        # Names disappear at once (boards only show opted-in accounts); also drop the scores.
        try:
            removed = store.remove_user(user.id)
        except store.LeaderboardUnavailable:
            pass
    audit(db, "leaderboard_opt_in" if body.opt_in else "leaderboard_opt_out", request=request, user=user)
    return {"ok": True, "leaderboard_opt_in": body.opt_in, "removed_scores": removed}


def submit_result(user_id: str, prompt_id: str, score: float) -> dict[str, object]:
    """Called when an analysis finishes. Records the score only for opted-in users on a ranked passage."""
    cfg = get_leaderboard_settings()
    if prompt_id not in cfg.prompts:
        return {"eligible": False, "reason": "This passage has no leaderboard."}
    doc = get_db()[USERS].find_one({"_id": user_id}, {"leaderboard_opt_in": 1})
    if not doc or not doc.get("leaderboard_opt_in"):
        return {"eligible": False, "reason": "Join the leaderboard in Settings to rank your scores."}
    try:
        new_best = store.submit(user_id, prompt_id, score)
    except store.LeaderboardUnavailable:
        return {"eligible": True, "submitted": False, "reason": "The leaderboard is unavailable right now."}
    return {"eligible": True, "submitted": True, "new_best": new_best, "prompt_id": prompt_id}
