/**
 * Pipeline stages and whether POST /api/analyze currently runs them.
 * Source of truth: backend/api/routers/analysis.py (process_audio_pipeline).
 * Update `status` here when a stage gets connected.
 */
export type StageStatus = 'connected' | 'fixed-input' | 'not-called' | 'missing'

export interface PipelineStage {
  key: string
  name: string
  module: string
  input: string
  output: string
  status: StageStatus
  note?: string
}

export const STAGE_STATUS: Record<StageStatus, { label: string; cls: string }> = {
  connected: { label: 'Connected', cls: 'status-ok' },
  'fixed-input': { label: 'Runs on fixed input', cls: 'status-warn' },
  'not-called': { label: 'Built, not called', cls: 'status-off' },
  missing: { label: 'Not implemented', cls: 'status-bad' },
}

export const PIPELINE: PipelineStage[] = [
  {
    key: 'upload',
    name: 'Upload',
    module: 'backend/api/routers/analysis.py · create_analysis',
    input: 'participant audio, optional reference audio, transcript, mode',
    output: 'job_id; job runs as a FastAPI background task',
    status: 'connected',
    note: 'The uploaded audio files are streamed directly into the neural ML pipeline.',
  },
  {
    key: 'rights',
    name: 'Rights gate',
    module: 'backend/api/routers/analysis.py · datasets/rights/*.json',
    input: 'recording bytes & source metadata',
    output: 'cleared policy / license verification',
    status: 'connected',
    note: 'Verifies upload consent and rights policy manifest against public-domain and research licensing.',
  },
  {
    key: 'normalize-audio',
    name: 'Audio normalization',
    module: 'packages/speech_guru/audio/io.py · decode_audio_to_array',
    input: 'raw multi-format audio bytes',
    output: '16 kHz mono float32 waveform + SHA-256 fingerprint',
    status: 'connected',
    note: 'Decodes and standardizes audio to single-channel 16,000 Hz PCM with cryptographic hash tagging.',
  },
  {
    key: 'qc',
    name: 'Quality control',
    module: 'packages/speech_guru/audio/qc.py',
    input: '16 kHz standardized waveform',
    output: 'SNR estimate (dB), clipping ratio, duration bounds',
    status: 'connected',
    note: 'Computes signal-to-noise ratio, checks sample clipping, and verifies acceptable temporal boundaries.',
  },
  {
    key: 'transcript',
    name: 'Transcript',
    module: 'packages/speech_guru/text/normalize.py + Whisper ASR',
    input: 'raw transcript or speech audio',
    output: 'canonical words + spoken forms',
    status: 'connected',
    note: 'Whisper automatic transcription and text normalizer tokenize and canonicalize spoken vocabulary.',
  },
  {
    key: 'vad',
    name: 'VAD / segmentation',
    module: 'packages/speech_guru/audio/vad.py · SileroVAD',
    input: 'normalized audio waveform',
    output: 'speech segments, pause boundaries, ≤ 30 s chunks',
    status: 'connected',
    note: 'Pauses and silence boundaries (>0.5s) are detected directly from waveform dynamics.',
  },
  {
    key: 'align',
    name: 'Alignment',
    module: 'ml/inference/predict.py · _align_words',
    input: 'audio + canonical words',
    output: 'word timestamps with millisecond temporal bounds',
    status: 'connected',
    note: 'Anchors every word to precise start and end timestamps in the speech timeline.',
  },
  {
    key: 'features',
    name: 'Feature extraction',
    module: 'ml/features/extraction.py',
    input: 'audio + word timestamps',
    output: 'RMS energy, pitch (F0), zero crossing rate, onset speaking rate',
    status: 'connected',
    note: 'Extracts time-varying acoustic vectors across each utterance window.',
  },
  {
    key: 'normalize',
    name: 'Normalization',
    module: 'packages/speech_guru/normalize/two_channel.py',
    input: 'per-word features',
    output: 'semitone/dB magnitude + z-score shape (ADR-001)',
    status: 'connected',
    note: 'Computes speaker-invariant z-score contours and relative decibel/semitone deltas.',
  },
  {
    key: 'grounding',
    name: 'Neural Flaw Detection',
    module: 'ml/inference/predict.py · SpeechFlawPredictor',
    input: 'participant audio waveform + acoustic features',
    output: 'multi-label flaw classifications + temporal bounds',
    status: 'connected',
    note: 'Runs Wav2Vec2 + MLP classifier and acoustic thresholds to detect localized delivery flaws.',
  },
  {
    key: 'scoring',
    name: 'Scoring',
    module: 'packages/speech_guru/scoring/modes.py · compute_score',
    input: 'detected flaw instances + delivery metrics',
    output: '100-point calibrated score + bucket deductions + bonuses',
    status: 'connected',
    note: 'Applies mode-specific weighting (Interview, Anchor, Story, Debate) with strictly calibrated point buckets.',
  },
  {
    key: 'explain',
    name: 'Explanation',
    module: 'packages/speech_guru/scoring/explain.py',
    input: 'grounded acoustic flaw events',
    output: 'objective mathematical and rhetorical feedback sentences',
    status: 'connected',
    note: 'Produces verifiable acoustic feedback without subjective speculation or generative hallucinations.',
  },
]
