import type { Contours } from '../analysis/model'

/**
 * Display-only signal processing done in the browser on the user's own recording:
 * waveform peaks, an energy contour and a pitch contour (normalized autocorrelation).
 * The score never uses these; it comes from the server pipeline.
 */

export interface DecodedAudio {
  samples: Float32Array
  sampleRate: number
  duration: number
}

const MAX_SECONDS = 600

export async function decodeFile(file: Blob): Promise<DecodedAudio> {
  const buf = await file.arrayBuffer()
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const audio = await ctx.decodeAudioData(buf)
    const len = Math.min(audio.length, Math.floor(MAX_SECONDS * audio.sampleRate))
    const mono = new Float32Array(len)
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c)
      for (let i = 0; i < len; i++) mono[i] += ch[i] / audio.numberOfChannels
    }
    return { samples: mono, sampleRate: audio.sampleRate, duration: audio.duration }
  } finally {
    void ctx.close()
  }
}

export function computePeaks(a: DecodedAudio, bins = 1400): number[] {
  const { samples } = a
  const per = Math.max(1, Math.floor(samples.length / bins))
  const out: number[] = []
  let max = 0
  for (let b = 0; b < bins; b++) {
    let peak = 0
    const end = Math.min(samples.length, (b + 1) * per)
    for (let i = b * per; i < end; i++) {
      const v = Math.abs(samples[i])
      if (v > peak) peak = v
    }
    out.push(peak)
    if (peak > max) max = peak
  }
  return max > 0 ? out.map((p) => p / max) : out
}

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0))

function zscore(xs: (number | null)[]): (number | null)[] {
  const v = xs.filter((x): x is number => x != null)
  if (v.length < 2) return xs.map(() => null)
  const mean = v.reduce((s, x) => s + x, 0) / v.length
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length) || 1
  return xs.map((x) => (x == null ? null : (x - mean) / sd))
}

export async function computeContours(a: DecodedAudio): Promise<Contours> {
  // Downsample to ~8 kHz by block averaging; plenty for speech F0 (70–400 Hz).
  const factor = Math.max(1, Math.round(a.sampleRate / 8000))
  const sr = a.sampleRate / factor
  const n = Math.floor(a.samples.length / factor)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = 0; k < factor; k++) s += a.samples[i * factor + k]
    x[i] = s / factor
  }

  const hop = Math.round(sr * 0.02)
  const win = Math.round(sr * 0.04)
  const minLag = Math.floor(sr / 400)
  const maxLag = Math.ceil(sr / 70)
  const frames = Math.max(0, Math.floor((n - win - maxLag) / hop))

  const t: number[] = []
  const energyDb: number[] = []
  const pitchSt: (number | null)[] = []

  let peakRms = 1e-9
  const rmsAll: number[] = []
  for (let f = 0; f < frames; f++) {
    let e = 0
    const o = f * hop
    for (let i = 0; i < win; i++) e += x[o + i] * x[o + i]
    const rms = Math.sqrt(e / win)
    rmsAll.push(rms)
    if (rms > peakRms) peakRms = rms
  }
  const voiceFloor = peakRms * 0.06

  for (let f = 0; f < frames; f++) {
    const o = f * hop
    t.push((o + win / 2) / sr)
    const rms = rmsAll[f]
    energyDb.push(20 * Math.log10(rms / peakRms + 1e-6))

    if (rms < voiceFloor) {
      pitchSt.push(null)
    } else {
      let e0 = 0
      for (let i = 0; i < win; i++) e0 += x[o + i] * x[o + i]
      const nr = new Float32Array(maxLag + 1)
      let best = 0
      for (let lag = minLag; lag <= maxLag; lag++) {
        let r = 0
        let el = 0
        for (let i = 0; i < win; i++) {
          const y = x[o + i + lag]
          r += x[o + i] * y
          el += y * y
        }
        nr[lag] = r / Math.sqrt(e0 * el + 1e-12)
        if (nr[lag] > best) best = nr[lag]
      }
      // Take the first local peak close to the best one. Multiples of the period
      // correlate almost as well, and picking them causes octave jumps.
      let bestLag = 0
      for (let lag = minLag + 1; lag < maxLag; lag++) {
        if (nr[lag] >= best * 0.9 && nr[lag] >= nr[lag - 1] && nr[lag] >= nr[lag + 1]) {
          bestLag = lag
          break
        }
      }
      let lagF = bestLag
      if (bestLag > minLag && bestLag < maxLag) {
        // Parabolic interpolation for a sub-sample period estimate.
        const a = nr[bestLag - 1]
        const b = nr[bestLag]
        const c = nr[bestLag + 1]
        const den = a - 2 * b + c
        if (den < 0) lagF = bestLag + (0.5 * (a - c)) / den
      }
      pitchSt.push(best > 0.5 && bestLag > 0 ? 12 * Math.log2(sr / lagF / 100) : null)
    }
    if (f % 250 === 249) await yieldToBrowser()
  }

  // Drop isolated single-frame pitch values (octave errors are usually lone frames).
  const cleaned = pitchSt.map((p, i) => (p != null && pitchSt[i - 1] == null && pitchSt[i + 1] == null ? null : p))

  return {
    t,
    pitchPart: zscore(cleaned),
    energyPart: zscore(energyDb) as number[],
  }
}
