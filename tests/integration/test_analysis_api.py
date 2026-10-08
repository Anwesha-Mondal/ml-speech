import os
import pytest
from starlette.testclient import TestClient
from backend.api.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_analyze_endpoint_with_real_audio():
    audio_path = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "data", "audio", "speech_aug_0_fast.wav")
    assert os.path.exists(audio_path), f"Audio fixture missing at {audio_path}"

    with open(audio_path, "rb") as f:
        response = client.post(
            "/api/analyze",
            files={"participant": ("test_speech.wav", f, "audio/wav")},
            data={"transcript": "Four score and seven years ago", "mode": "sandbox"}
        )

    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "processing"

    job_id = data["job_id"]

    # Poll status
    job_resp = client.get(f"/api/jobs/{job_id}")
    assert job_resp.status_code == 200
    job_data = job_resp.json()

    assert job_data["status"] == "completed"
    result = job_data["result"]
    assert "score" in result
    assert "total" in result["score"]
    assert "buckets" in result["score"]
    assert "pacing" in result["score"]["buckets"]
    assert "pitch" in result["score"]["buckets"]
    assert "pauses" in result["score"]["buckets"]
    assert "energy_clarity" in result["score"]["buckets"]

    assert isinstance(result["flaws"], list)
    assert len(result["flaws"]) > 0

    # Verify flaw structure conforms to ApiFlaw schema
    flaw = result["flaws"][0]
    assert "type" in flaw
    assert "bucket" in flaw
    assert "start_time" in flaw
    assert "end_time" in flaw
    assert "penalty" in flaw
    assert "explanation" in flaw
    assert "evidence" in flaw

    # Verify contours
    assert "contours" in result
    assert "t" in result["contours"]
    assert "energyPart" in result["contours"]
