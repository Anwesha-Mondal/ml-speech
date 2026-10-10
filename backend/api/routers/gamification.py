from fastapi import APIRouter, UploadFile, File, Form, Depends

from backend.auth import require_user
import uuid

# Every endpoint here requires a signed-in user.
router = APIRouter(dependencies=[Depends(require_user)])

@router.get("/progress/history")
async def get_progress_history(user_id: str = "user_1", prompt_id: str = "T1_Gettysburg"):
    return {
        "user_id": user_id,
        "prompt_id": prompt_id,
        "history": [
            {"attempt": 1, "date": "2026-09-01", "score": 65, "flaw_density": 4.2},
            {"attempt": 2, "date": "2026-09-15", "score": 75, "flaw_density": 2.8},
            {"attempt": 3, "date": "2026-10-06", "score": 85, "flaw_density": 1.5}
        ],
        "insights": [
            "Your flaw density has decreased by 64% since your first attempt.",
            "You are speaking at a more consistent pace.",
            "Energy drops have been mostly eliminated."
        ]
    }

@router.post("/battle/1v1")
async def battle_1v1(
    prompt_id: str = Form(...),
    user_id_1: str = Form(...),
    user_id_2: str = Form(...)
):
    return {
        "battle_id": str(uuid.uuid4()),
        "prompt_id": prompt_id,
        "winner": user_id_1,
        "players": [
            {
                "user_id": user_id_1,
                "score": 88,
                "metrics": {"pacing_accuracy": 92, "pitch_stability": 85, "energy_control": 89}
            },
            {
                "user_id": user_id_2,
                "score": 82,
                "metrics": {"pacing_accuracy": 78, "pitch_stability": 88, "energy_control": 80}
            }
        ],
        "insights": [
            f"Player {user_id_1} maintained closer pacing to the reference (+14%).",
            f"Player {user_id_2} had slightly better pitch stability (+3%)."
        ]
    }

@router.post("/mimic-party")
async def mimic_party(
    reference_id: str = Form(...),
    participant: UploadFile = File(...)
):
    return {
        "job_id": str(uuid.uuid4()),
        "reference_id": reference_id,
        "score": 94,
        "metrics": {"melody_match": 96, "cadence_sync": 91, "emphasis_timing": 95},
        "highlights": [
            "Perfect pause timing on the dramatic turn!",
            "You nailed the rising pitch at the climax."
        ],
        "feedback": "Outstanding! You sounded just like the melody of the original performance, ignoring your actual voice."
    }

# The leaderboard moved to backend/leaderboard (Redis, opt-in): GET /api/leaderboard.
