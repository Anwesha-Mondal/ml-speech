from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
import uuid
import os
import re
import traceback
import sys
import time
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

from backend.auth import require_user
from backend.auth.db import User
from backend.api.uploads import per_user_limit, read_audio
from backend.privacy.config import get_privacy_settings
from packages.speech_arena.scoring.contrastive import compute_word_deltas
from packages.speech_arena.scoring.detectors import run_detectors
from packages.speech_arena.scoring.engine import compute_score
from packages.speech_arena.scoring.explain import render_explanation

router = APIRouter()

class JobResponse(BaseModel):
    job_id: str
    status: str

# In-memory job store for analysis runs. Results expire after
# retention.job_results_minutes (configs/privacy/privacy.yaml); recordings are never stored.
job_store: Dict[str, Any] = {}

PROMPT_ID_RE = re.compile(r"^[a-z0-9-]{1,64}$")
ALLOWED_MODES = {"sandbox", "interviewer", "news_anchor", "storytelling", "public_speaking"}
MAX_TRANSCRIPT_CHARS = 5000


def _expire_jobs() -> None:
    ttl = get_privacy_settings().job_results_minutes * 60
    now = time.time()
    for jid in [j for j, d in job_store.items() if now - d.get("created_at", now) > ttl]:
        job_store.pop(jid, None)


def forget_user_jobs(user_id: str) -> None:
    """Drop every result held for a user (called when the account is deleted)."""
    for jid in [j for j, d in job_store.items() if d.get("owner_id") == user_id]:
        job_store.pop(jid, None)

def process_audio_pipeline(
    job_id: str,
    part_bytes: bytes,
    ref_bytes: Optional[bytes],
    mode: str,
    transcript: str = "",
    prompt_id: str = "",
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
        # Imported here, not at module load, so the API (sign-in, accounts, other pages)
        # still starts when the ML stack or model code is unavailable.
        from ml.inference.predict import SpeechFlawPredictor

        predictor = SpeechFlawPredictor.get_instance()
        ml_result = predictor.predict_audio(
            audio_input=part_bytes,
            transcript=transcript,
            mode=mode
        )

        job_store[job_id] = {
            **job_store.get(job_id, {}),
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
        if prompt_id:
            # Ranked only for opted-in users on a leaderboard passage (see backend/leaderboard).
            from backend.leaderboard.router import submit_result

            owner = job_store[job_id].get("owner_id", "")
            try:
                board = submit_result(owner, prompt_id, float(ml_result["score"]["total"]))
            except Exception:  # noqa: BLE001 - a ranking problem must not discard the analysis
                traceback.print_exc()
                board = {"eligible": True, "submitted": False, "reason": "The leaderboard is unavailable right now."}
            job_store[job_id]["result"]["leaderboard"] = board
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Exception in process_audio_pipeline: {e}")
        
        job_store[job_id] = {
            **job_store.get(job_id, {}),
            "status": "error",
            # Details stay in the server log; the user gets the error type and a hint only.
            "message": f"The analysis failed on the server ({type(e).__name__}). Make sure the backend runs with all ML dependencies installed (`uv run uvicorn backend.api.main:app`)."
        }

@router.post("/analyze", response_model=JobResponse)
async def create_analysis(
    background_tasks: BackgroundTasks,
    reference: UploadFile = File(None),
    participant: UploadFile = File(...),
    transcript: str = Form(""),
    mode: str = Form("sandbox"),
    prompt_id: str = Form("", max_length=64),
    user: User = Depends(require_user),
):
    cfg = get_privacy_settings()
    per_user_limit("analyze", user.id, cfg.analyze_per_hour)
    if mode not in ALLOWED_MODES:
        raise HTTPException(422, "Unknown practice mode.")
    if len(transcript) > MAX_TRANSCRIPT_CHARS:
        raise HTTPException(422, f"Keep the transcript under {MAX_TRANSCRIPT_CHARS} characters.")
    if prompt_id and not PROMPT_ID_RE.match(prompt_id):
        raise HTTPException(422, "Unknown reference passage.")

    # Read (bounded and type-checked) before creating the job, so a rejected upload leaves nothing behind.
    part_bytes = await read_audio(participant, "Your recording")
    ref_bytes = await read_audio(reference, "The reference recording") if reference and reference.filename else None

    _expire_jobs()
    job_id = str(uuid.uuid4())
    # owner_id: only the user who started a job can read its result.
    job_store[job_id] = {"status": "processing", "owner_id": user.id, "created_at": time.time()}

    background_tasks.add_task(
        process_audio_pipeline,
        job_id,
        part_bytes,
        ref_bytes,
        mode,
        transcript,
        prompt_id,
    )
    return {"job_id": job_id, "status": "processing"}

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, user: User = Depends(require_user)):
    _expire_jobs()
    data = job_store.get(job_id)
    # Another user's job looks exactly like a missing one. Admins get no exception:
    # results describe a person's voice, and running the service doesn't require reading them.
    if data is None or data.get("owner_id") != user.id:
        return {"job_id": job_id, "status": "not_found"}

    if data["status"] == "processing":
        return {"job_id": job_id, "status": "processing"}

    public = {k: v for k, v in data.items() if k not in ("owner_id", "created_at")}
    return {
        "job_id": job_id,
        **public
    }

@router.post("/generate-script")
async def generate_script(user: User = Depends(require_user)):
    global _text_pipeline
    per_user_limit("generate", user.id, get_privacy_settings().generate_per_hour)

    if pipeline is None:
        return {"transcript": "transformers library is not installed."}

    try:
        if _text_pipeline is None:
            _text_pipeline = pipeline("text-generation", model="distilgpt2")
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
async def transcribe_audio(file: UploadFile = File(...), user: User = Depends(require_user)):
    global _asr_pipeline
    per_user_limit("transcribe", user.id, get_privacy_settings().transcribe_per_hour)
    audio = await read_audio(file, "Your recording")

    if pipeline is None:
        return {"transcript": "transformers library is not installed."}

    import tempfile

    temp_path = None
    try:
        if _asr_pipeline is None:
            _asr_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en")

        # Whisper reads from a file; the recording exists on disk only for this call.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(audio)
            temp_path = temp_audio.name

        result = _asr_pipeline(temp_path)
        return {"transcript": result["text"].strip()}
    except Exception:
        import traceback
        traceback.print_exc()
        return {"transcript": "", "error": "Transcription failed on the server."}
    finally:
        # Always delete the recording, including when transcription fails.
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
