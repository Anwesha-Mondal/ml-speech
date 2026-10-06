# System Card: Speech Arena v1.0.0

## Model Details
- **Architecture**: Contrastive deterministic scoring over forced alignment and feature extraction.
- **Dependencies**: Silero VAD, torchaudio MMS_FA, Parselmouth (Praat), Librosa.

## Intended Use
- Analyzing single-speaker speech against a known canonical reference.
- Providing deterministic, timestamped acoustic feedback.

## Out-of-Scope Uses
- Real-time emotional or psychological analysis.
- Multi-speaker diarization or overlapping speech evaluation.

## Ethical Considerations
- No generative AI is used to hallucinate scores.
- All feedback is strictly acoustically grounded.
