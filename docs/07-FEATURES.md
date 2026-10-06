# SPEECH ARENA: 07-FEATURES

## 1. Introduction

The Feature Extraction module translates a raw acoustic wave into a structured matrix of mathematical values. These features form the empirical evidence required to prove a speech flaw exists, adhering to the core principle: *Acoustic Fact over Psychological Fiction.*

This document specifies the exact features mandated by Section 13 of the hackathon prompt and how they must be calculated.

---

## 2. Core Feature Specifications

We use a sliding window approach. Features are extracted every `10ms` (hop length) over a `25ms` window (frame length).

### 2.1 Pitch / Fundamental Frequency (F0)
*   **Definition:** The rate of vibration of the vocal folds. Perceived as the "melody" of the voice.
*   **Extraction Method:** `pYIN` (Probabilistic YIN) algorithm via `librosa.pyin`. It is superior to standard YIN as it provides voiced/unvoiced probabilities, ignoring pitch calculations during silence.
*   **Metrics Derived:**
    *   `f0_median`: Used as the base for normalization.
    *   `f0_variance`: High = expressive; Low = monotone.
    *   `f0_range`: `95th percentile - 5th percentile`.
    *   `f0_contour`: The time-series array used for DTW comparison in Mimic Party.

### 2.2 Energy / RMS (Root Mean Square)
*   **Definition:** A proxy for perceived loudness or vocal effort.
*   **Extraction Method:** `librosa.feature.rms`.
*   **Metrics Derived:**
    *   `energy_dynamic_range`: Difference between loudest and quietest voiced frames.
    *   `energy_contour`: Time-series array.
    *   *Constraint:* Must be calculated *before* any dynamic range compression is applied to the audio file.

### 2.3 Speech Rate (Pacing)
*   **Definition:** Speed of delivery.
*   **Extraction Method:** Derived entirely from the output of the Forced Alignment module (see `06-ALIGNMENT.md`), NOT from acoustic DSP.
*   **Metrics Derived:**
    *   `words_per_minute (WPM)`: Standard pacing metric.
    *   `syllables_per_second (SPS)`: Requires a text-to-syllable dictionary (e.g., CMUDict). Much more accurate for pacing than WPM, as "a" and "antidisestablishmentarianism" are both one word.
    *   `local_acceleration`: The derivative of speech rate over a 5-second rolling window.

### 2.4 Pauses
*   **Definition:** Intervals of silence or non-speech.
*   **Extraction Method:** Derived from VAD (Voice Activity Detection) and Alignment gaps.
*   **Metrics Derived:**
    *   `pause_count`: Total number of pauses > 250ms.
    *   `pause_duration`: Length of each pause.
    *   `pause_ratio`: `total_pause_time / total_audio_time`.
    *   `grammatical_placement`: Boolean. Did the pause occur at a comma/period in the transcript?

### 2.5 Spectral Features (MFCC & FFT)
*   **Definition:** The "timbre" or "color" of the voice. The physical shape of the vocal tract.
*   **Extraction Method:** Fast Fourier Transform (FFT) and Mel-Frequency Cepstral Coefficients (MFCC).
*   **Metrics Derived:**
    *   `mfcc`: 13 coefficients. Used heavily by the machine learning models for generalized flaw classification (especially for clarity/mumbling).
    *   `spectral_centroid`: The "brightness" of the sound.
    *   `spectral_rolloff`: High frequencies (useful for detecting excessive sibilance / "S" sounds).

### 2.6 Clarity & Hesitation
*   **Definition:** Proxies for how understandable the speech is.
*   **Extraction Method:**
    *   `clarity_proxy`: The average confidence score output by the Wav2Vec2 forced aligner. If the model struggles to align the word despite knowing the text, the user likely mumbled.
    *   `hesitation_markers`: Acoustic detection of filler words (um, uh) using a specialized classifier trained on the `B-02 LibriSpeech` subset.

---

## 3. Data Structure & Storage

Feature extraction generates massive arrays. They must be stored efficiently.

*   **Format:** We do not store raw arrays in the PostgreSQL database.
*   **Storage:** Arrays are serialized as `.parquet` files and stored in AWS S3 (or local blob storage).
*   **Database Link:** The PostgreSQL `Performance` table stores the URL path to the `.parquet` file.

**Parquet Schema Example:**
| frame_index | time_sec | f0_hz | rms_energy | is_voiced | mfcc_1 ... mfcc_13 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | 0.00 | NaN | 0.001 | False | [array] |
| 1 | 0.01 | NaN | 0.002 | False | [array] |
| 150 | 1.50 | 120.5 | 0.450 | True | [array] |

---

## 4. Ablation Requirements

Section 15 demands ablation studies (e.g., "F0 only vs multi-feature"). 
*   **Implementation:** The ML training pipeline must accept a configuration flag dictating which columns of the Parquet file to load.
*   **Goal:** We must mathematically prove to the judges that adding MFCCs to the model improves Flaw Classification F1 scores compared to using F0 and Energy alone.

*End of FEATURES.md*
