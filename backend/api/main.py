import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# All deployment settings (database URLs, allowed origins, host) come from .env in the
# project root. Copy .env.example to .env and fill it in; nothing has a built-in default.
from backend.env import flag, load_env, optional, require

load_env()

# Hugging Face libraries send usage telemetry by default; models are still downloaded on
# first use, but no usage pings are sent.
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", optional("HF_HUB_DISABLE_TELEMETRY", "1"))

try:
    from .routers import analysis, gamification
except (ImportError, ValueError):
    from backend.api.routers import analysis, gamification

from backend.auth import SecurityMiddleware, admin_router, auth_router, init_db
from backend.auth.config import get_settings
from backend.auth.db import ping as mongo_ping
from backend.leaderboard import leaderboard_router
from backend.privacy import privacy_router
from backend.privacy.retention import maybe_purge
from backend.redis_client import ping as redis_ping

# The interactive /docs pages load scripts from a third-party CDN, so they are off unless
# explicitly enabled for local development (ENABLE_DOCS=1 in .env).
_docs = flag("ENABLE_DOCS")
app = FastAPI(
    title="Speech Arena API",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

_auth = get_settings()
maybe_purge(init_db())  # connect to MongoDB, create indexes, apply retention limits at start-up

# Credentials (the session cookie) are only accepted from the configured origins.
# A wildcard origin with credentials would let any website act as the signed-in user.
app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_auth.allowed_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Requested-With"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(privacy_router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(gamification.router, prefix="/api")
app.include_router(leaderboard_router, prefix="/api")

@app.get("/api/health")
def health_check() -> dict[str, object]:
    # Both are required: MongoDB holds accounts, Redis holds sign-in sessions and leaderboards.
    mongo, redis_up = mongo_ping(), redis_ping()
    return {
        "status": "ok" if mongo and redis_up else "degraded",
        "services": {"mongodb": "up" if mongo else "down", "redis": "up" if redis_up else "down"},
    }

if __name__ == "__main__":
    import uvicorn
    # API_HOST=127.0.0.1 listens on this machine only (0.0.0.0 exposes the API to
    # everyone on the same network).
    host = require("API_HOST")
    port = int(require("API_PORT"))
    print(f"[*] Starting Speech Arena Backend on http://{host}:{port} ...")
    uvicorn.run("main:app", host=host, port=port, reload=True)
