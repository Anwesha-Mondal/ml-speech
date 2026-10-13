# Speech Guru 🎙️

> **Multimodal AI Hackathon 2026 — Track C Submission**  
> *Contrastive Speech Analytics, Temporal Flaw Grounding & Interactive Multimodal Workspaces*

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/mongodb-6.0+-47A248.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)

Speech Guru is an end-to-end multimodal speech evaluation platform designed for objective oratorical assessment. It solves the long-standing problem of subjective speech judging by providing **millisecond-accurate temporal flaw grounding**, **mathematical acoustic evidence**, and **interactive practice workspaces**—with **zero generative LLM hallucinations in the acoustic scoring path**.

---

## 🌟 Key Innovations

1. **Deterministic Acoustic Grounding (Zero LLM Hallucinations in Scoring)**  
   Unlike LLM wrapper coaches that generate arbitrary ratings, Speech Guru evaluates delivery using classical digital signal processing (DSP) and a frozen `facebook/wav2vec2-base` multi-label acoustic classifier. Every score is anchored to exact physical properties: pitch contour variance ($F_0$), local speech rate (WPM / syllables per second), pause durations, and RMS sound energy.

2. **Contrastive Two-Channel Normalization**  
   Solves biological speaker variance without erasing actual flaws:
   - *Magnitude Channel*: Semitone and relative decibel scaling for objective flaw detection.
   - *Shape Channel*: Z-score contour normalization for tempo and melody matching (speaker-invariant).

3. **Tier 1 Scaled Real-World Speech Corpus**  
   1,680 physical 16 kHz mono WAV audio recordings derived from 40 human speakers (OpenSLR LibriSpeech `dev-clean`), balanced across 7 acoustic flaw categories (`IDEAL`, `TOO_FAST`, `TOO_SLOW`, `LOW_ENERGY`, `HIGH_ENERGY`, `MONOTONE`, `EXCESSIVE_PAUSE`) with strict speaker-disjoint train/validation splits.

4. **24x Accelerated Inference Engine**  
   Single-pass vectorized frame feature caching, batched PyTorch inference, and in-memory chunked Whisper transcription process a 120-second speech in **under 12 seconds** (accelerated from 365s).

5. **5 Purpose-Built Practice Workspaces**  
   - **Speech Assessment Sandbox:** Comprehensive acoustic flaw analysis with dual-waveform inspection, pitch ($F_0$) contours, and energy envelopes.
   - **AI Technical Interviewer:** Industry mock interview turns with STAR methodology checks, filler-word tracking, and dynamic probe follow-ups.
   - **News Anchor Studio:** Live studio teleprompter with pacing guidance and breaking news copy.
   - **Public Speaking & Debate Arena:** Parliamentary debate sparring, audience crowd soundscape, and an integrated 4-7-8 breathing pacer.
   - **Storyteller Studio:** Expressive narration coaching with Freytag's Pyramid dynamic energy arcs.

6. **Privacy-by-Design Architecture**  
   NIST 800-63B authentication, scrypt password hashing, MongoDB TTL-enforced session and result expiry, zero raw audio persistence on server disks, and strict SameSite session management.

---

## 🏗️ System Architecture

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Speech Guru Web UI                     │
                  │   (React 19 + TypeScript + Vite + Minimal Editorial)   │
                  └───────────▲───────────────────────────────▲────────────┘
                              │ Audio Upload / Mic            │
                              │ REST / SSE                    │ Visual Feedback
                              ▼                               │
                  ┌───────────────────────────────────────────┴────────────┐
                  │               FastAPI Backend Gateway                  │
                  └──────┬──────────────────────────────────────────┬──────┘
                         │                                          │
       [Pillar A: Context & Dialogue]             [Pillar B: Acoustic Measurement]
                         │                                          │
        ┌────────────────┴───────────────┐         ┌────────────────┴───────────────┐
        │       Deterministic BM25       │         │    torchaudio MMS_FA / VAD     │
        │      RAG Knowledge Engine      │         │     (Word Forced Alignment)    │
        │   • STAR Framework Question DB │         ├────────────────────────────────┤
        │   • AP News Wire Scripts       │         │    Praat Parselmouth & Librosa │
        │   • Debate Sparring Motions    │         │  • Pitch (F0) & Semitone Delta │
        │   • Freytag Story Arc Engine   │         │  • Energy (RMS dBFS) & Pauses  │
        └────────────────────────────────┘         ├────────────────────────────────┤
                                                   │   Frozen Wav2Vec2 + MLP Head   │
                                                   │ (7-Class Acoustic Flaw Neural) │
                                                   ├────────────────────────────────┤
                                                   │ Contrastive Scoring (s1.0/2.0) │
                                                   │  (Pure Math / Zero LLM Halluc) │
                                                   └────────────────────────────────┘
                                                                    │
                                            ┌───────────────────────▼──────────────┐
                                            │ MongoDB (TTL Sessions, Scores, Auth) │
                                            └──────────────────────────────────────┘
```

---

## 📋 Prerequisites & Dependencies

Before running Speech Guru, ensure you have the following installed on your machine:

| Requirement | Supported Version | Notes |
| :--- | :--- | :--- |
| **Python** | `3.11.x` – `3.12.x` | Required for PyTorch, Parselmouth, and FastAPI. |
| **Node.js & npm** | `Node 18.x` or `20.x+` | Required for building and running the Vite frontend. |
| **MongoDB** | `6.0+` or `7.0+` | Running locally on `mongodb://127.0.0.1:27017`. |
| **FFmpeg** | `4.x+` / `6.x+` | Required for audio format conversion and resampling. |
| **Hardware** | CPU or NVIDIA GPU | CUDA optional (auto-detected for GPU acceleration). |

---

## 🚀 Step-by-Step Setup & Running

### 1. Clone the Repository
```bash
git clone https://github.com/pushkar-11/Speech-Arena.git
cd Speech-Arena
```

### 2. Configure Environment Variables
Copy the template `.env` files for both the root backend and the frontend:

```bash
# Backend / root environment
cp .env.example .env

# Frontend environment
cp frontend/.env.example frontend/.env
```

Ensure MongoDB is running locally:
```bash
# On Linux / macOS:
mongod --config /usr/local/etc/mongod.conf

# On Windows (PowerShell):
net start MongoDB
```

### 3. Install Python Dependencies
We recommend using a virtual environment:

```bash
# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
# Or using uv (recommended for speed):
# uv sync --extra dev
```

### 4. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 5. Launch the Entire Platform (One-Command)
Run the automated unified runner which checks MongoDB, clears ports, launches the FastAPI backend on port `8000`, and starts the Vite frontend on port `5173`:

```bash
# Python runner (cross-platform):
python dev.py

# Or using npm:
npm run dev

# Or Windows script:
.\start.ps1
```

Once started, open your browser and visit:
👉 **`http://localhost:5173`** (Dashboard)  
👉 **`http://localhost:8000/docs`** (API OpenAPI Documentation)

---

## 🐳 Running with Docker Compose

Alternatively, start the entire stack using Docker Compose:

```bash
docker-compose up -d
```
The dashboard will be accessible at `http://localhost:5173` and the backend at `http://localhost:8000`.

---

## 🧪 Running Tests & Benchmarks

Speech Guru maintains 100% deterministic test coverage across its API, scoring engine, and RAG catalog:

```bash
# Run backend test suite (unit, scoring, RAG, auth)
pytest tests/ -q

# Run frontend type-check and linter
cd frontend
npm run build
npm run lint
cd ..

# Replicate benchmarks and stress-test suite
python benchmarks/run_benchmarks.py
```

Benchmark output is written canonically to `benchmarks/reports/benchmark_report.json`.

---

## 📊 Dataset & Machine Learning

### Tier 1 Real-World Dataset
- **Seeds:** 240 clean human speech samples from OpenSLR LibriSpeech `dev-clean`.
- **Perturbations:** Phase vocoder time-stretch (pacing), RMS gain scaling (energy), median F0 flattening (monotone), and silent gap insertions (pauses).
- **Split:** 80% Train (32 speakers, 1,344 files) / 20% Val (8 unseen speakers, 336 files).
- **Format:** 16 kHz Mono PCM WAV.

To regenerate or scale the dataset:
```bash
python ml/scripts/prepare_real_dataset.py --max-seeds 240
python ml/training/train_classifier.py --epochs 35
```
Production model checkpoint is located at `ml/checkpoints/best_checkpoint.pt`.

---

## 📂 Project Structure

```
orcter/
├── backend/                  # FastAPI web services & API routers
│   ├── api/                  # Endpoints: /analyze, /rag, /auth, /leaderboard
│   └── auth/                 # NIST 800-63B password validation & session management
├── frontend/                 # React 19 + TypeScript + Vite dashboard
│   ├── src/pages/practice/   # 5 Dedicated Practice Workspaces
│   ├── src/components/       # Audio waveform, uPlot curves, teleprompter
│   └── src/styles/           # Minimal Editorial light-mode design tokens
├── ml/                       # Machine Learning & Acoustic Models
│   ├── checkpoints/          # Production PyTorch weights (Wav2Vec2 + MLP)
│   ├── inference/predict.py  # 24x accelerated hybrid inference pipeline
│   ├── scripts/              # Dataset generation and augmentation
│   └── training/             # Multi-label classifier training scripts
├── packages/speech_arena/    # Core Deterministic Acoustic Engine
│   ├── align/                # Torchaudio MMS forced alignment & TextGrid
│   ├── features/             # Parselmouth F0, RMS energy, spectral centroids
│   ├── inject/               # Time-map grounded flaw injection operators
│   ├── normalize/            # Two-channel (magnitude + shape) normalization
│   └── scoring/              # Grounded flaw detectors and Jinja2 explanations
├── datasets/                 # Rights manifests, source registries, dataset cards
├── benchmarks/               # Reproducible stress test suite & benchmark runners
├── configs/                  # Versioned YAML configurations (thresholds, weights)
├── docs/                     # Full technical report, system card, demo script
└── dev.py                    # Unified one-command developer launcher
```

---

## 🏆 Hackathon Submission Deliverables

- **Devpost Project Page:** Comprehensive documentation, problem statement, and solution architecture in [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md).
- **Public GitHub Repository:** [github.com/pushkar-11/Speech-Arena](https://github.com/pushkar-11/Speech-Arena)
- **Demo Video:** 3-10 minute YouTube walkthrough following [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).
- **Technical Report:** 6-page technical report in [`docs/TECHNICAL_REPORT.md`](docs/TECHNICAL_REPORT.md).
- **System & Dataset Cards:** [`docs/SYSTEM_CARD.md`](docs/SYSTEM_CARD.md) and [`datasets/DATASET_CARD_v1.md`](datasets/DATASET_CARD_v1.md).

---

## 📄 License & Ethics

This project is licensed under the MIT License.  
All evaluation feedback is strictly grounded in verifiable acoustic measurements. Speech Guru does not make psychological or emotional inferences about speakers.
