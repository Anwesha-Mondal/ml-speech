# Phase 12: Pipeline Integration (Replacing Mocks)

## 1. Objective
Currently, the `/api/analyze` and `/api/battle/1v1` endpoints return mocked JSON results. The core pipeline (audio ingestion, feature extraction, forced alignment, and scoring engine) was built in Phases 2-6 but is only accessible via the CLI (`sa analyze`).
This phase replaces the mock endpoints with real integrations, wiring the FastAPI backend directly to the `speech_arena` python package.

## 2. Requirements & Context
- **Frameworks:** FastAPI (Backend), React/Vite (Frontend)
- **Dependencies:** The pipeline requires `ffmpeg` (via `audio.io`), `torchaudio.pipelines.MMS_FA` (via `align.mms`), and `parselmouth/librosa` (via `features.frame`).
- **Performance constraints:** A 30s audio clip might take 5-15s to process on CPU. The API must handle this asynchronously so it doesn't block the main event loop.

## 3. Tasks

### Task 1: Integrate Background Job Queue
- **Goal:** Set up a lightweight async job queue in FastAPI using `BackgroundTasks` or a simple `asyncio` task dictionary for MVP purposes (since Celery might be overkill for a hackathon).
- **Steps:**
  - Create `backend/api/jobs.py` with an in-memory dictionary `job_store = {}`.
  - Update `routers/analysis.py` to accept the file upload, save it to a temporary directory, and spawn a background task.
  - Return `{ "job_id": job_id, "status": "processing" }` immediately.

### Task 2: Wire up the Speech Arena Pipeline
- **Goal:** Connect the backend to the `packages/speech_arena` logic.
- **Steps:**
  - Import the pipeline orchestrator (or reproduce the `sa analyze` logic from `cli.py`).
  - Run normalization, forced alignment, feature extraction, and contrastive scoring on the uploaded audio against the reference audio.
  - Serialize the `AnalysisResult` and store it in `job_store[job_id]`.

### Task 3: Polling Endpoint for Frontend
- **Goal:** Allow the frontend to retrieve the result.
- **Steps:**
  - Update `GET /api/jobs/{job_id}` in `routers/analysis.py` to read from `job_store`.
  - If processing, return `status: processing`. If complete, return the canonical `AnalysisResult`.

### Task 4: Frontend State Hydration
- **Goal:** Update the React UI to parse the real `AnalysisResult` schema.
- **Steps:**
  - Update `Sandbox.tsx` to handle the real output format (the mock was slightly simplified).
  - Ensure the `uPlot` waveforms and flaw timeline map to the exact timestamps returned by the MMS_FA aligner.

## 4. Verification & Testing
- Upload `datasets/mock/test_audio.wav` via the React Dashboard.
- Verify the job goes to `processing` and resolves to `completed` within 30 seconds.
- Verify the displayed score exactly matches the output of `sa analyze datasets/mock/test_audio.wav` on the CLI.
