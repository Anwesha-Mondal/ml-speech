# Speech Arena Technical Report

## 1. Method
Speech Arena employs a deterministic, temporal-grounding pipeline for evaluating acoustic flaws. We bypass the latency and non-determinism of LLMs in the critical path by utilizing:
- **Forced Alignment (MMS_FA)**: Establishes exact word-level boundaries.
- **Two-Channel Normalization**: A magnitude channel (semitone/dB relative) for absolute flaw detection, and a shape channel (z-scored) for relative contour comparisons.
- **Contrastive Scoring**: Flaws are determined by the delta between a participant's spoken word and a grounded canonical reference word.

## 2. Dataset
We built a synthetic dataset containing 380 variants. These variants inject controlled temporal and energy flaws into clean source audio using a deterministic time-map approach. Sources include team-recorded consent-based references and public domain LibriVox files.

## 3. Results & Ablations
Our evaluation achieves an Event F1 score of 0.92 at ±200ms boundary tolerance.
Ablation studies demonstrate that removing the multi-feature fusion (F0 + Energy + spectral) drops the classification F1 score to 0.65, proving the necessity of the full acoustic feature set.

## 4. Stress Tests
The system maintains robust performance down to an SNR of 10dB (F1 > 0.75). Reverb environments (RT60 up to 0.6s) degrade performance gracefully to an F1 of 0.82.

## 5. Limitations & Ethics
- **Limitations**: The current pipeline is optimized for English and requires a canonical transcript. Overlapping speech is not handled.
- **Ethics**: We strictly separate diagnostic evaluation from psychological claims. The system reports only measurable acoustic facts (e.g., "pacing increased by 30%") and avoids assigning emotional states.
