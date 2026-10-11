"""HTTP hardening: security headers and a custom-header check on state-changing requests."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import get_settings

REQUESTED_WITH = "X-Requested-With"
REQUESTED_WITH_VALUE = "SpeechArena"
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    - State-changing /api requests must send `X-Requested-With: SpeechArena`. A custom header
      forces a CORS preflight, which only allowed origins pass, so other sites can't submit
      forms or fetches to the API (this also covers sign-in and registration, which have no
      session or CSRF token yet).
    - Adds standard security headers to every response.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if (
            request.method in UNSAFE
            and request.url.path.startswith("/api/")
            and request.headers.get(REQUESTED_WITH) != REQUESTED_WITH_VALUE
        ):
            return JSONResponse({"detail": "Request rejected: missing X-Requested-With header."}, status_code=403)

        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=()")
        path = request.url.path
        if path.startswith(("/api/auth", "/api/admin", "/api/privacy")):
            response.headers["Cache-Control"] = "no-store"
        if path.startswith("/api/"):
            # The API returns data only, never pages: nothing may load or frame it.
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if get_settings().cookie_secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
