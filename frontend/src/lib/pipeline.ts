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
    module: 'datasets/rights/*.json',
    input: 'asset ID',
    output: 'allow / research-only / reject',
    status: 'missing',
    note: 'Rights are recorded per asset, but no code checks them during analysis.',
  },
  {
    key: 'normalize-audio',
    name: 'Audio normalization',
    module: 'packages/speech_arena/audio/io.py',
    input: 'any audio format',
    output: '16 kHz mono WAV + SHA-256',
    status: 'not-called',
  },
  {
    key: 'qc',
    name: 'Quality control',
    module: 'packages/speech_arena/audio/qc.py',
    input: 'normalized audio',
    output: 'SNR estimate, clipping ratio',
    status: 'not-called',
  },
  {
    key: 'transcript',
    name: 'Transcript',
    module: 'packages/speech_arena/text/normalize.py',
    input: 'raw transcript',
    output: 'canonical words + spoken forms',
    status: 'connected',
    note: 'Transcripts are tokenized and aligned across the audio timeline.',
  },
  {
    key: 'vad',
    name: 'VAD / segmentation',
    module: 'packages/speech_arena/audio/vad.py',
    input: 'normalized audio',
    output: 'speech segments, ≤ 30 s chunks',
    status: 'connected',
    note: 'Pauses and silence boundaries (>0.5s) are detected directly from waveform dynamics.',
  },
  {
    key: 'align',
    name: 'Alignment',
    module: 'ml/inference/predict.py · _align_words',
    input: 'audio + canonical words',
    output: 'word timestamps with temporal bounds',
    status: 'connected',
  },
  {
    key: 'features',
    name: 'Feature extraction',
    module: 'ml/features/extraction.py',
    input: 'audio + word timestamps',
    output: 'RMS energy, pitch (F0), zero crossing rate, onset speaking rate',
    status: 'connected',
  },
  {
    key: 'normalize',
    name: 'Normalization',
    module: 'packages/speech_arena/normalize/two_channel.py',
    input: 'per-word features',
    output: 'semitone/dB magnitude + z-score shape (ADR-001)',
    status: 'not-called',
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
    module: 'packages/speech_arena/scoring/engine.py',
    input: 'flaws',
    output: 'total + capped bucket deductions (s1.0)',
    status: 'connected',
  },
  {
    key: 'explain',
    name: 'Explanation',
    module: 'packages/speech_arena/scoring/explain.py',
    input: 'flaw',
    output: 'template sentence (Jinja2)',
    status: 'connected',
  },
]
