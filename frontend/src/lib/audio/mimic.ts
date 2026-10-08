import type { Contours } from '../analysis/model'

/**
 * Mimic Party similarity, per docs/15-MIMIC-PARTY.md:
 *   z-score pitch and energy per speaker (removes voice identity) → DTW on the energy
 *   envelope (rhythm) → distance between the aligned contours → score.
 *   score = max(0, 100 − distance × 50), distance = mean |Δz| of pitch and energy along the path.
 * Runs in the browser on the two recordings.
 */

export const SCALE = 50
const STEP = 2 // use every 2nd 20 ms frame (25 fps)
const BAND = 0.25 // Sakoe–Chiba band as a share of the longer sequence
export const MAX_SECONDS = 45

export interface MimicResult {
  score: number
  pitch: number
  energy: number
  cadence: number
  pauses: number
  /** Reference timeline (s) and the participant's values warped onto it. */
  t: number[]
  refPitch: (number | null)[]
  partPitchWarped: (number | null)[]
  deviation: boolean[]
}

function fillGaps(xs: (number | null)[]): number[] {
  const out = new Array<number>(xs.length)
  let last: number | null = null
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i]
    if (v != null) {
      if (last == null) for (let k = 0; k < i; k++) out[k] = v
      else {
        const gap = i - (last as number)
        const a = out[last as number]
        for (let k = (last as number) + 1; k < i; k++) out[k] = a + ((v - a) * (k - (last as number))) / gap
      }
      out[i] = v
      last = i
    }
  }
  if (last == null) return xs.map(() => 0)
  for (let k = (last as number) + 1; k < xs.length; k++) out[k] = out[last as number]
  return out
}

function sub<T>(xs: T[]): T[] {
  return xs.filter((_, i) => i % STEP === 0)
}

/** DTW on 1-D frames. Returns the warping path as index pairs. */
function dtw(a: number[], b: number[]): [number, number][] {
  const n = a.length
  const m = b.length
  const band = Math.max(Math.ceil(Math.max(n, m) * BAND), Math.abs(n - m) + 2)
  const INF = 1e18
  const D = new Float64Array((n + 1) * (m + 1)).fill(INF)
  const W = m + 1
  D[0] = 0
  for (let i = 1; i <= n; i++) {
    const center = Math.round((i * m) / n)
    const jLo = Math.max(1, center - band)
    const jHi = Math.min(m, center + band)
    for (let j = jLo; j <= jHi; j++) {
      const c = Math.abs(a[i - 1] - b[j - 1])
      D[i * W + j] = c + Math.min(D[(i - 1) * W + j], D[i * W + j - 1], D[(i - 1) * W + j - 1])
    }
  }
  const path: [number, number][] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1])
    const diag = D[(i - 1) * W + j - 1]
    const up = D[(i - 1) * W + j]
    const left = D[i * W + j - 1]
    if (diag <= up && diag <= left) {
      i--
      j--
    } else if (up < left) i--
    else j--
  }
  return path.reverse()
}

function pauseSet(voiced: boolean[]): number[] {
  // centres of unvoiced runs ≥ 250 ms (≥ 7 frames at 40 ms) that sit between speech
  const out: number[] = []
  let start = -1
  for (let i = 0; i <= voiced.length; i++) {
    const v = i < voiced.length ? voiced[i] : true
    if (!v && start < 0) start = i
    if (v && start >= 0) {
      if (i - start >= 7 && start > 0 && i < voiced.length) out.push((start + i) / 2)
      start = -1
    }
  }
  return out
}

const pct = (d: number) => Math.max(0, Math.min(100, 100 - d * SCALE))

export function compareMimic(ref: Contours, part: Contours): MimicResult {
  const rP = sub(ref.pitchPart ?? [])
  const pP = sub(part.pitchPart ?? [])
  const rE = sub(ref.energyPart ?? []).map((v) => v ?? 0)
  const pE = sub(part.energyPart ?? []).map((v) => v ?? 0)
  const rT = sub(ref.t)
  if (rP.length < 10 || pP.length < 10 || !rP.some((v) => v != null) || !pP.some((v) => v != null))
    throw new Error('A recording is too short or too quiet to compare.')

  const rPf = fillGaps(rP)
  const pPf = fillGaps(pP)
  // Align on the energy envelope (the syllable rhythm), then compare pitch along that
  // alignment. Aligning on pitch would let a wrong melody warp itself into a match.
  const path = dtw(rE, pE)

  let dp = 0
  let de = 0
  const warped: (number | null)[] = new Array(rP.length).fill(null)
  const dev: boolean[] = new Array(rP.length).fill(false)
  for (const [i, j] of path) {
    const d1 = Math.abs(rPf[i] - pPf[j])
    dp += d1
    de += Math.abs(rE[i] - pE[j])
    if (warped[i] == null) {
      warped[i] = pP[j] == null && rP[i] == null ? null : pPf[j]
      dev[i] = d1 > 0.75
    }
  }
  dp /= path.length
  de /= path.length

  // Cadence: how far the rhythm alignment strays from a uniform tempo, after length normalisation.
  let drift = 0
  for (const [i, j] of path) drift += Math.abs(i / (rE.length - 1) - j / (pE.length - 1))
  drift /= path.length
  const cadence = Math.max(0, Math.min(100, 100 - drift * 400))

  // Pauses: reference pauses with a participant pause within ±0.4 s (10 frames),
  // comparing positions on a length-normalised timeline.
  const refPauses = pauseSet(rP.map((v) => v != null))
  const partPauses = pauseSet(pP.map((v) => v != null)).map((p) => (p * rP.length) / pP.length)
  const matched = refPauses.filter((rp) => partPauses.some((pp) => Math.abs(pp - rp) <= 10)).length
  const pauses = refPauses.length ? (matched / refPauses.length) * 100 : partPauses.length ? 50 : 100

  const pitch = pct(dp)
  const energy = pct(de)
  const score = Math.round(pct((dp + de) / 2))

  return {
    score,
    pitch: Math.round(pitch),
    energy: Math.round(energy),
    cadence: Math.round(cadence),
    pauses: Math.round(pauses),
    t: rT,
    refPitch: rP,
    partPitchWarped: warped,
    deviation: dev,
  }
}
