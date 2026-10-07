# SPEECH ARENA: 04-DATASET-SPEC

## 1. Introduction

The defining characteristic of the Speech Arena platform is its **Custom Contrastive Dataset**. The hackathon explicitly forbids downloading a pre-existing generic speech dataset and submitting it as the primary corpus. 

This document defines the schema, taxonomy, and distribution of the dataset we must engineer. 

The core dataset must contain matched pairs: a "Reference" delivery of a transcript, and one or more "Flawed" mirrors of that exact same transcript, mapped to a severity ladder.

---

## 2. Flaw Taxonomy

The system must inject or explicitly record human speakers committing the following acoustic flaws. Each flaw type requires a distinct acoustic signature.

### 2.1 Pacing (Speech Rate)
*   `PACING_TOO_FAST`: Syllables per second significantly exceeds the baseline or comfortable comprehension limits (> ~4.5 syl/sec, depending on language/baseline).
*   `PACING_TOO_SLOW`: Syllables per second significantly drops (< ~2.5 syl/sec).
*   `PACING_IRREGULAR`: High variance in speech rate within a short window (e.g., rushing a phrase then abruptly slowing down).

### 2.2 Pauses
*   `PAUSE_EXCESSIVE`: Unwarranted silence intervals in the middle of grammatical phrases.
*   `PAUSE_MISSING`: Failing to pause at punctuation markers (commas, periods), leading to breathlessness.
*   `PAUSE_MISPLACED`: Pausing at syntactically incorrect locations (e.g., "The quick brown [PAUSE] fox jumps").

### 2.3 Pitch (F0)
*   `PITCH_MONOTONE`: Extremely low variance in fundamental frequency. The speaker sounds robotic or bored.
*   `PITCH_INSTABILITY`: Erratic, non-grammatical pitch jumps (e.g., unintentional vocal cracks, extreme "up-talk" ending every sentence like a question).

### 2.4 Energy (Loudness/RMS)
*   `ENERGY_LOW`: Consistently low volume relative to the noise floor (mumbling).
*   `ENERGY_EXCESSIVE`: Yelling or peaking the microphone unexpectedly.
*   `ENERGY_ABRUPT`: Sudden, unjustified spikes or drops in volume not tied to rhetorical emphasis.

### 2.5 Emphasis & Clarity
*   `EMPHASIS_MISPLACED`: Stressing the wrong word in a sentence, altering the meaning (e.g., "I didn't say *he* stole the money" vs "I didn't *say* he stole the money").
*   `CLARITY_REDUCED`: Dropping consonants, slurring words. (Proxy: ASR confidence drops significantly despite matching text).
*   `HESITATION`: Non-lexical fillers ("um", "ah") or lexical hesitations ("like", "you know").

---

## 3. The Severity Ladder

Every flawed variant must be graded on a continuous or ordinal severity scale `[0.0, 1.0]`. 

To train the evaluation model, we must engineer variants across the entire spectrum:

*   **0.0 - Ideal:** Matches or exceeds the reference performance.
*   **0.1-0.2 - Near-perfect:** A single, almost imperceptible flaw (e.g., one slightly rushed sentence).
*   **0.3-0.5 - Mild/Moderate:** Noticeable flaws that do not destroy comprehension but affect professionalism (e.g., consistent monotone, a few misplaced pauses).
*   **0.6-0.8 - Strong:** Intrusive flaws. Highly distracting pacing, extreme hesitation, significant clarity reduction.
*   **0.9-1.0 - Severe:** The speech is barely comprehensible or the delivery is entirely inappropriate for the context (e.g., screaming a eulogy).

---

## 4. Record Schema (Relational Representation)

The dataset is represented by the following structure.

### `identity`
*   `sample_id`: Unique ID for the specific audio file.
*   `parent_id`: ID of the reference audio (if this is a flawed variant).
*   `speaker_hash`: Anonymized hash of the speaker to ensure speaker-disjoint splits.
*   `transcript_id`: Foreign key to the exact text.
*   `version`: Dataset versioning string.

### `variant`
*   `is_reference`: Boolean.
*   `flaw_type`: From the taxonomy above (if applicable).
*   `severity`: Float `[0.0, 1.0]`.
*   `injected_interval`: `[start_time, end_time]` where the flaw was intentionally placed.

### `alignment`
*   `word_timestamps`: JSON array `[{word: "The", start: 0.1, end: 0.3}, ...]`
*   `phoneme_timestamps`: Detailed phonetic breakdown.
*   `method`: "MFA", "Wav2Vec2", "Human".
*   `confidence`: Float.

### `features` (Links to external numpy/parquet files)
*   `F0_path`: Path to pitch array.
*   `energy_path`: Path to RMS array.
*   `MFCC_path`: Path to MFCC matrix.

### `split`
*   `dataset_split`: `train`, `dev`, `test`.
*   `speaker_disjoint_flag`: Boolean (Is this speaker in any other split?)
*   `leakage_group`: ID used to group all variants of a transcript together.

---

## 5. Data Leakage Prevention (CRITICAL)

The dataset must pass strict leakage checks before training or evaluation.

1.  **Parent Transcript Isolation:** If the transcript "JFK_Moon_Speech" is assigned to the `train` split, ALL audio variants (the reference, the monotone version, the fast version, the hesitation version) must go into the `train` split. If a variant leaks into `test`, the model will artificially overfit on the text alignment.
2.  **Speaker-Disjoint Testing:** The `test` set must contain speakers who do NOT appear in the `train` set. This proves the system can generalize to new voices and isn't just memorizing acoustic profiles.
3.  **Hash Verification:** Run exact deduplication on text and audio hashes (`SHA-256`) to ensure no accidental overlaps.

*End of DATASET-SPEC.md*


## Updates (per Doc 20)
- Added fields: `inserted_tokens`, `time_map_path`, `resynth_chain`, `severity_params`.
- Split algorithm: Connected-component splits over speaker<->transcript graph.