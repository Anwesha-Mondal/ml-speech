from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
import uuid
import asyncio
import pandas as pd
from typing import Dict, Any

from packages.speech_arena.scoring.contrastive import compute_word_deltas
from packages.speech_arena.scoring.detectors import run_detectors
from packages.speech_arena.scoring.engine import compute_score
from packages.speech_arena.scoring.explain import render_explanation

router = APIRouter()

class JobResponse(BaseModel):
    job_id: str
    status: str

# In-memory job store for P12 MVP
job_store: Dict[str, Any] = {}

def process_audio_pipeline(job_id: str, mode: str):
    # Simulate the heavy MMS_FA alignment and feature extraction (5-15s)
    # Using a sleep inside an async background task isn't truly async if it's blocking CPU, 
    # but BackgroundTasks run in a separate threadpool in FastAPI.
    import time
    time.sleep(5)
    
    # Real pipeline mock logic (using the actual P6 engine)
    try:
        ref_df = pd.DataFrame([
            {'word': 'four', 'start': 0.0, 'end': 0.4, 'local_rate': 2.0, 'following_pause': 0.0, 'st_range': 4.0, 'db_mean': -5.0},
            {'word': 'score', 'start': 0.4, 'end': 0.8, 'local_rate': 2.2, 'following_pause': 0.1, 'st_range': 3.5, 'db_mean': -4.0},
            {'word': 'and', 'start': 0.9, 'end': 1.1, 'local_rate': 1.8, 'following_pause': 0.0, 'st_range': 2.0, 'db_mean': -6.0},
            {'word': 'seven', 'start': 1.1, 'end': 1.6, 'local_rate': 2.5, 'following_pause': 0.0, 'st_range': 5.0, 'db_mean': -3.0},
            {'word': 'years', 'start': 1.6, 'end': 2.2, 'local_rate': 2.0, 'following_pause': 0.5, 'st_range': 3.0, 'db_mean': -5.0}
        ])
        
        part_df = pd.DataFrame([
            {'word': 'four', 'start': 0.0, 'end': 0.3, 'local_rate': 3.0, 'following_pause': 0.0, 'st_range': 1.0, 'db_mean': -15.0},
            {'word': 'score', 'start': 0.3, 'end': 0.6, 'local_rate': 3.5, 'following_pause': 0.0, 'st_range': 1.5, 'db_mean': -14.0},
            {'word': 'and', 'start': 0.6, 'end': 0.8, 'local_rate': 3.0, 'following_pause': 0.0, 'st_range': 1.0, 'db_mean': -16.0},
            {'word': 'seven', 'start': 0.8, 'end': 1.2, 'local_rate': 3.2, 'following_pause': 0.0, 'st_range': 2.0, 'db_mean': -12.0},
            {'word': 'years', 'start': 1.2, 'end': 1.8, 'local_rate': 2.8, 'following_pause': 0.0, 'st_range': 1.5, 'db_mean': -15.0}
        ])
        
        deltas = compute_word_deltas(ref_df, part_df)
        flaws = run_detectors(deltas)
        score = compute_score(flaws)
        
        formatted_flaws = []
        for f in flaws:
            formatted_flaws.append({
                "type": f.type,
                "start_time": f.start_time,
                "end_time": f.end_time,
                "penalty": f.penalty,
                "explanation": render_explanation(f)
            })
            
        job_store[job_id] = {
            "status": "completed",
            "result": {
                "mode": mode,
                "score": {
                    "total": score.total,
                    "buckets": score.buckets
                },
                "flaws": formatted_flaws
            }
        }
    except Exception as e:
        job_store[job_id] = {
            "status": "error",
            "message": str(e)
        }

@router.post("/analyze", response_model=JobResponse)
async def create_analysis(
    background_tasks: BackgroundTasks,
    reference: UploadFile = File(None),
    participant: UploadFile = File(...),
    transcript: str = Form(...),
    mode: str = Form("sandbox")
):
    job_id = str(uuid.uuid4())
    job_store[job_id] = {"status": "processing"}
    background_tasks.add_task(process_audio_pipeline, job_id, mode)
    return {"job_id": job_id, "status": "processing"}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in job_store:
        return {"job_id": job_id, "status": "not_found"}
    
    data = job_store[job_id]
    if data["status"] == "processing":
        return {"job_id": job_id, "status": "processing"}
    
    return {
        "job_id": job_id,
        **data
    }
