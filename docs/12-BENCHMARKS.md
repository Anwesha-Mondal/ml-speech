# SPEECH ARENA: 12-BENCHMARKS

## 1. Introduction

Evaluation and Benchmarking prove that the system works. Without rigorous evaluation, Speech Arena is just a collection of scripts. Section 15 requires tracking metrics across both the Dataset and the System, alongside mandatory Ablation studies and Human evaluation.

---

## 2. Dataset Metrics

When generating the custom contrastive corpus (Phase 2), the data engineering team must publish a manifest containing:
*   **Reference Speakers:** Count and demographic split.
*   **Transcripts:** Total word count, average duration.
*   **Contrastive Variants:** Total number of injected/recorded flaws per reference.
*   **Flaw/Severity Coverage:** A histogram proving a uniform distribution of severities [0.0 - 1.0] across all flaw types (Pacing, Pitch, etc.). If we only have "Perfect" and "Terrible" data without the middle ground, the dataset is rejected.
*   **Rights Completeness:** 100% of the public distribution bundle must have `redistribution_allowed = true` in the rights manifest.

---

## 3. System Metrics (The ML Evaluation)

How accurate is the Temporal Grounding and Flaw Classification?

### 3.1 Temporal Boundary Error / IoU
*   **Metric:** Intersection over Union (IoU).
*   **Definition:** `Area of Overlap / Area of Union` between the system-predicted flaw time window `[10.2s - 12.5s]` and the human-annotated ground truth window `[10.0s - 12.8s]`.
*   **Target:** `IoU > 0.85` on the test set.

### 3.2 Classification Metrics
*   **Metric:** Precision, Recall, and F1-Score for each flaw class (`PACING_FAST`, `PITCH_MONOTONE`, etc.).
*   **Speaker-Disjoint Generalization:** The F1 score must be calculated on a test set containing speakers the model has *never seen* in the training set.

### 3.3 Reliability Metrics
*   **False-Positive Rate:** When the system is fed the "Ideal Reference" audio against itself, does it hallucinate flaws? Target: `FPR < 0.01`.
*   **Repeated-Run Reproducibility:** Submit the same audio 10 times. The exact same timestamps, float values, and JSON explanations must be returned 10 times. Target: `100%`.

---

## 4. Ablation Studies

Section 15 mandates ablation studies. This means tearing parts of the system out to prove they were necessary.

1.  **F0 only vs multi-feature:** Train/run the flaw classifier using only pitch data. Record the F1 score. Then add Energy, Pauses, and MFCCs. Show the delta in F1 score to prove the multi-feature approach is scientifically superior.
2.  **Speaker normalization on/off:** Run the 1v1 Battle algorithm *without* Z-score normalization (comparing raw Hz). Show how it unfairly penalizes women or men. Then turn normalization on and show the corrected fairness metric.
3.  **MFCC/FFT contribution:** Prove that MFCCs are required to detect `CLARITY_REDUCED` (mumbling).
4.  **Rule-based vs learned explanation:** Document why the deterministic template engine (Section 10) produces 0% hallucinations compared to a test-run using an LLM.

---

## 5. Human Evaluation

Math is not the final arbiter of human speech. 
*   **Protocol:** We must use human raters to validate the severity scores output by the system.
*   **Mechanism:** Play an audio clip to 3 independent raters. Ask them to rate the pacing on a 1-5 scale. Compare the variance in human ratings to the system's severity output.
*   **Goal:** Calculate the `Pearson Correlation Coefficient` between the System Score and the Human Mean Opinion Score (MOS).

*End of BENCHMARKS.md*


## Updates (per Doc 20)
- Added stress suite.
- FPR protocol: ref vs clean cross-speaker pair.
- Human eval: Spearman + Krippendorff's alpha.