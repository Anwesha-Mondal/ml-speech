# SPEECH ARENA: 00-VISION

## 1. Executive Summary and Philosophical Foundation

Speech Arena is not merely a tool; it is a paradigm shift in how we quantify, analyze, and improve human vocal delivery. For decades, the field of speech analytics has been dominated by Automatic Speech Recognition (ASR) engines—systems designed exclusively to transcribe the *content* of speech. These systems ask, "What was said?" Speech Arena pivots entirely to ask a much harder, inherently more nuanced question: "How was it said?"

In the context of the Multimodal AI Hackathon 2026 (Track C), the mandate is to build a platform rooted in **Contrastive Speech Analytics and Temporal Flaw Grounding**. This requires moving away from subjective human judgment ("you sound nervous," "you need more energy") and moving toward rigorous, deterministic, acoustic measurement.

The philosophical foundation of Speech Arena is built on three pillars:
1.  **Acoustic Determinism over Psychological Inference:** The system must never claim to know what the speaker is feeling. It only knows what the acoustic signal dictates. If a speaker's fundamental frequency (F0) variance drops by 40%, the system reports a "monotone delivery penalty," not a "boredom penalty."
2.  **Temporal Grounding as the Source of Truth:** A generalized score of "85/100" is useless for improvement. Every penalty must be anchored to a specific millisecond range in the audio and a specific word in the transcript.
3.  **Speaker-Agnostic Fairness:** A deep-voiced participant and a high-voiced participant must be evaluated fairly on their *relative* dynamic range and pitch control, not on absolute acoustic thresholds.

This document serves as the master vision for the product, outlining the core user journeys, the platform modes, and the boundary conditions for the system architecture.

---

## 2. Product Boundaries & Constraints

Before defining what Speech Arena *is*, it is critical to define what it *is not*. The Hackathon requirements impose strict boundaries to prevent the project from bloating into an unmanageable generic application.

### 2.1 The Anti-Goals
*   **NOT a Voice Cloning Tool:** Mimic Party and other comparative modes must explicitly evaluate delivery *patterns* (cadence, pause placement, emphasis). They must never evaluate or attempt to score biometric voice identity. The system must not be usable as a deepfake training tool.
*   **NOT an ASR Evaluator:** While we use ASR for forced alignment and clarity proxies, the primary goal is not to correct the user's transcript. We assume the user is reading a known prompt.
*   **NOT a Sentiment Analyzer:** We do not use NLP to determine if the speech is "happy" or "sad." We only evaluate the acoustic delivery mechanics.

### 2.2 System Invariants
*   **Invariant 1: The Reference Baseline:** Every evaluation must be contrastive. A participant's audio is always evaluated *against* a reference audio track for the same transcript, or against a statistically derived "ideal" baseline for that specific rhetorical mode.
*   **Invariant 2: Reproducibility:** If the exact same audio file is uploaded twice, the system must yield the exact same score, with the exact same temporal flaw timestamps, down to the millisecond.
*   **Invariant 3: Explainability:** Every deduction in score must be accompanied by a `Flaw` object containing the mathematical delta (e.g., `reference_rate: 3.5 wps, participant_rate: 5.2 wps -> delta: +1.7 wps`).

---

## 3. Comprehensive Product Modes

Speech Arena is designed to support a wide spectrum of use cases, from solitary practice to multiplayer gamification. The platform is divided into three primary categories: Training, Assessment, and Competition.

### 3.1 Training Modes

#### 3.1.1 Speech Test (The Sandbox)
**Concept:** A low-stakes environment for users to practice specific prompts and receive immediate, granular feedback.
**User Journey:**
1.  The user browses a library of pre-loaded, high-quality reference speeches (e.g., famous historical speeches, well-delivered TED (Note: RESEARCH_ONLY) talks).
2.  The user selects a prompt. The dashboard displays the transcript.
3.  The user records their attempt directly in the browser or uploads a pre-recorded file.
4.  The system aligns the user's audio with the transcript and extracts features.
5.  The system compares the user's features against the reference features.
6.  The user receives a score (0-100) and a timeline populated with visual "flaw markers."
7.  The user clicks a marker to reveal the explanation: "Your delivery became rushed here. Reference: 3.8 syllables/sec. Participant: 5.1 syllables/sec."

#### 3.1.2 You vs You (Improvement Tracking)
**Concept:** Evaluates a user's progress over multiple attempts at the same prompt.
**Mechanism:** The system sets the user's *first* attempt as the baseline (or uses a standard reference). Subsequent attempts are scored based on the delta improvement.
**Metrics:** The dashboard tracks the reduction in flaw density over time.

### 3.2 Assessment Modes

#### 3.2.1 The Interviewer
**Concept:** A dynamic mode where the user is asked questions and must respond.
**Mechanism:** 
*   The system plays an audio prompt (the interviewer).
*   The user responds.
*   **Scoring Focus:** Since there is no strict reference audio for a dynamic response, the system evaluates against a statistical "Professional Standard" baseline. It looks for excessive hesitation (fillers), irregular pacing, and clarity.

#### 3.2.2 News Anchor
**Concept:** Strict adherence to a teleprompter script.
**Mechanism:**
*   The user reads a scrolling script.
*   **Scoring Focus:** High emphasis on articulation, steady pacing, and authoritative pitch control (lack of pitch instability or "up-talk"). 

#### 3.2.3 Public Speaking & Storytelling
**Concept:** Evaluating longer-form, persuasive, or narrative delivery.
**Mechanism:**
*   **Scoring Focus:** Evaluates dynamic range. A storytelling delivery is penalized if the energy and pitch variance are too low (monotone). It rewards deliberate pauses used for dramatic effect (distinguishing them from hesitation pauses).

### 3.3 Competitive Modes (The Arena)

#### 3.3.1 1v1 Battle
**Concept:** Two users compete on the same prompt.
**Mechanism:** Both users record their delivery. The system normalizes both speakers' features to ensure fairness (e.g., neutralizing baseline pitch differences). The user with the delivery pattern closest to the reference, or with the fewest objective flaws, wins.

#### 3.3.2 Debate Round
**Concept:** Timed, multi-turn competition (Opening, Response, Rebuttal).
**Mechanism:** Combines delivery analytics with pacing constraints. Evaluates if the speaker maintained acoustic stability (stable pitch/energy) during rebuttals.

#### 3.3.3 Mimic Party (The Crown Jewel of Gamification)
**Concept:** A fun, social game where users try to exactly mimic the cadence and emphasis of a famous performance.
**Mechanism:**
*   The system extracts the pitch contour, energy envelope, and pause timings of the reference audio.
*   It normalizes the participant's audio.
*   It calculates a structural similarity score using Dynamic Time Warping (DTW) on the contours.
*   **Strict Rule:** It scores *how* the melody of the speech was matched, explicitly ignoring timbre and vocal tract characteristics to prevent biometric cloning.

---

## 4. User Personas

To guide the UI/UX design, we define four distinct target personas for Speech Arena.

### 4.1 Persona 1: "The Polisher" (Professional User)
*   **Profile:** An executive, lawyer, or salesperson preparing for a major presentation.
*   **Needs:** High-fidelity, objective feedback. They want to know exactly where they lost the audience's attention.
*   **Primary Modes:** Speech Test, Public Speaking.
*   **Key Feature:** The Zoomable Waveform Dashboard. They want to click on a specific sentence and see the exact mathematical delta for their pacing.

### 4.2 Persona 2: "The Competitor" (Gamified User)
*   **Profile:** A student or debate club member who thrives on leaderboards and XP.
*   **Needs:** Fast, fair comparison. They want to beat their friends.
*   **Primary Modes:** 1v1 Battle, Debate, Leaderboards.
*   **Key Feature:** Fair Speaker Normalization. They need to trust that the scoring engine isn't biased against their natural voice pitch.

### 4.3 Persona 3: "The Mimic" (Casual/Social User)
*   **Profile:** Someone playing with friends on a Friday night, trying to nail the exact delivery of a movie monologue or a famous historical quote.
*   **Needs:** Instant fun, easy-to-understand visual feedback.
*   **Primary Modes:** Mimic Party.
*   **Key Feature:** Visual contour matching. They want to see a line graph of their pitch perfectly overlapping the reference pitch.

### 4.4 Persona 4: "The Evaluator" (Admin/HR User)
*   **Profile:** A recruiter using the platform to screen candidates for communication skills.
*   **Needs:** Aggregate reports, standardized baselines, high reproducibility.
*   **Primary Modes:** Interview mode, Exportable Reports.
*   **Key Feature:** Reliability and lack of bias in the scoring algorithm.

---

## 5. UI/UX Vision: The Dashboard

The analysis screen is the most critical piece of software in the platform, accounting for 15% of the judging priority.

### 5.1 Layout Architecture
The dashboard must avoid the generic "audio player" look. It should feel like a professional audio engineering tool simplified for a layperson.

**Top Section: The Synchronized Player**
*   A scrolling transcript that highlights words exactly as the audio plays.
*   A master play/pause control.

**Middle Section: The Data View (The "Arena")**
*   **Layer 1:** The Reference Waveform (muted color, background).
*   **Layer 2:** The Participant Waveform (bright color, foreground).
*   **Layer 3:** Feature Overlays. The user can toggle lines for Pitch (F0) and Energy (RMS) to see how their delivery tracks against the reference.

**Bottom Section: The Flaw Timeline**
*   A dedicated track beneath the waveform filled with clickable warning icons (triangles for minor flaws, octagons for severe flaws).
*   Hovering over a flaw highlights the corresponding text in the transcript.

### 5.2 The Flaw Explanation Card
When a flaw is clicked, a modal or side-panel opens. It MUST contain:
1.  **Timestamp Range:** `[00:21.4 - 00:25.8]`
2.  **Transcript Context:** `"Four score and seven years ago"`
3.  **The Mathematical Evidence:** `Reference rate: 3.8 syl/sec | Participant: 5.1 syl/sec | Delta: +34%`
4.  **The Plain-Language Interpretation:** `"Your delivery became rushed."`
5.  **Actionable Advice:** `"Slow down before the key phrase and restore the reference pause."`

---

## 6. Architecture & Scalability Principles

While subsequent documents will detail the exact technical implementations, the product vision dictates several architectural mandates.

### 6.1 Asynchronous Processing
Speech processing (especially forced alignment and DTW) is computationally expensive. The system must never block the main thread.
*   Uploads must trigger background jobs.
*   The UI must provide real-time status updates (e.g., "Aligning audio...", "Extracting features...", "Generating explanations...").

### 6.2 Modular Scientific Pipeline
The engine must be built as a series of decoupled modules. The "Deviation Detector" must not care how the "Feature Extractor" got the F0 data. This modularity is required to support the Ablation Studies mandated by the Hackathon (e.g., testing the system with and without MFCC features).

### 6.3 Cost-Effective Storage
Audio files are large. The system must immediately convert uploaded audio to a standardized, compressed format (e.g., 16kHz mono OGG/FLAC) before processing, and cache the extracted feature arrays (JSON/NumPy) so the audio doesn't need to be re-processed on every page load.

---

## 7. The Ethical Mandate

Speech Arena operates in a sensitive domain. Evaluating human speech can inadvertently introduce biases if not engineered carefully.

*   **Bias Mitigation:** The requirement for Speaker Normalization (Section 13) is not just a technical constraint; it is an ethical one. The system must not penalize accents, natural pitch differences across genders, or inherent vocal timbres. It scores *relative temporal delivery mechanics*, not absolute acoustic ideals.
*   **Transparency:** The demand for "Mathematical evidence + plain-language explanation" ensures the system is not a black box. If a user receives a low score, they have the exact formula and variables that produced that score.

---
*End of VISION.md*


## Note
Interview/Debate modes are considered Post-MVP.