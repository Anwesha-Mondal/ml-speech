from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
import uuid

router = APIRouter()

class JobResponse(BaseModel):
    job_id: str
    status: str

@router.post("/analyze", response_model=JobResponse)
async def create_analysis(
    reference: UploadFile = File(None),
    participant: UploadFile = File(...),
    transcript: str = Form(...),
    mode: str = Form("sandbox")
):
    job_id = str(uuid.uuid4())
    return {"job_id": job_id, "status": "processing"}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, mode: str = "sandbox"):
    if mode == "news_anchor":
        score = {"total": 92, "buckets": {"articulation": 5, "pitch_stability": 3}}
        flaws = [
            {"type": "up_talk", "start_time": 8.5, "end_time": 9.2, "penalty": 3, "explanation": "Authoritative pitch lost; ending sounded like a question."},
            {"type": "pacing_irregular", "start_time": 12.0, "end_time": 13.5, "penalty": 5, "explanation": "Pacing fluctuated compared to steady teleprompter read."}
        ]
    elif mode == "storytelling":
        score = {"total": 88, "buckets": {"dynamic_range": 8, "dramatic_pause": 4}}
        flaws = [
            {"type": "monotone", "start_time": 15.0, "end_time": 20.0, "penalty": 8, "explanation": "Energy and pitch variance too low for narrative delivery."},
            {"type": "rushed_climax", "start_time": 35.0, "end_time": 38.0, "penalty": 4, "explanation": "Missed opportunity for a deliberate dramatic pause."}
        ]
    elif mode == "interviewer":
        score = {"total": 78, "buckets": {"hesitation": 15, "clarity": 7}}
        flaws = [
            {"type": "filler_words", "start_time": 4.1, "end_time": 5.5, "penalty": 15, "explanation": "Excessive hesitation ('um', 'uh') compared to professional baseline."},
            {"type": "mumbled", "start_time": 18.0, "end_time": 19.5, "penalty": 7, "explanation": "Clarity dropped during rapid response."}
        ]
    else:
        score = {"total": 85, "buckets": {"pacing": 10, "energy": 5}}
        flaws = [
            {"type": "pacing_fast", "start_time": 2.5, "end_time": 3.1, "penalty": 10, "explanation": "You spoke 30% faster than the reference here."},
            {"type": "energy_low", "start_time": 5.0, "end_time": 6.2, "penalty": 5, "explanation": "Your energy dropped significantly here."}
        ]

    return {
        "job_id": job_id,
        "status": "completed",
        "result": {
            "mode": mode,
            "score": score,
            "flaws": flaws
        }
    }
