from fastapi import APIRouter, UploadFile, File, Form
import uuid

router = APIRouter()

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

@router.get("/leaderboard")
async def get_leaderboard(prompt_id: str = "T1_Gettysburg", version: str = "v1.0.0"):
    return {
        "prompt_id": prompt_id,
        "version": version,
        "last_updated": "2026-10-08T00:00:00Z",
        "rankings": [
            {"rank": 1, "user_id": "AlexTheOrator", "score": 98, "flaw_density": 0.2, "mode": "news_anchor"},
            {"rank": 2, "user_id": "SpeechKing", "score": 96, "flaw_density": 0.5, "mode": "sandbox"},
            {"rank": 3, "user_id": "You", "score": 92, "flaw_density": 1.2, "mode": "sandbox"},
            {"rank": 4, "user_id": "StoryTeller99", "score": 90, "flaw_density": 1.8, "mode": "storytelling"},
            {"rank": 5, "user_id": "DebateChamp", "score": 88, "flaw_density": 2.1, "mode": "interviewer"},
            {"rank": 6, "user_id": "NewbieSpeaker", "score": 75, "flaw_density": 4.5, "mode": "sandbox"}
        ]
    }
