"""Account endpoints: register, sign in/out, profile, password change, sessions."""

from __future__ import annotations

import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .config import AuthSettings, get_settings
from .db import USERS, User, get_db, utcnow
from .passwords import check_policy, dummy_verify, hash_password, needs_rehash, verify_password
from .ratelimit import limiter
from .sessions import (
    AuthSession,
    Db,
    Principal,
    audit,
    aware,
    clear_cookie,
    client_ip,
    create_session,
    get_session_by_id,
    get_user,
    get_user_by_email,
    list_user_sessions,
    optional_principal,
    require_principal,
    revoke_session,
    revoke_user_sessions,
)

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
GENERIC_LOGIN_ERROR = "Email or password is incorrect."


# ---------- schemas ----------
class RegisterIn(BaseModel):
    email: str = Field(max_length=254)
    display_name: str = Field(min_length=1, max_length=64)
    password: str = Field(max_length=1024)
    # Must both be true: agreement to the Terms and Privacy Policy, and the minimum-age confirmation.
    accept_terms: bool = False
    confirm_age: bool = False


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=1024)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=1024)
    new_password: str = Field(max_length=1024)


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)


class PolicyIn(BaseModel):
    password: str = Field(max_length=1024)
    email: str = Field(default="", max_length=254)
    display_name: str = Field(default="", max_length=64)


def _iso(dt: datetime | None) -> str | None:
    a = aware(dt)
    return a.isoformat() if a else None


def user_out(u: User) -> dict[str, object]:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "role": u.role,
        "created_at": _iso(u.created_at),
        "password_changed_at": _iso(u.password_changed_at),
        "leaderboard_opt_in": u.leaderboard_opt_in,
    }


def session_payload(u: User, s: AuthSession, db: Db) -> dict[str, object]:
    from backend.privacy.consent import outstanding  # deferred: privacy imports auth

    return {
        "user": user_out(u),
        "csrf_token": s.csrf_token,
        "session_id": s.id,
        # Required documents (terms, privacy) whose current version the user hasn't accepted.
        "consent_needed": outstanding(db, u.id),
    }


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _rate_limit(key: str, limit: int, window_s: float) -> None:
    wait = limiter.hit(key, limit, window_s)
    if wait > 0:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many attempts. Try again in {int(wait) + 1} seconds.",
            headers={"Retry-After": str(int(wait) + 1)},
        )


def count_admins(db: Db) -> int:
    return db[USERS].count_documents({"role": "admin", "is_active": True})


# ---------- endpoints ----------
@router.get("/policy")
def password_policy(cfg: AuthSettings = Depends(get_settings)) -> dict[str, object]:
    return {
        "min_length": cfg.pw_min_length,
        "max_length": cfg.pw_max_length,
        "registration_open": cfg.registration_open,
        "lockout_attempts": cfg.max_failed_attempts,
        "lock_minutes": cfg.lock_minutes,
    }


@router.post("/policy/check")
def policy_check(body: PolicyIn, request: Request, cfg: AuthSettings = Depends(get_settings)) -> dict[str, object]:
    _rate_limit(f"policy:{client_ip(request)}", 120, 60)
    res = check_policy(body.password, cfg, body.email, body.display_name)
    return {"ok": res.ok, "problems": res.problems}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterIn,
    request: Request,
    response: Response,
    db: Db = Depends(get_db),
    cfg: AuthSettings = Depends(get_settings),
) -> dict[str, object]:
    if not cfg.registration_open:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is closed. Ask an administrator for an account.")
    _rate_limit(f"register:{client_ip(request)}", cfg.register_per_hour, 3600)

    email = normalize_email(body.email)
    name = body.display_name.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if not name:
        raise HTTPException(422, "Enter a display name.")
    if not body.accept_terms or not body.confirm_age:
        raise HTTPException(422, "Accept the Terms and Privacy Policy and confirm your age to create an account.")
    policy = check_policy(body.password, cfg, email, name)
    if not policy.ok:
        raise HTTPException(422, " ".join(policy.problems))

    user = User(email=email, display_name=name, password_hash=hash_password(body.password, cfg), last_login_at=utcnow())
    try:
        # The unique index on email settles races between two simultaneous sign-ups.
        db[USERS].insert_one(user.to_doc())
    except DuplicateKeyError:
        # Registration necessarily reveals that the email is taken; the rate limit above bounds probing.
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Sign in instead.")
    sess = create_session(user, request, response, cfg)
    from backend.privacy.consent import record_signup_acceptance

    record_signup_acceptance(db, user.id)
    audit(db, "register", request=request, user=user)
    return session_payload(user, sess, db)


@router.post("/login")
def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: Db = Depends(get_db),
    cfg: AuthSettings = Depends(get_settings),
) -> dict[str, object]:
    ip = client_ip(request)
    _rate_limit(f"login:{ip}", cfg.login_per_minute, 60)
    email = normalize_email(body.email)
    user = get_user_by_email(db, email)

    if user is None:
        dummy_verify(body.password, cfg)
        # Unknown emails "lock" after the same number of tries as real accounts, so the
        # 423 response can't be used to tell which emails are registered.
        if limiter.hit(f"unknown-login:{email}", cfg.max_failed_attempts, cfg.lock_minutes * 60) > 0:
            audit(db, "login_locked", request=request, email=email, detail="unknown email")
            raise HTTPException(
                status.HTTP_423_LOCKED,
                f"Too many failed attempts. This account is locked for about {cfg.lock_minutes} more minute(s).",
            )
        audit(db, "login_failed", request=request, email=email, detail="unknown email")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GENERIC_LOGIN_ERROR)

    now = utcnow()
    locked_until = aware(user.locked_until)
    if locked_until and locked_until > now:
        dummy_verify(body.password, cfg)
        audit(db, "login_locked", request=request, user=user)
        minutes = max(1, int((locked_until - now).total_seconds() // 60) + 1)
        raise HTTPException(
            status.HTTP_423_LOCKED,
            f"Too many failed attempts. This account is locked for about {minutes} more minute(s).",
        )

    if not verify_password(body.password, user.password_hash):
        # Atomic increment: concurrent wrong guesses can't slip past the limit.
        doc = db[USERS].find_one_and_update(
            {"_id": user.id}, {"$inc": {"failed_attempts": 1}}, return_document=ReturnDocument.AFTER
        )
        attempts = int(doc["failed_attempts"]) if doc else 1
        detail = f"attempt {attempts}"
        if attempts >= cfg.max_failed_attempts:
            db[USERS].update_one(
                {"_id": user.id},
                {"$set": {"locked_until": now + timedelta(minutes=cfg.lock_minutes), "failed_attempts": 0}},
            )
            detail += "; account locked"
        audit(db, "login_failed", request=request, user=user, detail=detail)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GENERIC_LOGIN_ERROR)

    if not user.is_active:
        audit(db, "login_disabled", request=request, user=user)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled. Contact an administrator.")

    # Session first: if the session store is down this fails with 503 before anything changes.
    sess = create_session(user, request, response, cfg)
    updates: dict[str, object] = {"failed_attempts": 0, "locked_until": None, "last_login_at": now}
    if needs_rehash(user.password_hash, cfg):
        updates["password_hash"] = hash_password(body.password, cfg)
    db[USERS].update_one({"_id": user.id}, {"$set": updates})
    audit(db, "login", request=request, user=user)
    from backend.privacy.retention import maybe_purge

    maybe_purge(db)
    return session_payload(user, sess, db)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    p: Principal = Depends(require_principal),
    db: Db = Depends(get_db),
    cfg: AuthSettings = Depends(get_settings),
) -> dict[str, bool]:
    revoke_session(p.session.id)
    audit(db, "logout", request=request, user=p.user)
    clear_cookie(response, cfg)
    return {"ok": True}


@router.get("/me", response_model=None)
def me(
    response: Response,
    p: Principal | None = Depends(optional_principal),
    cfg: AuthSettings = Depends(get_settings),
    db: Db = Depends(get_db),
) -> dict[str, object] | JSONResponse:
    if p is None:
        # Return (not raise) so the expired cookie is cleared on the same response.
        resp = JSONResponse({"detail": "Not signed in."}, status_code=status.HTTP_401_UNAUTHORIZED)
        resp.headers["Cache-Control"] = "no-store"
        clear_cookie(resp, cfg)
        return resp
    response.headers["Cache-Control"] = "no-store"
    return session_payload(p.user, p.session, db)


@router.patch("/me")
def update_profile(
    body: ProfileIn,
    request: Request,
    p: Principal = Depends(require_principal),
    db: Db = Depends(get_db),
) -> dict[str, object]:
    name = body.display_name.strip()
    if not name:
        raise HTTPException(422, "Enter a display name.")
    db[USERS].update_one({"_id": p.user.id}, {"$set": {"display_name": name}})
    audit(db, "profile_updated", request=request, user=p.user)
    user = get_user(db, p.user.id)
    assert user is not None
    return {"user": user_out(user)}


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    request: Request,
    p: Principal = Depends(require_principal),
    db: Db = Depends(get_db),
    cfg: AuthSettings = Depends(get_settings),
) -> dict[str, object]:
    _rate_limit(f"pwchange:{p.user.id}", cfg.max_failed_attempts, 15 * 60)
    user = get_user(db, p.user.id)
    assert user is not None
    if not verify_password(body.current_password, user.password_hash):
        audit(db, "password_change_failed", request=request, user=user)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is incorrect.")
    if body.new_password == body.current_password:
        raise HTTPException(422, "Choose a password you haven't just used.")
    policy = check_policy(body.new_password, cfg, user.email, user.display_name)
    if not policy.ok:
        raise HTTPException(422, " ".join(policy.problems))

    db[USERS].update_one(
        {"_id": user.id},
        {"$set": {"password_hash": hash_password(body.new_password, cfg), "password_changed_at": utcnow()}},
    )
    revoked = revoke_user_sessions(user.id, except_id=p.session.id)
    audit(db, "password_changed", request=request, user=user, detail=f"revoked {revoked} other session(s)")
    return {"ok": True, "revoked_sessions": revoked}


@router.get("/sessions")
def list_sessions(p: Principal = Depends(require_principal)) -> dict[str, object]:
    out = []
    for s in list_user_sessions(p.user.id):
        out.append(
            {
                "id": s.id,
                "current": s.id == p.session.id,
                "created_at": _iso(s.created_at),
                "last_seen_at": _iso(s.last_seen_at),
                "ip": s.ip,
                "user_agent": s.user_agent,
            }
        )
    return {"sessions": out}


@router.delete("/sessions/{session_id}")
def revoke_one_session(
    session_id: str,
    request: Request,
    p: Principal = Depends(require_principal),
    db: Db = Depends(get_db),
) -> dict[str, bool]:
    s = get_session_by_id(session_id)
    # Same response for "not yours" and "doesn't exist": don't reveal other users' session IDs.
    if s is None or s.user_id != p.user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found.")
    if session_id == p.session.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Use Sign out to end the current session.")
    revoke_session(session_id)
    audit(db, "session_revoked", request=request, user=p.user)
    return {"ok": True}


@router.post("/logout-others")
def logout_others(
    request: Request, p: Principal = Depends(require_principal), db: Db = Depends(get_db)
) -> dict[str, object]:
    n = revoke_user_sessions(p.user.id, except_id=p.session.id)
    audit(db, "sessions_revoked", request=request, user=p.user, detail=f"{n} session(s)")
    return {"ok": True, "revoked_sessions": n}
