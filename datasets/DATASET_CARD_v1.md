# Speech Arena Dataset Card

## Overview

The Speech Arena dataset suite provides grounded acoustic evaluation benchmarks and training corpora for objective speech flaw detection. It combines seed utterances with deterministic acoustic perturbation pipelines to produce rigorously ground-truthed speech samples.

- **Initial Synthetic Prototype (v1.0):** 380 variants across 5 synthetic reference speakers and 6 basic flaw categories.
- **Tier 1 Scaled Real-World Corpus (v1.1 - Current Production):** 1,680 physical 16 kHz mono `.wav` files derived from 40 human speakers across 7 balanced flaw categories.

---

## Tier 1 Real-World Dataset Specification (v1.1)

### 1. Provenance & Seeds
- **Source Corpus:** OpenSLR LibriSpeech `dev-clean` (SLR12).
- **Archive Size on Disk:** 322 MB archive containing 2,703 clean human speech `.flac` utterances.
- **Ingested Clean Seeds:** 240 high-SNR clean utterances sampled across 40 real speakers (balanced at 6 utterances per speaker).
- **Synthesis Ratio:** 1:7 (each clean seed produces 1 pristine `IDEAL` sample + 6 distinct acoustic flaw variants).
- **Total Physical Audio Files:** 1,680 files stored at `ml/data/audio/`.

### 2. Audio Format
- **Format:** Linear PCM `.wav`
- **Sampling Rate:** 16,000 Hz (16 kHz)
- **Bit Depth:** 16-bit
- **Channels:** Single-channel Mono
- **Normalization:** Dual-channel normalization with peak scaling safeguarding dynamic range.

### 3. Flaw Taxonomy & Class Balance
All 7 flaw categories are strictly balanced across both training and validation sets:

| Flaw Category | Description / Acoustic Signature | Train Samples | Val Samples | Total |
| :--- | :--- | :--- | :--- | :--- |
| **IDEAL** | Pristine human speech, natural pacing (130–160 WPM), optimal energy & dynamic pitch | 192 | 48 | 240 |
| **TOO_FAST** | Pacing accelerated via phase-vocoder time-stretch (>190 WPM / 1.35x speed) | 192 | 48 | 240 |
| **TOO_SLOW** | Pacing decelerated via phase-vocoder time-stretch (<110 WPM / 0.75x speed) | 192 | 48 | 240 |
| **LOW_ENERGY** | Attenuated signal volume (< -26 dBFS RMS, suppressed vocal projection) | 192 | 48 | 240 |
| **HIGH_ENERGY** | Over-amplified vocal signal (> -12 dBFS RMS, harsh projection / clipping boundary) | 192 | 48 | 240 |
| **MONOTONE** | F0 pitch contour flattened to median fundamental frequency (pitch variance < 5 Hz) | 192 | 48 | 240 |
| **EXCESSIVE_PAUSE** | Unnatural intra-sentence silence blocks (silence insertion > 800 ms) | 192 | 48 | 240 |
| **Total** | | **1,344** | **336** | **1,680** |

---

## Dataset Splits & Speaker Independence

To ensure robust evaluation and prevent acoustic identity leakage:
- **Speaker Disjointness:** Strictly enforced by speaker ID. No speaker appears in both train and validation sets.
- **Split Ratio:** 80% Train / 20% Validation.
- **Training Set (`ml/data/manifests/train.csv`):**
  - **Speakers:** 32 distinct human speakers (IDs: 1272, 1462, 1673, 174, 1919, 1988, 1993, 2035, 2078, 2086, 2277, 2412, 2428, 251, 2803, 2902, 3000, 3081, 3170, 3570, 3575, 3729, 3853, 4077, 4446, 4507, 4970, 4992, 5105, 5142, 5338, 5694).
  - **Volume:** 1,344 samples (192 per class).
- **Validation Set (`ml/data/manifests/val.csv`):**
  - **Speakers:** 8 unseen human speakers (IDs: 588, 6241, 6313, 6345, 652, 777, 8297, 84).
  - **Volume:** 336 samples (48 per class).

---

## Manifest Schema

Manifest files are formatted as CSV with the following columns:
- `file_path`: Absolute path to the 16 kHz `.wav` audio file.
- `flaws`: Ground-truth flaw label (`IDEAL`, `TOO_FAST`, `TOO_SLOW`, `LOW_ENERGY`, `HIGH_ENERGY`, `MONOTONE`, `EXCESSIVE_PAUSE`).
- `speaker_id`: Unique speaker identifier from OpenSLR LibriSpeech.
- `split`: Partition assignment (`train` or `val`).
- `source`: Dataset origin identifier (`OpenSLR_LibriSpeech`).

---

## Benchmark & Model Performance

Trained using `train_classifier.py` with frozen Wav2Vec2 encoder (`facebook/wav2vec2-base`) and multi-label classifier head:
- **Epochs:** 35 epochs on NVIDIA GeForce GTX 1650 (`cuda`).
- **Optimal Checkpoint:** Epoch 24
- **Train Loss:** `0.1459`
- **Validation Loss:** `0.1357` (global minimum across all runs).
- **Active Weights:** `ml/checkpoints/best_checkpoint.pt`

## Runtime Integration

The FastAPI `/api/analyze` job loads `ml/inference/predict.py`, which uses the
Tier 1 seven-class configuration in `ml/configs/labels.yaml`. The production
checkpoint and generated audio are intentionally excluded from Git because of
their size; provision them on the backend host before starting analysis:

```powershell
python ml/scripts/prepare_real_dataset.py --max-seeds 240
python ml/training/train_classifier.py --epochs 35
```

The predictor prefers `ml/checkpoints/best_checkpoint.pt` and rejects missing
or incompatible checkpoints rather than running an untrained classifier.
