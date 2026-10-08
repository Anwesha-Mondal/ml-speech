# Speech Arena ML Architecture

## Overview
Speech Arena uses a hybrid ML approach to detect speech delivery flaws (pacing, energy, intonation) rather than just speech recognition (ASR).

## Core Architecture
We avoid training a full speech model from scratch. Instead, we use **Wav2Vec2** as a frozen feature extractor and attach a custom multi-label classification head.

```text
                    USER AUDIO
                         │
                         ▼
                 AUDIO PREPROCESSING
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       SIGNAL FEATURES        SPEECH ENCODER
       (pitch, energy,        (Wav2Vec2 frozen)
        duration)                   │
              │                     │
              └──────────┬──────────┘
                         ▼
                 FEATURE FUSION
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          FLAW HEAD   SEVERITY   TEMPORAL
                        HEAD      HEAD
```

## Components
1. **Pretrained Encoder:** Hugging Face `facebook/wav2vec2-base` (Frozen during initial training to save compute).
2. **Feature Fusion Layer:** Combines Wav2Vec2 embeddings with classical acoustic features (extracted via `librosa`/`parselmouth`) for robust prosody analysis.
3. **Flaw Classifier (MLP):** A multi-label PyTorch classification head outputting probabilities for 15+ speech flaw classes.
4. **Dataset Augmentation:** Since labeled flawed speech is rare, we synthetically generate flaws (e.g., speed up audio for `TOO_FAST`, flatten pitch for `MONOTONE`) from clean reference audio.

## Current Progress
- `ml/configs`: Contains label definitions.
- `ml/models`: Contains the PyTorch architecture for the Flaw Classifier.
- `ml/datasets`: Data loading and synthetic augmentation scripts.
- `ml/training`: Training loops and evaluation scripts.
