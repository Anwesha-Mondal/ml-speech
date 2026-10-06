from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import uuid

app = FastAPI(title="Speech Arena API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JobResponse(BaseModel):
    job_id: str
    status: str

@app.post("/api/analyze", response_model=JobResponse)
async def create_analysis(
    reference: UploadFile = File(...),
    participant: UploadFile = File(...),
    transcript: str = Form(...)
):
    # Mocking job creation
    job_id = str(uuid.uuid4())
    return {"job_id": job_id, "status": "processing"}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    # Mocking processing delay then success
    return {
        "job_id": job_id,
        "status": "completed",
        "result": {
            "score": {"total": 85, "buckets": {"pacing": 10, "energy": 5}},
            "flaws": [
                {
                    "type": "pacing_fast",
                    "start_time": 2.5,
                    "end_time": 3.1,
                    "penalty": 10,
                    "explanation": "You spoke 30% faster than the reference here."
                },
                {
                    "type": "energy_low",
                    "start_time": 5.0,
                    "end_time": 6.2,
                    "penalty": 5,
                    "explanation": "Your energy dropped significantly here."
                }
            ]
        }
    }

@app.get("/api/library")
async def list_library():
    # Return dummy library items
    return {
        "items": [
            {"id": "T1_Gettysburg", "name": "The Gettysburg Address"},
            {"id": "T2_Inaugural", "name": "JFK Inaugural Address"}
        ]
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
