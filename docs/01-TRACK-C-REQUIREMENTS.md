# SPEECH ARENA: 01-TRACK-C-REQUIREMENTS

## 1. Introduction

This document maps the raw requirements from the Multimodal AI Hackathon 2026 (Track C: Contrastive Speech Analytics & Temporal Flaw Grounding) directly to implementation specifications. It serves as the primary checklist for the engineering team. Every requirement listed here must be verifiable in the final codebase and reproducible by the judges.

---

## 2. Core Constraints & Exclusions

Before building, the team must strictly adhere to what this project is **not** allowed to be.

### 2.1 The "Not Just ASR" Rule
*   **Requirement:** "Do not turn this into a generic speech-to-text application."
*   **Implementation:** The system must not score users primarily on Word Error Rate (WER). If a user mumbles but gets the pacing and pitch perfect, the system must report "Low clarity / Mumbling" as a flaw, rather than simply failing to transcribe.
*   **Validation:** Test the system with heavily accented speech that has perfect pacing. The pacing score must remain high even if the ASR proxy struggles slightly.

### 2.2 The "Custom Contrastive Dataset" Rule
*   **Requirement:** "External datasets are supporting resources; they do not automatically become our custom contrastive dataset."
*   **Implementation:** We cannot submit LibriSpeech and claim we built a dataset. We must engineer a new dataset where each `transcript_id` has a `Reference` audio and multiple `Variant` audios (with controlled, injected flaws).
*   **Validation:** The final dataset manifest must explicitly link reference IDs to variant IDs.

---

## 3. The 12 Immutable Scientific Requirements

The Hackathon explicitly lists 12 requirements that *must* be preserved.

### 3.1 Custom Paired Good/Bad Dataset
*   **Requirement:** Custom paired good/bad speech dataset using the same transcripts.
*   **Spec:** Database schema must enforce a 1:N relationship between `Transcript` and `AudioRecording`.
*   **Metrics:** Must have at least 5 variants per transcript.

### 3.2 Bad Spectrum (Severity Gradient)
*   **Requirement:** Bad spectrum from egregiously wrong to almost perfect.
*   **Spec:** The `Flaw` object must contain a `severity` float between 0.0 and 1.0. The dataset generation process must explicitly target specific severity buckets (e.g., 0.1, 0.5, 0.9).
*   **Metrics:** The dataset manifest must show a uniform distribution of severity scores.

### 3.3 Accurate Temporal Labels
*   **Requirement:** Accurate temporal labels and paired recordings.
*   **Spec:** Human annotators (or algorithmic injectors) must label the exact start/end times of the flawed regions in the variants.
*   **Metrics:** Temporal Boundary Error / Intersection over Union (IoU) > 0.85 against human ground truth.

### 3.4 Forced Alignment
*   **Requirement:** Forced alignment from transcript to audio.
*   **Spec:** The pipeline must use a forced aligner (e.g., Montreal Forced Aligner, Wav2Vec2) to map words to timestamps.
*   **Metrics:** Alignment confidence > 90% on clean speech.

### 3.5 Feature Extraction Suite
*   **Requirement:** FFT, MFCC, pitch/F0, speech rate, pauses, energy and vocal-clarity features.
*   **Spec:** The `FeatureExtractor` service must output a standardized JSON/NumPy array containing all these features per 10ms frame.
*   **Metrics:** All features must be exportable and reproducible given the same audio file.

### 3.6 Temporal Grounding of Flaws
*   **Requirement:** Temporal grounding of exact flaw start/end regions.
*   **Spec:** The final output payload cannot just be "Pacing: 40/100". It must be an array of `Flaw` objects with `start_time` and `end_time`.
*   **Metrics:** 100% of deducted points must map back to a specific timestamp.

### 3.7 Causal Explanation
*   **Requirement:** Mathematical delta translated into structured causal explanation.
*   **Spec:** The UI must display the formula (e.g., `(participant_rate - ref_rate) / ref_rate = +0.34`).
*   **Metrics:** Explanations must be generated via a deterministic rule engine based on the delta, not hallucinated by an LLM.

### 3.8 Interactive Dashboard
*   **Requirement:** Interactive dashboard accepting audio + transcript.
*   **Spec:** A React/Next.js frontend. Must support drag-and-drop file upload and real-time processing feedback.
*   **Metrics:** Upload to result latency < 30 seconds for a 1-minute audio file.

### 3.9 Time-Series Overlays
*   **Requirement:** Time-series baseline/participant overlay with highlighted flaws.
*   **Spec:** The UI must feature a charting library (e.g., Recharts) synced to the audio player, showing the reference line and the participant line.
*   **Metrics:** High frame-rate rendering (60fps) during audio playback.

### 3.10 Speaker-Agnostic Normalization
*   **Requirement:** Speaker-agnostic normalization of pitch and energy.
*   **Spec:** Z-score normalization or Min-Max scaling of F0/Energy *per speaker* before comparing to the reference.
*   **Metrics:** The system must not penalize a naturally quiet speaker if their dynamic range (variance) matches the reference.

### 3.11 Reproducibility
*   **Requirement:** Reproducibility across runs and environments.
*   **Spec:** Dockerized workers, fixed random seeds for ML models, strictly versioned configurations.
*   **Metrics:** Running the same audio twice must yield the exact same SHA-256 hash of the JSON result payload.

### 3.12 Deliverables
*   **Requirement:** GitHub, custom dataset, dashboard, ≤6-page technical documentation and 3–10 minute demo.
*   **Spec:** Follow the structure defined in `19-RELEASE.md`.

---

## 4. Judging Priorities & Resource Allocation

The Hackathon weighting dictates where engineering effort should be spent.

### 4.1 Data Engineering & Stress Testing (30%)
*   **Priority:** Highest.
*   **Action:** Dedicate the first phase entirely to building the dataset generation and rights-verification pipeline. Do not build the UI until the dataset is solid.
*   **Success Metric:** Clean paired data, accurate temporal labels, robust flaw gradient.

### 4.2 Causal Explainability & Temporal Grounding (25%)
*   **Priority:** High.
*   **Action:** Build the `ScoringEngine` ruleset early. Ensure the math is sound before trying to make it look pretty.
*   **Success Metric:** Accurate timestamps and mathematical-to-human rationale.

### 4.3 Feature Extraction (20%)
*   **Priority:** Medium-High.
*   **Action:** Standardize the `FeatureExtractor` module using Librosa/PyTorch. Ensure it can handle stress cases (noise, overlapping speech).
*   **Success Metric:** Rigorous acoustic processing and stress-point detection.

### 4.4 Visualization & Dashboard (15%)
*   **Priority:** Medium.
*   **Action:** Use existing charting libraries to save time. Focus on the *sync* between the audio player and the charts.
*   **Success Metric:** Usable time-series overlays and explanations.

### 4.5 Reproducibility & Code Quality (10%)
*   **Priority:** Foundational.
*   **Action:** Use Docker from day one. Enforce strict typing (MyPy, TypeScript).
*   **Success Metric:** Deterministic, documented, deployable system.

---

## 5. Next Steps

This document maps directly to the JIRA/GitHub Issues board.
1.  Setup the Data Engineering epic (Section 4.1).
2.  Assign the `FeatureExtractor` spike (Section 4.3).
3.  Draft the `Flaw` object JSON schema (Section 3.6).

*End of REQUIREMENTS.md*
