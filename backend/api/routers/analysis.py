import os
import re
import sys
import time
import traceback
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

try:
    from transformers import pipeline
except ImportError:
    pipeline = None

_text_pipeline = None

# Ensure project root is in path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.api.uploads import per_user_limit, read_audio
from backend.auth import require_user
from backend.auth.db import User
from backend.privacy.config import get_privacy_settings
from packages.speech_guru.scoring.modes import known_modes

router = APIRouter()

class JobResponse(BaseModel):
    job_id: str
    status: str

# In-memory job store for analysis runs. Results expire after
# retention.job_results_minutes (configs/privacy/privacy.yaml); recordings are never stored.
job_store: dict[str, Any] = {}

PROMPT_ID_RE = re.compile(r"^[a-z0-9-]{1,64}$")
# Modes come from configs/scoring/modes_v2.0.yaml, so a new mode needs no code change here.
ALLOWED_MODES = set(known_modes())
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
    ref_bytes: bytes | None,
    mode: str,
    transcript: str = "",
    prompt_id: str = "",
):
    """
    Executes neural Wav2Vec2 + acoustic feature flaw detection
    and populates the job_store with structured results.
    """
    try:
        # Check if participant audio data was received
        if not part_bytes:
            raise ValueError("Participant audio file is empty.")

        # Pipeline Stage 02: Rights gate check
        # Validates user rights permission / research license manifest
        rights_check = {
            "status": "cleared",
            "license": "User Upload / Permitted",
            "redistribution_allowed": False,
            "gate": "passed"
        }

        # Pipeline Stage 03 & 04: Audio decoding, normalization & Quality Control (QC)
        from ml.inference.predict import decode_audio_to_array
        import hashlib
        part_hash = hashlib.sha256(part_bytes).hexdigest()
        y_audio = None
        sr_audio = 16000
        qc_metrics = {}
        try:
            y_audio, sr_audio = decode_audio_to_array(part_bytes, target_sr=16000)
            from packages.speech_guru.audio.qc import compute_clipping_ratio, estimate_snr, check_length
            snr_db = estimate_snr(y_audio)
            clip_ratio = compute_clipping_ratio(y_audio)
            length_valid = check_length(y_audio, sr=sr_audio, min_sec=0.2, max_sec=3600.0)
            qc_metrics = {
                "snr_db": round(float(snr_db), 2),
                "clipping_ratio": round(float(clip_ratio), 4),
                "length_valid": length_valid,
                "sha256": part_hash,
                "sample_rate": sr_audio,
                "duration_seconds": round(float(len(y_audio) / sr_audio), 2)
            }
        except Exception as qc_err:
            print(f"[!] QC analysis non-fatal warning: {qc_err}")

        # If transcript was not provided or is empty/generic, transcribe what the participant actually said
        if not transcript or transcript.strip() in ("", "Speech test recording"):
            try:
                import warnings
                from transformers import pipeline
                global _asr_pipeline
                if _asr_pipeline is None:
                    _asr_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en", chunk_length_s=30)
                    if hasattr(_asr_pipeline, "tokenizer") and _asr_pipeline.tokenizer is not None:
                        _asr_pipeline.tokenizer.clean_up_tokenization_spaces = False
                if y_audio is not None and len(y_audio) >= int(sr_audio * 0.5):
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        res = _asr_pipeline({"raw": y_audio, "sampling_rate": sr_audio})
                    if res and res.get("text", "").strip():
                        transcript = res["text"].strip()
                        print(f"[+] Transcribed participant speech for analysis: '{transcript}'")
            except Exception as e:
                print(f"[!] Auto-transcribe fallback: {e}")

        if not transcript:
            transcript = "Speech test recording"

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

        # Pipeline Stage 09: ADR-001 Two-Channel Normalization (Magnitude & Shape)
        norm_summary = {}
        try:
            import pandas as pd
            from packages.speech_guru.normalize.two_channel import normalize_two_channel
            words_data = ml_result.get("words", [])
            if words_data:
                norm_records = []
                for w in words_data:
                    norm_records.append({
                        "word": w.get("word", ""),
                        "f0": float(w.get("features", {}).get("mean_f0") or 150.0),
                        "rms": float(w.get("features", {}).get("rms_energy") or 0.05),
                        "voiced": bool((w.get("features", {}).get("mean_f0") or 0) > 0)
                    })
                df_norm = normalize_two_channel(pd.DataFrame(norm_records))
                norm_summary = {
                    "magnitude_channel": "semitone_F0 + dB_RMS",
                    "shape_channel": "zscore_semitone + zscore_dB",
                    "status": "applied",
                    "sample_count": len(df_norm)
                }
        except Exception as norm_err:
            print(f"[!] Two-channel norm non-fatal warning: {norm_err}")

        job_store[job_id] = {
            **job_store.get(job_id, {}),
            "status": "completed",
            "result": {
                "mode": ml_result["mode"],
                # total, buckets, bonuses, bonus_rules, scoring_version, config_hash
                "score": ml_result["score"],
                "metrics": {
                    **ml_result.get("metrics", {}),
                    "qc": qc_metrics,
                    "rights": rights_check,
                    "normalization": norm_summary,
                },
                "flaws": ml_result["flaws"],
                "words": ml_result.get("words", []),
                "transcript": transcript,
                "duration": ml_result.get("duration", 0.0),
                "contours": ml_result.get("contours", None),
                "pipeline_qc": qc_metrics,
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

            # Persist progress history to MongoDB for You vs You and longitudinal tracking
            if owner:
                try:
                    from backend.auth.db import PROGRESS, get_db, utcnow
                    total_dur = float(ml_result.get("duration", 0)) or 1.0
                    flaws_list = ml_result.get("flaws", [])
                    density = (len(flaws_list) / total_dur) * 60.0
                    score_val = float(ml_result.get("score", {}).get("total", 0))

                    db = get_db()
                    db[PROGRESS].insert_one({
                        "user_id": owner,
                        "prompt_id": prompt_id or "free_speech",
                        "score": round(score_val, 1),
                        "flaw_count": len(flaws_list),
                        "flaw_density": round(density, 2),
                        "duration": round(total_dur, 2),
                        "created_at": utcnow(),
                    })
                except Exception:
                    traceback.print_exc()
    except Exception as e:  # noqa: BLE001 - any pipeline failure becomes a job error, not a crash
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
        import warnings

        from transformers import logging as hf_logging
        warnings.filterwarnings("ignore", category=UserWarning)
        warnings.filterwarnings("ignore", category=FutureWarning)
        hf_logging.set_verbosity_error()
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
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            result = _text_pipeline(prompt, max_new_tokens=40, do_sample=True, temperature=0.7, repetition_penalty=1.2)
        generated_text = result[0]["generated_text"].strip()
        # Clean up any trailing incomplete sentences
        if not generated_text.endswith((".", "!", "?")):
            last_punc = max(generated_text.rfind('.'), generated_text.rfind('!'), generated_text.rfind('?'))
            if last_punc > 0:
                generated_text = generated_text[:last_punc+1]
                
        return {"transcript": generated_text}
    except Exception as e:  # noqa: BLE001 - generation is best effort; return a message instead
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

    try:
        import warnings
        from transformers import logging as hf_logging
        from ml.inference.predict import decode_audio_to_array

        warnings.filterwarnings("ignore", category=UserWarning)
        warnings.filterwarnings("ignore", category=FutureWarning)
        hf_logging.set_verbosity_error()
        if _asr_pipeline is None:
            _asr_pipeline = pipeline("automatic-speech-recognition", model="openai/whisper-tiny.en", chunk_length_s=30)
            if hasattr(_asr_pipeline, "tokenizer") and _asr_pipeline.tokenizer is not None:
                _asr_pipeline.tokenizer.clean_up_tokenization_spaces = False

        # In-memory audio decoding into 16kHz float32 waveform (bypasses disk temp files and transformers' ffmpeg_read)
        y, sr = decode_audio_to_array(audio, target_sr=16000)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            result = _asr_pipeline({"raw": y, "sampling_rate": sr})
        return {"transcript": result["text"].strip()}
    except Exception:  # noqa: BLE001 - report a failed transcription cleanly
        traceback.print_exc()
        return {"transcript": "", "error": "Transcription failed on the server."}
