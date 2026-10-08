import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from .routers import analysis, gamification
except (ImportError, ValueError):
    from backend.api.routers import analysis, gamification

app = FastAPI(title="Speech Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, prefix="/api")
app.include_router(gamification.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("[*] Starting Speech Arena Backend on http://localhost:8000 ...")
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)
