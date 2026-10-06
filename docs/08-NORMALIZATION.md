# SPEECH ARENA: 08-NORMALIZATION

## 1. Introduction

Speaker Normalization is the great equalizer of Speech Arena. Without it, the system cannot function fairly. 

If we compare a 20-year-old female participant reading a speech to a reference audio of a 60-year-old male, the absolute acoustic features (pitch, energy) will be drastically different. If we do not normalize, the system will incorrectly penalize the female speaker for having a higher pitch, completely failing to evaluate her *delivery mechanics*.

This document outlines the mandatory normalization techniques required to achieve "Speaker-agnostic normalization of pitch and energy" (Requirement 2.8).

---

## 2. Pitch (F0) Normalization

Pitch is highly idiosyncratic. The average male fundamental frequency ranges from 85 to 180 Hz, while the average female ranges from 165 to 255 Hz.

### 2.1 The Baseline Calculation
Before normalization, we must establish the speaker's baseline.
1.  **Extract F0:** Run `pYIN` over the entire audio file.
2.  **Filter Unvoiced:** Discard all frames where the speaker is silent or speaking unvoiced consonants (s, f, th).
3.  **Calculate Statistics:** Compute the `median` and `standard_deviation` (std) of the voiced F0 values.

*Why Median?* Mean is highly susceptible to extreme outliers (e.g., a sudden vocal crack or cough). Median provides a robust center point.

### 2.2 Z-Score Normalization
We apply standard Z-score normalization to map the speaker's absolute pitch into a relative distribution.

```python
import numpy as np

def normalize_pitch(f0_raw: np.ndarray) -> np.ndarray:
    # f0_raw contains NaN for unvoiced frames
    f0_voiced = f0_raw[~np.isnan(f0_raw)]
    
    if len(f0_voiced) == 0:
        return f0_raw # Fallback for pure silence
        
    median_f0 = np.nanmedian(f0_raw)
    std_f0 = np.nanstd(f0_raw)
    
    # Avoid division by zero for perfectly monotone synthetic speech
    if std_f0 < 1e-5: std_f0 = 1.0 
    
    # Normalize: (Value - Median) / Standard Deviation
    f0_normalized = (f0_raw - median_f0) / std_f0
    
    return f0_normalized
```

**Interpretation:** An `f0_normalized` value of `0` means the speaker is speaking at their average pitch. A value of `+1.5` means they have raised their pitch significantly (likely for emphasis). We can now directly compare the participant's normalized sequence to the reference's normalized sequence.

### 2.3 Semitone Conversion (Optional but Recommended)
Human hearing perceives pitch logarithmically, not linearly. A 20Hz jump from 100Hz to 120Hz sounds massive. A 20Hz jump from 800Hz to 820Hz is barely noticeable.

*   **Implementation:** Convert Hz to MIDI Semitones before computing the Z-score.
*   `semitones = 12 * log2(f0_hz / reference_frequency)`

---

## 3. Energy (RMS) Normalization

Energy (loudness) is affected by the speaker's voice, the microphone distance, and the hardware gain. 

### 3.1 Peak vs. RMS Normalization
*   **Peak Normalization (Avoid):** Scaling the audio so the loudest peak hits 0dBFS. This is a mastering technique, useless for our analytics because one cough will scale down the entire speech.
*   **RMS Normalization (Required):** We normalize the Root Mean Square energy.

### 3.2 Min-Max Scaling for Energy Envelopes
Unlike pitch, we often want to bound energy between `[0, 1]` to compare the "shape" of the loudness contour.

```python
def normalize_energy(rms_raw: np.ndarray) -> np.ndarray:
    # 1. Smooth the RMS contour to remove micro-spikes (e.g., plosive breath pops)
    rms_smoothed = apply_savgol_filter(rms_raw, window_length=11, polyorder=3)
    
    # 2. Find practical bounds (ignore the absolute extremes using percentiles)
    min_val = np.percentile(rms_smoothed, 5) # Noise floor proxy
    max_val = np.percentile(rms_smoothed, 95) # Shout proxy
    
    # 3. Clip and Min-Max scale
    rms_clipped = np.clip(rms_smoothed, min_val, max_val)
    rms_normalized = (rms_clipped - min_val) / (max_val - min_val)
    
    return rms_normalized
```

---

## 4. Preservation & Auditability

**CRITICAL RULE (Section 13):** *"Preserve both raw and normalized features so the analysis remains auditable."*

When saving the `.parquet` file to AWS S3 (as defined in `07-FEATURES.md`), the schema must contain distinct columns:
*   `f0_hz_raw`
*   `f0_zscore_normalized`
*   `rms_raw`
*   `rms_minmax_normalized`

If a user contests their score on the dashboard, the backend team must be able to load the Parquet file and prove that the normalization math was executed correctly.

*End of NORMALIZATION.md*
