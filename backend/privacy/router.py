"""Public legal documents, consent recording, data export and account deletion."""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from pymongo import ASCENDING

from backend.auth.config import AuthSettings, get_settings
from backend.auth.db import AUDIT, CONSENTS, USERS, get_db
from backend.auth.passwords import verify_password
from backend.auth.ratelimit import limiter
from backend.auth.router import count_admins
from backend.auth.sessions import (
    Db,
    Principal,
    audit,
    aware,
    clear_cookie,
    get_user,
    list_user_sessions,
    require_principal,
    revoke_user_sessions,
)

from . import consent
from .config import PrivacySettings, get_privacy_settings
from .legal import current_versions, get_docs

router = APIRouter(tags=["privacy"])


def _iso(dt: datetime | None) -> str | None:
    a = aware(dt)
    return a.isoformat() if a else None


# ---------- public ----------
@router.get("/legal")
def legal_index(cfg: PrivacySettings = Depends(get_privacy_settings)) -> dict[str, object]:
    docs = get_docs()
    return {
        "controller": cfg.controller,
        "contact_url": cfg.contact_url,
        "minimum_age": cfg.minimum_age,
        "required_on_signup": list(cfg.required_on_signup),
        "documents": [{"slug": d.slug, "title": d.title, "version": d.version, "effective": d.effective} for d in docs.values()],
    }


@router.get("/legal/{slug}")
def legal_doc(slug: str) -> dict[str, str]:
    doc = get_docs().get(slug)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such document.")
    return {"slug": doc.slug, "title": doc.title, "version": doc.version, "effective": doc.effective, "body": doc.body}


# ---------- signed in ----------
class AcceptIn(BaseModel):
    documents: list[str] = Field(min_length=1, max_length=5)


@router.post("/privacy/accept")
def accept_documents(
    body: AcceptIn, request: Request, p: Principal = Depends(require_principal), db: Db = Depends(get_db)
) -> dict[str, object]:
    versions = current_versions()
    unknown = [d for d in body.documents if d not in versions]
    if unknown:
        raise HTTPException(422, f"Unknown document: {unknown[0]}")
    for doc in body.documents:
        consent.record(db, p.user.id, doc, versions[doc])
    audit(db, "documents_accepted", request=request, user=p.user, detail=", ".join(f"{d} {versions[d]}" for d in body.documents))
    return {"ok": True, "outstanding": consent.outstanding(db, p.user.id)}


class CookieChoiceIn(BaseModel):
    preferences: bool
    history: bool


@router.post("/privacy/cookie-consent")
def cookie_consent(
    body: CookieChoiceIn, p: Principal = Depends(require_principal), db: Db = Depends(get_db)
) -> dict[str, bool]:
    """Keeps a server-side record of the storage choice the user made in the cookie banner."""
    choice = f"preferences={int(body.preferences)},history={int(body.history)}"
    consent.record(db, p.user.id, "cookies", current_versions()["cookies"], choice)
    return {"ok": True}


@router.get("/privacy/export")
def export_data(
    response: Response,
    p: Principal = Depends(require_principal),
    db: Db = Depends(get_db),
    cfg: PrivacySettings = Depends(get_privacy_settings),
) -> Response:
    """Everything the server holds about the signed-in user, as a JSON download."""
    wait = limiter.hit(f"export:{p.user.id}", cfg.export_per_hour, 3600)
    if wait > 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many exports. Try again later.", headers={"Retry-After": str(int(wait) + 1)})
    u = p.user
    sessions = list_user_sessions(u.id)
    consents = consent.history(db, u.id)
    events = list(db[AUDIT].find({"user_id": u.id}).sort("_id", ASCENDING))
    from backend.leaderboard.store import LeaderboardUnavailable, user_entries

    try:
        leaderboard: object = user_entries(u.id)
    except LeaderboardUnavailable:
        leaderboard = "The leaderboard service is unavailable right now; export again later to include it."
    payload = {
        "exported_at": _iso(datetime.now().astimezone()),
        "account": {
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
            "created_at": _iso(u.created_at),
            "last_login_at": _iso(u.last_login_at),
            "password_changed_at": _iso(u.password_changed_at),
            "leaderboard_opt_in": u.leaderboard_opt_in,
            "password": "Stored only as a salted scrypt hash; not included.",
        },
        "sessions": [
            {
                "created_at": _iso(s.created_at),
                "last_seen_at": _iso(s.last_seen_at),
                "expires_at": _iso(s.expires_at),
                "ip": s.ip,
                "user_agent": s.user_agent,
            }
            for s in sessions
        ],
        "consents": [
            {"document": c["document"], "version": c["version"], "choice": c["choice"], "at": _iso(c["at"])} for c in consents
        ],
        "security_events": [
            {"at": _iso(e.get("at")), "event": e.get("event", ""), "ip": e.get("ip", ""), "detail": e.get("detail", "")}
            for e in events
        ],
        "leaderboard": leaderboard,
        "recordings": "Recordings are processed in memory and never stored.",
        "browser_data": "Analyses and battles you chose to keep are stored in your own browser, not on the server.",
    }
    audit(db, "data_exported", user=u)
    return Response(
        json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="speech-arena-my-data.json"', "Cache-Control": "no-store"},
    )


class DeleteIn(BaseModel):
    password: str = Field(max_length=1024)
    confirm: str = Field(max_length=16)


@router.post("/privacy/delete-account")
def delete_account(
    body: DeleteIn,
    request: Request,
    response: Response,
    p: Principal = Depends(require_principal),
    db: Db = Depends(get_db),
    cfg: AuthSettings = Depends(get_settings),
) -> dict[str, bool]:
    """Permanently deletes the account, its sessions, consent records and leaderboard scores.
    Security events about the account are kept for the audit period but no longer name the person."""
    if body.confirm != "DELETE":
        raise HTTPException(422, 'Type DELETE to confirm.')
    wait = limiter.hit(f"delete:{p.user.id}", cfg.max_failed_attempts, 15 * 60)
    if wait > 0:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Try again later.")
    user = get_user(db, p.user.id)
    assert user is not None
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your password is incorrect.")
    if user.role == "admin" and user.is_active and count_admins(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You're the only administrator. Make someone else an admin first.")

    user_id = user.id
    # Sessions first: if the session store is down this fails with 503 before anything is deleted.
    revoke_user_sessions(user_id)
    db[AUDIT].update_many({"user_id": user_id}, {"$set": {"email": "", "user_id": None, "detail": "", "ip": ""}})
    db[AUDIT].update_many({"actor_id": user_id}, {"$set": {"actor_id": None}})
    db[CONSENTS].delete_many({"user_id": user_id})
    db[USERS].delete_one({"_id": user_id})
    audit(db, "account_deleted")

    # Leaderboards store only user IDs and drop IDs with no account when read, so a Redis
    # outage here can't leave a name on a board. Remove the scores now when Redis is up.
    from backend.leaderboard.store import LeaderboardUnavailable, remove_user

    try:
        remove_user(user_id)
    except LeaderboardUnavailable:
        pass

    # Drop any analysis results still held in memory for this user.
    try:
        from backend.api.routers.analysis import forget_user_jobs

        forget_user_jobs(user_id)
    except ImportError:
        pass
    clear_cookie(response, cfg)
    return {"ok": True}
