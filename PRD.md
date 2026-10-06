# Speech Arena: Product Requirements Document (PRD)

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Date | 2026-10-06 |
| Track | Multimodal AI Hackathon 2026, Track C: Contrastive Speech Analytics & Temporal Flaw Grounding |
| Sources | `Speech_Master_Research_Build_Prompt.md`, `docs/00`–`19`, **`docs/20-ENGINEERING-REVIEW.md` (binding)** |
| Companion docs | [ROADMAP.md](ROADMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SESSION_LOG.md](SESSION_LOG.md) |

---

## 1. Problem

Speech tools today either transcribe (*what* was said) or give vague coaching ("sound more confident"). Nothing on offer will:
1. compare a delivery against a reference reading of the **same text**,
2. pinpoint **exactly when** a delivery flaw happens,
3. show the **measured acoustic evidence**, and
4. turn that evidence into a deterministic, plain-language explanation and a decomposable score.

## 2. Product Statement

Speech Arena takes **audio + transcript** and compares it against a **reference delivery**. It returns:
- time-stamped **flaw regions** linked to transcript words,
- **acoustic evidence** for each one (reference value, participant value, delta),
- a **deterministic explanation** and an actionable tip,
- a **0–100 score** that breaks down into components,

all of it reproducible bit-for-bit.

The engine is backed by a **custom contrastive dataset**: references plus controlled flawed mirrors on a severity ladder. A benchmark suite proves accuracy, robustness and fairness.

## 3. Goals and Non-Goals

### Goals (MVP, judged)
| ID | Goal | Judging weight |
| --- | --- | --- |
| G1 | Custom contrastive dataset with exact temporal labels and a full severity gradient, plus stress tests | 30% |
| G2 | Temporal grounding + mathematical-to-human explanation | 25% |
| G3 | Rigorous feature extraction (F0, energy, rate, pauses, MFCC/spectral, clarity) | 20% |
| G4 | Interactive dashboard with synced overlays and flaw cards | 15% |
| G5 | Deterministic, containerized, documented system | 10% |

### Non-Goals
- Generic speech-to-text or WER-based scoring.
- Sentiment, emotion or psychological inference ("nervous", "angry", "confident").
- Voice cloning or identity/timbre similarity scoring.
- Accent or pronunciation "correctness" scoring.
- Enterprise cloud infrastructure (EKS, Kafka, ArgoCD) during the hackathon.
- Battles, leaderboards, XP and Mimic Party in the MVP (post-MVP, see §8).

## 4. Users

| Persona | MVP? | Need |
| --- | --- | --- |
| **Judge / Researcher** | ✅ primary | Reproduce results, inspect the dataset, verify the math |
| **The Polisher** (professional) | ✅ | Upload, see the exact flawed spans with evidence, practise again |
| **The Evaluator** (coach / HR) | ⚠️ partial | Exportable report, stable scoring version |
| The Competitor | ❌ post-MVP | Battles, fairness |
| The Mimic | ❌ post-MVP | Contour matching game |

## 5. Core User Flows (MVP)

### F1. Analyze a delivery
1. The user picks a reference prompt from the library (or uploads reference audio + transcript).
2. The user records in the browser or uploads participant audio.
3. The system queues a job. The UI streams stage status: `normalizing → aligning → extracting → comparing → explaining → scoring`.
4. The results screen shows: synced transcript, dual waveforms, toggleable F0/energy overlays, the flaw timeline, and the score with a component breakdown.
5. Clicking a flaw seeks the audio, highlights the words, and opens the explanation card.
6. The user can export a report (JSON + PDF).

### F2. Explore the dataset (judge flow)
1. Browse transcripts → reference → variants, ordered by flaw type and severity.
2. For any variant: play it, see the ground-truth injected interval next to the predicted flaw, and see the IoU.

### F3. Reproduce the benchmarks (judge flow)
1. `docker compose run benchmark` → regenerates the metrics tables, ablations and stress results, with version stamps.

## 6. Functional Requirements

### 6.1 Data and dataset
| ID | Requirement | Priority |
| --- | --- | --- |
| FR-D1 | Source registry with every URL from doc 02, a status (`VERIFIED / UNVERIFIED / RESEARCH_ONLY / REJECTED`) and a rights manifest per asset (03 schema) | P0 |
| FR-D2 | Audio normalized to 16 kHz mono 16-bit PCM WAV, with SHA-256 for raw and normalized files | P0 |
| FR-D3 | Canonical transcripts with punctuation kept and spoken-form normalization, versioned | P0 |
| FR-D4 | Flaw injector: segment-local, with room-tone pauses, a PSOLA/WORLD resynthesis chain, identity resynthesis for references, and a **time-map** output | P0 |
| FR-D5 | Taxonomy coverage: pacing (fast, slow, irregular), pauses (excessive, missing, misplaced), pitch (monotone, instability), energy (low, excessive, abrupt), emphasis misplaced, clarity reduced, hesitation, multi-flaw, near-perfect controls | P0 (pacing, pause, pitch, energy) · P1 (rest) |
| FR-D6 | Severity ladder 0.0–1.0, with ≥ 4 levels per flaw type and a per-flaw parameter→severity map | P0 |
| FR-D7 | Acted (human-recorded) variants from consenting team members for a subset of flaws | P1 |
| FR-D8 | Connected-component split (train/dev/test) with a leakage report | P0 |
| FR-D9 | Dataset card + exportable manifest (Parquet/JSONL) | P0 |

### 6.2 Analysis engine
| ID | Requirement | Priority |
| --- | --- | --- |
| FR-E1 | Forced alignment (word level, and character/phone level where available) with per-word confidence | P0 |
| FR-E2 | Features at a 10 ms hop: F0 (Hz + semitones), RMS (linear + dB), MFCC-13, spectral centroid/rolloff/tilt, VAD, CPP/HNR | P0 (F0, RMS, VAD, MFCC) · P1 (CPP, HNR, tilt) |
| FR-E3 | Word/phrase-level aggregates: duration, local rate, following pause, ST mean/range, dB mean/range | P0 |
| FR-E4 | Two-channel normalization (ADR-001); raw and normalized values persisted | P0 |
| FR-E5 | Alignment-anchored deviation detection per flaw type, snapped to word boundaries | P0 |
| FR-E6 | `Flaw` objects: type, start/end time, transcript span, reference stat, participant stat, delta, severity, confidence, evidence feature IDs | P0 |
| FR-E7 | Deterministic explanation templates from the approved dictionary (doc 10) | P0 |
| FR-E8 | Decomposable scoring (doc 11 + review fixes): bucket caps, overlap merge, versioned weights | P0 |
| FR-E9 | Disfluency insertion events (fillers, repetitions) detected from VAD-speech-in-gap | P1 |
| FR-E10 | Every result stamped with `dataset_version, feature_version, alignment_version, model_version, scoring_version, config_hash, code_commit, env_version` | P0 |

### 6.3 Dashboard
| ID | Requirement | Priority |
| --- | --- | --- |
| FR-U1 | Upload or record audio + choose/paste a transcript; drag-and-drop | P0 |
| FR-U2 | Live job status per pipeline stage | P0 |
| FR-U3 | Synced transcript with word highlight; click a word to seek | P0 |
| FR-U4 | Reference and participant waveforms (wavesurfer.js) | P0 |
| FR-U5 | F0 (semitone) and energy (dB) overlays, reference vs participant, on canvas (uPlot), with toggles | P0 |
| FR-U6 | Flaw timeline + explanation card (timestamp, context, evidence, interpretation, action, confidence warning) | P0 |
| FR-U7 | Score with component breakdown (radar/bar chart) | P0 |
| FR-U8 | Dataset explorer: ground truth vs predicted intervals | P1 |
| FR-U9 | Export a JSON + PDF report | P1 |

### 6.4 Benchmarks
| ID | Requirement | Priority |
| --- | --- | --- |
| FR-B1 | Grounding: event-based F1 at ±100/±200 ms tolerance, segment IoU, boundary MAE | P0 |
| FR-B2 | Classification P/R/F1 per flaw type; severity Spearman ρ | P0 |
| FR-B3 | FPR on clean cross-take/cross-speaker pairs | P0 |
| FR-B4 | Repeated-run reproducibility (10 runs → identical result hash) | P0 |
| FR-B5 | Stress suite: noise, reverb, codec, clipping, gain, EQ | P0 |
| FR-B6 | Ablations: F0-only vs multi-feature, pauses on/off, MFCC/spectral contribution, normalization raw/semitone/z-score, alignment quality, window size | P1 |
| FR-B7 | Human evaluation: ≥ 3 raters, Krippendorff's α, Spearman vs system severity | P1 |

## 7. Non-Functional Requirements

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-1 | Determinism | Same input + versions → byte-identical canonical result JSON |
| NFR-2 | Latency | ≤ 30 s end-to-end for 60 s of audio on a CPU laptop (8 cores) |
| NFR-3 | UI performance | Playhead and overlays at ≥ 55 fps for a 5-minute file |
| NFR-4 | Portability | `docker compose up` on Windows, macOS and Linux; CPU-only default |
| NFR-5 | Code quality | Python typed (mypy strict on `packages/`), ruff, pytest ≥ 80% on the core pipeline; TS strict, eslint |
| NFR-6 | Explainability | 100% of score deductions map to a `Flaw` with a timestamp and evidence |
| NFR-7 | Privacy | Uploads auto-deleted after a TTL (default 7 days); consent required for recordings; salted speaker hash |
| NFR-8 | Rights | 100% of the redistributed bundle has `redistribution_allowed = true` and `derivative_allowed = true` for variants |

## 8. Post-MVP Scope (not judged)
Same engine, no changes to core contracts:
- **You vs You** progress tracking (first stretch goal, cheapest).
- **1v1 Battle** (async), with dual normalization.
- **Mimic Party** (side feature per the user): shape-channel DTW similarity, identity-blind test.
- Leaderboards (per transcript, version-locked), Elo.
- Interview, News Anchor and Debate mode weight presets.

## 9. Success Metrics (MVP exit criteria)

| Metric | Target | Notes |
| --- | --- | --- |
| Dataset size | ≥ 5 transcripts, ≥ 3 reference speakers per transcript for ≥ 2 transcripts, ≥ 300 variants | Speaker diversity needed for fairness |
| Severity coverage | Every P0 flaw × ≥ 4 severity levels | Histogram in the dataset card |
| Grounding F1 @ ±200 ms (injected, clean) | ≥ 0.85 | Stretch: IoU ≥ 0.85 (01 §3.3) |
| FPR on clean cross-speaker pairs | ≤ 0.05 flaws/minute | Realistic version of 12 §3.3 |
| Stress robustness | F1 drop ≤ 15% at 20 dB SNR | Report the full curve |
| Severity Spearman ρ vs injected level | ≥ 0.8 | |
| Human agreement | Report α; system-vs-human ρ ≥ 0.6 | |
| Reproducibility | 10/10 identical hashes | CPU path |
| Latency | ≤ 30 s per minute of audio | |

## 10. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Shortcut learning on DSP artifacts | Inflated metrics | Identity resynthesis; acted variants; per-source reporting |
| Not enough multi-speaker references | Weak fairness/FPR evidence | Record team members (consent), 3–5 speakers |
| Alignment fails on severe flaws | Bad grounding | Confidence propagation; chunking; ground truth from the time-map |
| Rights problems on famous speeches | Disqualification | PD/CC BY only for derivatives; TED = research-only |
| Scope creep into gamification | Missed core deliverables | ADR-010; Phase 11 only after the release candidate |
| Windows dev environment issues (MFA/Kaldi) | Lost time | MMS_FA (pure PyTorch) primary; MFA optional in Docker |

## 11. Open Questions (need user input)
1. **Hackathon submission deadline** (sets the roadmap dates).
2. Team size and who records the acted and multi-speaker references.
3. Do you have the **official Track C brief** to add to `docs/`?
4. GPU availability (local CUDA?), or CPU-only?
5. Frontend: Vite + React (recommended for a static dashboard) or Next.js (named in 01 §3.8)?
