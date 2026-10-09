from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
import uuid
import os
import sys
import pandas as pd
from typing import Dict, Any, Optional

try:
    from transformers import pipeline
except ImportError:
    pipeline = None

_text_pipeline = None

# Ensure project root is in path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.inference.predict import SpeechFlawPredictor
from packages.speech_arena.scoring.contrastive import compute_word_deltas
from packages.speech_arena.scoring.detectors import run_detectors
from packages.speech_arena.scoring.engine import compute_score
from packages.speech_arena.scoring.explain import render_explanation

router = APIRouter()

class JobResponse(BaseModel):
    job_id: str
    status: str

# In-memory job store for analysis runs
job_store: Dict[str, Any] = {}

def process_audio_pipeline(
    job_id: str,
    part_bytes: bytes,
    ref_bytes: Optional[bytes],
    mode: str,
    transcript: str = ""
):
    """
    Executes neural Wav2Vec2 + acoustic feature flaw detection
    and populates the job_store with structured results.
    """
    try:
        if not transcript:
            transcript = "Speech test recording"

        # Check if participant audio data was received
        if not part_bytes:
            raise ValueError("Participant audio file is empty.")

        # Run neural inference
        predictor = SpeechFlawPredictor.get_instance()
        ml_result = predictor.predict_audio(
            audio_input=part_bytes,
            transcript=transcript,
            mode=mode
        )

        job_store[job_id] = {
            "status": "completed",
            "result": {
                "mode": ml_result["mode"],
                "score": {
                    "total": ml_result["score"]["total"],
                    "buckets": ml_result["score"]["buckets"]
                },
                "flaws": ml_result["flaws"],
                "words": ml_result.get("words", []),
                "duration": ml_result.get("duration", 0.0),
                "contours": ml_result.get("contours", None)
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Exception in process_audio_pipeline: {e}")
        
        job_store[job_id] = {
            "status": "error",
            "message": f"Pipeline analysis error: {str(e)}\n\nMake sure you run the backend using `uv run uvicorn backend.api.main:app` so all dependencies (like librosa and soundfile) are loaded!"
        }

@router.post("/analyze", response_model=JobResponse)
async def create_analysis(
    background_tasks: BackgroundTasks,
    reference: UploadFile = File(None),
    participant: UploadFile = File(...),
    transcript: str = Form(""),
    mode: str = Form("sandbox")
):
    job_id = str(uuid.uuid4())
    job_store[job_id] = {"status": "processing"}

    # Read uploaded file bytes asynchronously before passing to background task
    part_bytes = await participant.read()
    ref_bytes = await reference.read() if reference else None

    background_tasks.add_task(
        process_audio_pipeline,
        job_id,
        part_bytes,
        ref_bytes,
        mode,
        transcript
    )
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

@router.post("/generate-script")
async def generate_script():
    global _text_pipeline
    
    if pipeline is None:
        return {"transcript": "transformers library is not installed."}

    if _text_pipeline is None:
        _text_pipeline = pipeline("text-generation", model="distilgpt2")
        
    try:
        import random
        prompts = [
            "Today we will discuss the importance of communication in the modern workplace.",
            "As we look towards the future of technology, one thing becomes clear:",
            "The greatest challenge facing our industry right now is",
            "Welcome everyone. I'm excited to share some new insights regarding",
            "Let me tell you a story about a time when everything seemed to go wrong, but"
        ]
        prompt = random.choice(prompts)
        result = _text_pipeline(prompt, max_new_tokens=40, do_sample=True, temperature=0.7, repetition_penalty=1.2)
        generated_text = result[0]["generated_text"].strip()
        # Clean up any trailing incomplete sentences
        if not generated_text.endswith((".", "!", "?")):
            last_punc = max(generated_text.rfind('.'), generated_text.rfind('!'), generated_text.rfind('?'))
            if last_punc > 0:
                generated_text = generated_text[:last_punc+1]
                
        return {"transcript": generated_text}
    except Exception as e:
        print(f"Generation error: {e}")
        return {"transcript": "Error generating practice script."}

_asr_pipeline = None

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    global _asr_pipeline
    
    if pipeline is None:
        return {"transcript": "transformers library is not installed."}

    if _asr_pipeline is None:
        _asr_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")
        
    try:
        import tempfile
        import shutil
        
        # Save upload to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            shutil.copyfileobj(file.file, temp_audio)
            temp_path = temp_audio.name
            
        result = _asr_pipeline(temp_path)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return {"transcript": result["text"].strip()}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"transcript": f"Error transcribing audio: {str(e)}"}


