import type { Analysis, Contours, FlawRegion, Word } from './model'
import { SCORING_VERSION } from './model'

/**
 * A built-in example so the analysis workstation can be explored without the backend.
 * Every screen that shows it labels it "Example". Timings and values are illustrative,
 * shaped like the engine's output; penalties use the engine's per-word values.
 */
export const EXAMPLE_ID = 'example-gettysburg'

const TEXT =
  'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function buildWords(): Word[] {
  const tokens = TEXT.split(' ')
  const words: Word[] = []
  let t = 0.45
  tokens.forEach((tok, i) => {
    const letters = tok.replace(/[^A-Za-z]/g, '').length
    let d = 0.13 + 0.052 * letters
    if (i >= tokens.length - 3) d *= 0.68 // the rushed ending
    words.push({ text: tok, start: t, end: t + d })
    t += d + 0.04
    if (tok.endsWith(',')) t += 0.26
    if (tok.endsWith('.')) t += 0.62
    if (tok === 'Now') t += 0.92 // the over-long pause
  })
  return words
}

function idx(words: Word[], text: string, from = 0): number {
  const i = words.findIndex((w, k) => k >= from && w.text.replace(/[^A-Za-z]/g, '') === text)
  return i < 0 ? 0 : i
}

function region(
  words: Word[],
  a: number,
  b: number,
  base: Omit<FlawRegion, 'start' | 'end' | 'word'>,
  endOverride?: number,
): FlawRegion {
  return {
    ...base,
    start: words[a].start,
    end: endOverride ?? words[b].end,
    word: words
      .slice(a, b + 1)
      .map((w) => w.text.replace(/[.,]/g, ''))
      .join(' '),
  }
}

function buildFlaws(words: Word[]): FlawRegion[] {
  const conceived = idx(words, 'conceived')
  const created = idx(words, 'created')
  const now = idx(words, 'Now')
  const can = idx(words, 'can', now)
  return [
    region(words, conceived, conceived + 2, {
      id: 'ex-pitch',
      type: 'PITCH_MONOTONE',
      bucket: 'pitch',
      penalty: -9,
      count: 3,
      confidence: 0.93,
      fact: "Your delivery on 'conceived in Liberty' lacked pitch variance. Pitch variance was heavily compressed.",
      evidence: {
        metric: 'Pitch range (semitones)',
        rows: [
          { label: 'Reference', value: '6.2 st' },
          { label: 'Participant', value: '2.4 st' },
        ],
        deviation: '−61%',
      },
    }),
    region(words, created, created + 1, {
      id: 'ex-energy',
      type: 'ENERGY_LOW',
      bucket: 'energy_clarity',
      penalty: -3,
      count: 2,
      confidence: 0.74,
      fact: "Your volume dropped significantly on 'created equal'. Drop in energy > 5dB compared to reference.",
      evidence: {
        metric: 'Mean energy (dB, relative)',
        rows: [
          { label: 'Reference', value: '−14.0 dB' },
          { label: 'Participant', value: '−22.5 dB' },
        ],
        deviation: '−8.5 dB',
      },
    }),
    region(
      words,
      now,
      now,
      {
        id: 'ex-pause',
        type: 'PAUSE_EXCESSIVE',
        bucket: 'pauses',
        penalty: -2.5,
        count: 1,
        confidence: 0.91,
        fact: "There was an unnatural pause after 'Now'. Added an unnatural gap > 0.5s.",
        evidence: {
          metric: 'Pause after the word',
          rows: [
            { label: 'Reference', value: '0.18 s' },
            { label: 'Participant', value: '1.02 s' },
          ],
          deviation: '+0.84 s',
        },
      },
      words[now + 1].start,
    ),
    region(words, can, can + 2, {
      id: 'ex-pacing',
      type: 'PACING_TOO_FAST',
      bucket: 'pacing',
      penalty: -6,
      count: 3,
      confidence: 0.95,
      fact: "You spoke 'can long endure' too quickly. Participant spoke 30%+ faster than reference.",
      evidence: {
        metric: 'Local speech rate',
        rows: [
          { label: 'Reference', value: '3.8 syllables/sec' },
          { label: 'Participant', value: '5.1 syllables/sec' },
        ],
        deviation: '+34%',
      },
    }),
  ]
}

function activity(words: Word[], t: number): number {
  for (const w of words) {
    if (t >= w.start && t <= w.end) {
      const x = (t - w.start) / Math.max(w.end - w.start, 0.01)
      return Math.sin(Math.PI * x) ** 0.6
    }
  }
  return 0
}

function inFlaw(flaws: FlawRegion[], type: string, t: number): boolean {
  return flaws.some((f) => f.type === type && t >= f.start && t <= f.end)
}

function zscore(xs: (number | null)[]): (number | null)[] {
  const v = xs.filter((x): x is number => x != null)
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1
  return xs.map((x) => (x == null ? null : (x - mean) / sd))
}

function buildSignals(words: Word[], flaws: FlawRegion[], duration: number) {
  const r1 = rng(7)
  const r2 = rng(19)
  const bins = 1400
  const part: number[] = []
  const ref: number[] = []
  for (let i = 0; i < bins; i++) {
    const t = (i / bins) * duration
    const a = activity(words, t)
    const low = inFlaw(flaws, 'ENERGY_LOW', t) ? 0.42 : 1
    part.push(Math.min(1, (0.03 + a * (0.55 + 0.45 * r1())) * low))
    ref.push(Math.min(1, 0.03 + a * (0.5 + 0.4 * r2())))
  }

  const hop = 0.02
  const t: number[] = []
  const pitchPart: (number | null)[] = []
  const pitchRef: (number | null)[] = []
  const energyPart: number[] = []
  const energyRef: number[] = []
  const r3 = rng(3)
  for (let x = 0; x < duration; x += hop) {
    t.push(x)
    const a = activity(words, x)
    const phrase = Math.sin(x * 1.3) * 2.2 + Math.sin(x * 3.1) * 1.1 - (x % 9) * 0.25
    const refSt = a > 0.08 ? 4 + phrase + (r3() - 0.5) * 0.4 : null
    let partSt = a > 0.08 ? 4.3 + phrase * 0.92 + (r3() - 0.5) * 0.5 : null
    if (partSt != null && inFlaw(flaws, 'PITCH_MONOTONE', x)) partSt = 4.3 + (partSt - 4.3) * 0.25
    pitchRef.push(refSt)
    pitchPart.push(partSt)
    const low = inFlaw(flaws, 'ENERGY_LOW', x) ? -8.5 : 0
    energyRef.push(a > 0.02 ? -30 + a * 18 : -42)
    energyPart.push(a > 0.02 ? -31 + a * 18 + low : -43)
  }
  const contours: Contours = {
    t,
    pitchPart: zscore(pitchPart),
    pitchRef: zscore(pitchRef),
    energyPart: zscore(energyPart) as number[],
    energyRef: zscore(energyRef) as number[],
  }
  return { peaks: { participant: part, reference: ref }, contours }
}

export function buildExample(): Analysis {
  const words = buildWords()
  const flaws = buildFlaws(words)
  const duration = Math.ceil((words[words.length - 1].end + 0.8) * 10) / 10
  const { peaks, contours } = buildSignals(words, flaws, duration)
  const buckets = { pacing: -6, pitch: -9, pauses: -2.5, energy_clarity: -3 }
  return {
    id: EXAMPLE_ID,
    createdAt: '2026-10-08T09:00:00.000Z',
    source: 'example',
    mode: 'sandbox',
    title: 'Gettysburg Address (opening)',
    referenceLabel: 'LibriVox volunteer reading · public domain',
    transcript: TEXT,
    words,
    wordTimingEstimated: false,
    duration,
    score: { total: 100 + buckets.pacing + buckets.pitch + buckets.pauses + buckets.energy_clarity, buckets },
    flaws,
    scoringVersion: SCORING_VERSION,
    peaks,
    contours,
  }
}
