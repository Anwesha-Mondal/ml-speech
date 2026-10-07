from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import analysis, gamification

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
