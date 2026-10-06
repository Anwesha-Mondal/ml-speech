# SPEECH ARENA: 11-SCORING

## 1. Introduction

The Scoring module aggregates all temporal flaws into a final, user-facing numerical value. 

Requirement 12 mandates: *"Start with interpretable components... Version the weights. Every 0–100 score must be decomposable into measurable components."*

This document defines the mathematical formula for computing the final score.

---

## 2. Decomposable Scoring Architecture

A final score of `82/100` means nothing if the user doesn't know *why* they lost 18 points. The score is calculated via a deduction model.

### 2.1 The Baseline Score
Every participant starts with a base score of `100`. Points are deducted based on detected flaws.

### 2.2 Component Buckets
The 100 points are conceptually divided into measurable buckets. The exact weights are versioned (e.g., `Scoring_v1.0`).

| Component | Max Penalty | Flaw Types Included |
| :--- | :--- | :--- |
| **Pacing** | -25 points | `PACING_TOO_FAST`, `PACING_TOO_SLOW`, `PACING_IRREGULAR` |
| **Pitch Control** | -25 points | `PITCH_MONOTONE`, `PITCH_INSTABILITY` |
| **Pauses** | -20 points | `PAUSE_EXCESSIVE`, `PAUSE_MISSING`, `PAUSE_MISPLACED` |
| **Energy & Clarity**| -30 points | `ENERGY_LOW`, `CLARITY_REDUCED`, `HESITATION`, `EMPHASIS_MISPLACED` |

### 2.3 The Deduction Formula
For every `Flaw` object passed by the Temporal Grounding module, a penalty is calculated.

`Penalty = Base_Weight * Severity * Duration_Factor * Confidence`

*   `Base_Weight`: A fixed scalar for the flaw type (e.g., `PITCH_MONOTONE` might have a base weight of 10).
*   `Severity`: Float `[0.0, 1.0]` calculated from the acoustic delta.
*   `Duration_Factor`: If a user is monotone for 5 seconds vs 50 seconds, the penalty must scale. `Duration_Factor = min(1.0, flaw_duration_sec / max_duration_cap_sec)`.
*   `Confidence`: If the aligner is only 70% sure about the word boundary due to noise, the penalty is softened by `0.70`.

```python
def calculate_final_score(flaws, scoring_config_version):
    config = load_scoring_weights(scoring_config_version)
    total_penalty = 0.0
    component_breakdown = {"pacing": 0, "pitch": 0, "pauses": 0, "energy_clarity": 0}
    
    for flaw in flaws:
        penalty = config[flaw.type].base_weight * flaw.severity * calculate_duration_factor(flaw) * flaw.confidence
        
        # Apply penalty to specific bucket
        bucket = config[flaw.type].bucket
        component_breakdown[bucket] += penalty
        
        total_penalty += penalty
        
    final_score = max(0.0, 100.0 - total_penalty)
    return final_score, component_breakdown
```

---

## 3. Product Mode Variations

The scoring weights must change depending on the Product Mode (Section 4).

*   **News Anchor Mode:** Weight for `PACING` and `CLARITY` is increased. Weight for `PITCH_VARIANCE` is decreased (anchors are typically steadier).
*   **Storytelling Mode:** Weight for `PITCH_VARIANCE` and `PAUSES` is massively increased to reward dynamic, dramatic delivery.
*   **Mimic Party:** Uses an entirely different algorithm. Instead of a deduction model, it uses a structural similarity index (SSIM) or pure Dynamic Time Warping (DTW) distance mapped to a 0-100 scale, as it only cares about matching the reference contour shape exactly.

---

## 4. Versioning

Every score generated MUST store the `scoring_version` in the database.
If we adjust the `Base_Weight` for Pacing from 10 to 12 in `v1.1`, old scores calculated under `v1.0` must not automatically update, ensuring historical leaderboards remain mathematically sound based on the rules at the time of the attempt.

*End of SCORING.md*
