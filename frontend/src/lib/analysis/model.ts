import type { ApiAnalysisResult, ApiFlaw, Bucket, Mode } from '../api/types'

export const SCORING_VERSION = 's1.0'

/** Bucket deduction caps, mirrored from packages/speech_arena/scoring/engine.py. */
export const BUCKETS: { key: Bucket; label: string; cap: number }[] = [
  { key: 'pacing', label: 'Pacing', cap: 15 },
  { key: 'pitch', label: 'Pitch control', cap: 15 },
  { key: 'pauses', label: 'Pauses', cap: 10 },
  { key: 'energy_clarity', label: 'Energy & clarity', cap: 10 },
]

export const MODES: { key: Mode; label: string; focus: string }[] = [
  { key: 'sandbox', label: 'Speech test', focus: 'All four buckets, weighted equally.' },
  { key: 'interviewer', label: 'Interviewer', focus: 'Hesitation, pauses and clarity.' },
  { key: 'news_anchor', label: 'News anchor', focus: 'Steady pacing, articulation, no rising terminals.' },
  { key: 'public_speaking', label: 'Public speaking', focus: 'Pacing, energy, pitch variation and pauses.' },
  { key: 'storytelling', label: 'Storytelling', focus: 'Dynamic range in pitch and energy.' },
]

export function modeLabel(mode: string): string {
  return MODES.find((m) => m.key === mode)?.label ?? mode
}

interface FlawMeta {
  label: string
  bucket: Bucket
  /** Approved interpretation text, docs/10-EXPLAINABILITY.md §3. */
  interpretation: string
  action: string
  marker: string
}

export const FLAW_META: Record<string, FlawMeta> = {
  PACING_TOO_FAST: {
    label: 'Pacing too fast',
    bucket: 'pacing',
    marker: 'Rushed',
    interpretation: 'The delivery became rushed and may reduce articulation clarity.',
    action: 'Slow down before the key phrase and restore the reference pause.',
  },
  PACING_TOO_SLOW: {
    label: 'Pacing too slow',
    bucket: 'pacing',
    marker: 'Dragging',
    interpretation: 'The delivery became sluggish and may lose listener momentum.',
    action: 'Tighten the phrase so it fits the reference duration.',
  },
  PAUSE_MISSING: {
    label: 'Missing pause',
    bucket: 'pauses',
    marker: 'Missing pause',
    interpretation:
      'A structural pause was omitted, which removes the intended rhetorical emphasis from the preceding phrase.',
    action: 'Hold a short pause at this boundary, as the reference does.',
  },
  PAUSE_EXCESSIVE: {
    label: 'Pause too long',
    bucket: 'pauses',
    marker: 'Long pause',
    interpretation: 'A pause interrupted the grammatical flow of the sentence.',
    action: 'Shorten the gap and carry the phrase through to its end.',
  },
  PITCH_MONOTONE: {
    label: 'Monotone pitch',
    bucket: 'pitch',
    marker: 'Monotone',
    interpretation:
      'Pitch variation decreased significantly, resulting in a monotone delivery that lacks dynamic engagement.',
    action: 'Let the pitch rise and fall across this phrase as the reference does.',
  },
  PITCH_INSTABILITY: {
    label: 'Unstable pitch',
    bucket: 'pitch',
    marker: 'Unstable',
    interpretation: 'Pitch variation increased erratically, which may be perceived as a lack of vocal control.',
    action: 'Keep the pitch steadier through the phrase.',
  },
  PITCH_UPTALK: {
    label: 'Rising terminal',
    bucket: 'pitch',
    marker: 'Up-talk',
    interpretation: 'Pitch rose at the end of a declarative sentence, which acoustically mimics a question.',
    action: 'Let the pitch fall at the end of the sentence.',
  },
  ENERGY_LOW: {
    label: 'Low energy',
    bucket: 'energy_clarity',
    marker: 'Low energy',
    interpretation: 'Vocal volume dropped near the noise floor, risking unintelligibility.',
    action: 'Keep projecting through the end of the phrase.',
  },
  ENERGY_SPIKE: {
    label: 'Energy spike',
    bucket: 'energy_clarity',
    marker: 'Spike',
    interpretation: 'Volume spiked abruptly outside the normal dynamic range.',
    action: 'Keep the volume within your normal range.',
  },
}

export function flawMeta(type: string): FlawMeta {
  return (
    FLAW_META[type] ?? {
      label: type.replace(/_/g, ' ').toLowerCase(),
      bucket: 'pacing',
      marker: type,
      interpretation: '',
      action: '',
    }
  )
}

export interface Word {
  text: string
  start: number
  end: number
}

export interface FlawEvidence {
  metric: string
  /** Lines shown in the explanation panel, already formatted with units. */
  rows: { label: string; value: string }[]
  deviation: string
}

export interface FlawRegion {
  id: string
  type: string
  bucket: Bucket
  start: number
  end: number
  /** Sum of the per-word penalties merged into this region (negative). */
  penalty: number
  /** Deterministic sentence(s) from the backend's explanation templates. */
  fact: string
  confidence: number | null
  word: string | null
  evidence: FlawEvidence | null
  count: number
}

export interface Contours {
  /** Frame times in seconds. */
  t: number[]
  pitchPart?: (number | null)[]
  pitchRef?: (number | null)[]
  energyPart?: number[]
  energyRef?: number[]
}

export interface Analysis {
  id: string
  createdAt: string
  source: 'live' | 'example'
  mode: string
  title: string
  referenceLabel: string
  transcript: string
  words: Word[] | null
  wordTimingEstimated: boolean
  duration: number
  /** Length of the uploaded reference recording, when one was given. */
  referenceDuration?: number
  score: { total: number; buckets: Record<Bucket, number> }
  flaws: FlawRegion[]
  scoringVersion: string
  jobId?: string
  /** Wall-clock time the server took, measured by polling. */
  serverSeconds?: number
  participantFile?: string
  /** Exactly what /api/jobs returned, for the data view. */
  raw?: ApiAnalysisResult
  /** Runtime-only (not persisted). */
  audio?: { participantUrl?: string; referenceUrl?: string }
  peaks?: { participant?: number[]; reference?: number[] }
  contours?: Contours
}

export function scoreSummary(total: number): string {
  if (total >= 90) return 'Close to the reference with few deviations.'
  if (total >= 75) return 'Good delivery with several localized deviations.'
  if (total >= 60) return 'Noticeable deviations in several places.'
  return 'Large deviations across most of the speech.'
}

export function normalizeBuckets(b: Partial<Record<Bucket, number>>): Record<Bucket, number> {
  return {
    pacing: b.pacing ?? 0,
    pitch: b.pitch ?? 0,
    pauses: b.pauses ?? 0,
    energy_clarity: b.energy_clarity ?? 0,
  }
}

function evidenceFromApi(f: ApiFlaw): FlawEvidence | null {
  const e = f.evidence
  if (!e) return null
  switch (e.metric) {
    case 'local_rate':
      return {
        metric: 'Local speech rate',
        rows: [{ label: 'Participant ÷ reference', value: `${e.participant_value.toFixed(2)}×` }],
        deviation: `${e.participant_value >= 1 ? '+' : '−'}${Math.abs((e.participant_value - 1) * 100).toFixed(0)}%`,
      }
    case 'st_range':
      return {
        metric: 'Pitch range (semitones)',
        rows: [{ label: 'Participant ÷ reference', value: `${e.participant_value.toFixed(2)}×` }],
        deviation: `${e.participant_value >= 1 ? '+' : '−'}${Math.abs((e.participant_value - 1) * 100).toFixed(0)}%`,
      }
    case 'following_pause':
      return {
        metric: 'Pause after the word',
        rows: [{ label: 'Longer than reference by', value: `${e.participant_value.toFixed(2)} s` }],
        deviation: `+${e.participant_value.toFixed(2)} s`,
      }
    case 'db_mean':
      return {
        metric: 'Mean energy (dB, relative)',
        rows: [{ label: 'Participant − reference', value: `${e.participant_value.toFixed(1)} dB` }],
        deviation: `${e.participant_value.toFixed(1)} dB`,
      }
    default:
      return {
        metric: e.metric,
        rows: [
          { label: 'Reference', value: e.reference_value.toFixed(2) },
          { label: 'Participant', value: e.participant_value.toFixed(2) },
        ],
        deviation: e.delta_rel.toFixed(2),
      }
  }
}

/**
 * The detectors emit one flaw per word. Consecutive flaws of the same type that touch
 * (gap ≤ 0.25 s) are shown as one marker; their penalties add up, as in the engine.
 */
export function groupFlaws(flaws: ApiFlaw[]): FlawRegion[] {
  // Sort by type, then time, so per-word flaws of one type merge even when the
  // detectors interleave several types word by word.
  const sorted = [...flaws].sort((a, b) => a.type.localeCompare(b.type) || a.start_time - b.start_time)
  const out: FlawRegion[] = []
  sorted.forEach((f, i) => {
    const prev = out[out.length - 1]
    const bucket = f.bucket ?? flawMeta(f.type).bucket
    if (prev && prev.type === f.type && f.start_time - prev.end <= 0.25) {
      prev.end = Math.max(prev.end, f.end_time)
      prev.penalty += f.penalty
      prev.count += 1
      if (f.word) prev.word = prev.word ? `${prev.word} ${f.word}` : f.word
      if (f.confidence != null) prev.confidence = Math.min(prev.confidence ?? 1, f.confidence)
      return
    }
    out.push({
      id: f.flaw_id ?? `f${i}`,
      type: f.type,
      bucket,
      start: f.start_time,
      end: f.end_time,
      penalty: f.penalty,
      fact: f.explanation,
      confidence: f.confidence ?? null,
      word: f.word ?? null,
      evidence: evidenceFromApi(f),
      count: 1,
    })
  })
  return out.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** Spread transcript words across the recording when the API returns no alignment. */
export function estimateWordTimes(transcript: string, duration: number): Word[] | null {
  const tokens = transcript.split(/\s+/).filter(Boolean)
  if (!tokens.length || duration <= 0) return null
  const lead = Math.min(0.3, duration * 0.05)
  const span = Math.max(duration - lead * 2, 0.1)
  const weights = tokens.map((t) => Math.max(t.replace(/[^\p{L}\p{N}]/gu, '').length, 1) + 1.5)
  const total = weights.reduce((a, b) => a + b, 0)
  let t = lead
  return tokens.map((text, i) => {
    const d = (weights[i] / total) * span
    const w = { text, start: t, end: t + d * 0.9 }
    t += d
    return w
  })
}

export function analysisFromApi(args: {
  id: string
  jobId: string
  result: ApiAnalysisResult
  mode: Mode
  title: string
  referenceLabel: string
  transcript: string
  duration: number
  participantFile: string
}): Analysis {
  const { result } = args
  const flaws = groupFlaws(result.flaws ?? [])
  const lastFlawEnd = flaws.reduce((m, f) => Math.max(m, f.end), 0)
  const duration =
    result.duration && result.duration > 0
      ? result.duration
      : args.duration > 0
        ? args.duration
        : Math.max(lastFlawEnd + 1, 1)

  const hasRealWords = Array.isArray(result.words) && result.words.length > 0
  const words: Word[] | null = hasRealWords
    ? (result.words as Word[])
    : estimateWordTimes(args.transcript, duration)

  return {
    id: args.id,
    createdAt: new Date().toISOString(),
    source: 'live',
    mode: args.mode,
    title: args.title,
    referenceLabel: args.referenceLabel,
    transcript: args.transcript,
    words,
    wordTimingEstimated: !hasRealWords,
    duration,
    score: { total: result.score.total, buckets: normalizeBuckets(result.score.buckets) },
    flaws,
    scoringVersion: SCORING_VERSION,
    jobId: args.jobId,
    participantFile: args.participantFile,
    raw: result,
    contours: result.contours ?? undefined,
  }
}
