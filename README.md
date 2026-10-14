<p align="center">
  <img src="docs/assets/logo.png" alt="Speech Guru Logo" width="140" style="border-radius: 28px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);" />
</p>

<h1 align="center">Speech Guru</h1>

<p align="center">
  <strong>Objective Oratorical Assessment · Deterministic Acoustic Grounding · Multimodal Workspaces</strong><br />
  <em>Zero Generative LLM Hallucinations in the Acoustic Scoring Path</em>
</p>

<p align="center">
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.11+-3776ab.svg?style=flat-square&logo=python&logoColor=white" alt="Python 3.11+" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19-61dafb.svg?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/fastapi-0.110+-009688.svg?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="https://pytorch.org/"><img src="https://img.shields.io/badge/PyTorch-2.0+-ee4c2c.svg?style=flat-square&logo=pytorch&logoColor=white" alt="PyTorch" /></a>
  <a href="https://www.mongodb.com/"><img src="https://img.shields.io/badge/MongoDB-6.0+-47a248.svg?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square" alt="License: MIT" /></a>
</p>

---

## Executive Summary

**Speech Guru** is a state-of-the-art multimodal speech evaluation platform designed to solve the long-standing problem of subjective oratorical judging. While conventional speech-coaching tools rely on conversational LLM wrappers that fabricate impressionistic feedback, Speech Guru operates on a strictly deterministic foundation: **every score deduction, highlight, and critique is mathematically anchored to measurable physical acoustic properties**.

By combining classical digital signal processing (DSP), two-channel speaker normalization, time-aligned speech-to-text tokenization, and a trained neural acoustic feature extractor (`facebook/wav2vec2-base`), Speech Guru identifies fine-grained delivery flaws with millisecond precision.

---

## Key Innovations & Architectural Highlights

### 1. Deterministic Acoustic Grounding (No LLM Scoring Hallucinations)
- **Zero-hallucination guarantee**: Scoring, deduction calculations, and flaw grounding are completely insulated from generative model drift.
- **Physical measurements**: Fundamental frequency ($F_0$ via Parselmouth/Praat autocorrelation), Root Mean Square (RMS) energy envelopes, speaking rate (syllables/sec and WPM), and silence boundary durations (>0.5s) directly drive evaluations.
- **Fact-based feedback**: Jinja2 deterministic explanation templates report exact physical deltas (e.g., *"Speaking rate exceeded target baseline by +1.8 syllables/sec"* or *"Pitch range remained compressed within 1.2 semitones across 4.8 seconds"*).

### 2. Contrastive Two-Channel Normalization (ADR-001)
Natural pitch and loudness vary dramatically across biological speaker characteristics (e.g., adult male vs. female fundamental frequency). Naive comparisons produce false positives, while aggressive normalization erases actual performance flaws. Speech Guru resolves this tension through two distinct channels:
- **Magnitude Channel**: Semitones relative to median $F_0$ and decibels relative to speech loudness. Preserves genuine delivery variance without cross-speaker bias.
- **Shape Channel**: Z-score contour normalization for relative melodic dynamics and contour matching.

### 3. End-to-End Connected 12-Stage Processing Pipeline
Every submitted recording passes through a transparent, 12-stage audio analytics pipeline:

| # | Pipeline Stage | Underlying Architecture & Implementation | Primary Deliverable |
|:---:|:---|:---|:---|
| **01** | **Upload** | FastAPI async streaming & cryptographic SHA-256 fingerprinting | Standardized job descriptor |
| **02** | **Rights Gate** | Policy manifests verification against public domain & research rights | Compliance clearance |
| **03** | **Audio Normalization** | Single-channel 16,000 Hz float32 PCM standardization | Uniform sample matrix |
| **04** | **Quality Control (QC)** | SNR estimation, clipping ratio calculation, duration checks | Acoustic integrity report |
| **05** | **Transcript** | OpenAI Whisper ASR & text token normalization | Canonical spoken vocabulary |
| **06** | **VAD / Segmentation** | Silero VAD energy & silence boundary detection | Sub-second pause boundaries |
| **07** | **Alignment** | Word-level acoustic temporal anchoring | Millisecond timestamp bounds |
| **08** | **Feature Extraction** | Parselmouth F0, RMS energy, zero-crossing rate, speaking rate | Continuous feature vectors |
| **09** | **Normalization** | ADR-001 magnitude & shape contour calculations | Speaker-invariant contours |
| **10** | **Neural Flaw Detection** | Wav2Vec2 + MLP multi-label classifier head | Multi-label flaw instances |
| **11** | **Scoring Engine** | Mode-weighted calibrated 100-point rubric with capped bucket penalties | Calibrated score breakdown |
| **12** | **Explanation** | Jinja2 deterministic acoustic fact and critique synthesis | Verifiable user insights |

### 4. Five Purpose-Built Practice Workspaces
- **🎙️ Speech Assessment Sandbox**: Dual-waveform inspection, synchronized pitch ($F_0$) contours, energy envelopes, and syllable-by-syllable flaw exploration.
- **💼 AI Technical Interviewer**: Turn-based mock interview turns evaluating STAR framework coherence, filler-word frequency, and dynamic probe follow-ups.
- **📺 News Anchor Studio**: Live studio teleprompter with auto-scroll cadence, real-time pace guides, and breaking news copy.
- **🏛️ Public Speaking & Debate Arena**: Parliamentary debate timer, responsive crowd soundscapes, and an interactive 4-7-8 breathing pacer for stage presence.
- **📖 Storyteller Studio**: Narrative performance coach tracking character voices and dynamic expressive energy arcs across Freytag’s dramatic pyramid.

### 5. High-Throughput Inference Engine
- Single-pass vectorized frame caching, batched PyTorch tensor operations, and in-memory audio chunking evaluate a 2-minute speech in **under 12 seconds**.

---

## System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                    Speech Guru UI                      │
                    │   (React 19 + TypeScript + Vite + Minimal Editorial)   │
                    └───────────▲───────────────────────────────▲────────────┘
                                │ Audio Stream (PCM)            │
                                │ REST / SSE                    │ Visual Feedback & Metrics
                                ▼                               │
                    ┌───────────────────────────────────────────┴────────────┐
                    │               FastAPI API Gateway                      │
                    └──────┬──────────────────────────────────────────┬──────┘
                           │                                          │
         [Dialogue & Context Flow]                  [Deterministic Scoring Flow]
                           │                                          │
          ┌────────────────┴───────────────┐         ┌────────────────┴───────────────┐
          │      RAG & Practice Models     │         │    12-Stage Acoustic Pipeline  │
          │   • BM25 Multi-Index Search    │         │   • Silero VAD / Segmentation  │
          │   • STAR Behavioral Logic      │         │   • 16 kHz Mono Normalization  │
          │   • Dynamic Teleprompter Pacer │         │   • Parselmouth F0 & Energy    │
          │   • Audience Ambient Engine    │         │   • Wav2Vec2 Multi-Label MLP   │
          └────────────────────────────────┘         │   • Two-Channel Normalization  │
                                                     │   • 100-Point Mode Scorer      │
                                                     └────────────────────────────────┘
```

---

## Quickstart Guide

### Prerequisites
- **Python**: Version 3.11 or newer
- **Node.js**: Version 18 or newer (with npm)
- **MongoDB**: Community Edition 6.0+ (running locally on port `27017` or configured via `MONGODB_URL`)
- **FFmpeg**: Installed and available on system path (required for audio decoding)

### 1. Repository Setup
```bash
git clone https://github.com/pushkar-11/Speech-Arena.git
cd Speech-Arena
```

### 2. Environment Configuration
Copy the sample environment configurations:
```bash
# Backend environment
cp .env.example .env

# Frontend environment
cp frontend/.env.example frontend/.env
```

### 3. Backend Installation
```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Frontend Installation
```bash
cd frontend
npm install
cd ..
```

### 5. Starting the Application

#### Option A: Unified Launcher
```bash
python dev.py
```

#### Option B: Standalone Services
Terminal 1 (Backend):
```bash
uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Visit the application at:
- **Web Application**: `http://localhost:5173`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`

---

## Machine Learning & Benchmark Reproducibility

### Tier 1 Speech Corpus
- **Audio Basis**: 1,680 standardized physical 16 kHz mono WAV recordings derived from 40 human speakers in OpenSLR LibriSpeech `dev-clean`.
- **Acoustic Flaw Perturbations**: Phase-vocoder tempo scaling (`TOO_FAST`, `TOO_SLOW`), RMS dynamic attenuation (`LOW_ENERGY`, `HIGH_ENERGY`), fundamental frequency flattening (`MONOTONE`), and boundary insertion (`EXCESSIVE_PAUSE`).
- **Data Splits**: 80% Train (32 speakers, 1,344 samples) / 20% Validation (8 completely unseen speakers, 336 samples).
- **Model Checkpoint**: Production weights stored in `ml/checkpoints/best_checkpoint.pt`.

### Automated Verification & Quality Suites
Speech Guru includes strict deterministic testing suites:

```bash
# Execute backend unit and scoring suite
pytest tests/ -q

# Execute frontend strict type-checking and linting
cd frontend && npm run build && npm run lint && cd ..

# Run reproducible stress-test benchmarks
python benchmarks/run_benchmarks.py
```

---

## Privacy by Design & Ethics

- **Zero Audio Storage**: Audio recordings processed in `/api/analyze` are held in memory during the execution lifecycle and are never persisted to long-term server storage.
- **Client-Side Security**: NIST 800-63B compliant password hashing (`scrypt`), secure HTTP-only cookies, and configurable automatic TTL session revocation.
- **Strictly Acoustic Evaluation**: Speech Guru reports purely acoustic, measurable physical facts. The system does not make inferences about speaker psychology, personality, emotional state, or native accent.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
