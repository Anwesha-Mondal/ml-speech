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
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

import warnings

warnings.filterwarnings("ignore", category=UserWarning, module="transformers")
warnings.filterwarnings("ignore", category=FutureWarning, module="transformers")
try:
    from transformers import logging as hf_logging
    hf_logging.set_verbosity_error()
except ImportError:
    pass

try:
    from .routers import analysis, gamification
except (ImportError, ValueError):
    from backend.api.routers import analysis, gamification

from backend.auth import SecurityMiddleware, admin_router, auth_router, init_db
from backend.auth.config import get_settings
from backend.auth.db import ping as mongo_ping
from backend.leaderboard import leaderboard_router
from backend.modes import modes_router
from backend.privacy import privacy_router
from backend.privacy.retention import maybe_purge
from backend.rag import rag_router

_docs = flag("ENABLE_DOCS")
app = FastAPI(
    title="Speech Guru API",
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

_auth = get_settings()
maybe_purge(init_db())
app.add_middleware(SecurityMiddleware)
_cors_regex = optional("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_auth.allowed_origins),
    allow_origin_regex=_cors_regex if _cors_regex else r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Requested-With", "Authorization", "Accept", "Origin"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(privacy_router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(gamification.router, prefix="/api")
app.include_router(leaderboard_router, prefix="/api")
app.include_router(rag_router, prefix="/api")
app.include_router(modes_router, prefix="/api")

@app.get("/api/health")
def health_check() -> dict[str, object]:
    mongo = mongo_ping()
    return {
        "status": "ok" if mongo else "degraded",
        "services": {"mongodb": "up" if mongo else "down"},
    }

if __name__ == "__main__":
    import uvicorn
    host = optional("API_HOST", "0.0.0.0")
    port = int(optional("PORT", optional("API_PORT", "8000")))
    print(f"[*] Starting Speech Guru Backend on http://{host}:{port} ...")
    uvicorn.run("backend.api.main:app", host=host, port=port, reload=True)
