"""Administrator endpoints: user management and the security audit log."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from pymongo import ASCENDING, DESCENDING

from .db import AUDIT, USERS, User, get_db
from .router import _iso, count_admins
from .sessions import Db, audit, aware, get_user, require_admin, revoke_user_sessions

router = APIRouter(prefix="/admin", tags=["admin"])


class UserPatch(BaseModel):
    role: Literal["user", "admin"] | None = None
    is_active: bool | None = None


def admin_user_out(u: User) -> dict[str, object]:
    locked = aware(u.locked_until)
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "role": u.role,
        "is_active": u.is_active,
        "locked_until": locked.isoformat() if locked else None,
        "created_at": _iso(u.created_at),
        "last_login_at": _iso(u.last_login_at),
    }


@router.get("/users")
def list_users(_: User = Depends(require_admin), db: Db = Depends(get_db)) -> dict[str, object]:
    users = [User.from_doc(d) for d in db[USERS].find().sort("created_at", ASCENDING).limit(1000)]
    return {"users": [admin_user_out(u) for u in users]}


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UserPatch,
    request: Request,
    actor: User = Depends(require_admin),
    db: Db = Depends(get_db),
) -> dict[str, object]:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if user.id == actor.id and (body.role == "user" or body.is_active is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't remove your own admin access or disable yourself.")

    removing_admin = user.role == "admin" and user.is_active and (body.role == "user" or body.is_active is False)
    if removing_admin and count_admins(db) <= 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one active administrator must remain.")

    changes: list[str] = []
    updates: dict[str, object] = {}
    if body.role is not None and body.role != user.role:
        changes.append(f"role {user.role}->{body.role}")
        updates["role"] = body.role
    if body.is_active is not None and body.is_active != user.is_active:
        changes.append("enabled" if body.is_active else "disabled")
        updates["is_active"] = body.is_active
        if not body.is_active:
            revoke_user_sessions(user.id)  # before the update: a store outage leaves nothing half-done
    if body.is_active:
        # Enabling (or "unlocking" an active account) clears a lockout.
        if user.locked_until is not None:
            changes.append("unlocked")
        updates["locked_until"] = None
        updates["failed_attempts"] = 0
    if updates:
        db[USERS].update_one({"_id": user.id}, {"$set": updates})
    if changes:
        audit(db, "admin_user_updated", request=request, user=user, actor_id=actor.id, detail=", ".join(changes))
    updated = get_user(db, user.id)
    assert updated is not None
    return {"user": admin_user_out(updated)}


@router.get("/audit")
def audit_log(
    limit: int = Query(100, ge=1, le=500),
    _: User = Depends(require_admin),
    db: Db = Depends(get_db),
) -> dict[str, object]:
    rows = db[AUDIT].find().sort([("at", DESCENDING), ("_id", DESCENDING)]).limit(limit)
    return {
        "events": [
            {
                "id": str(e["_id"]),
                "at": _iso(e.get("at")),
                "event": e.get("event", ""),
                "email": e.get("email", ""),
                "user_id": e.get("user_id"),
                "actor_id": e.get("actor_id"),
                "ip": e.get("ip", ""),
                "detail": e.get("detail", ""),
            }
            for e in rows
        ]
    }
