"""Authentication and authorization for the Speech Arena API.

Server-side sessions in an HttpOnly cookie (only the token's SHA-256 is stored),
scrypt password hashes, CSRF tokens, per-account lockout, per-IP rate limits
and user/admin roles. Settings live in configs/auth/auth.yaml.
"""

from .admin import router as admin_router
from .db import init_db
from .router import router as auth_router
from .security import SecurityMiddleware
from .sessions import Principal, require_admin, require_principal, require_user

__all__ = [
    "Principal",
    "SecurityMiddleware",
    "admin_router",
    "auth_router",
    "init_db",
    "require_admin",
    "require_principal",
    "require_user",
]
