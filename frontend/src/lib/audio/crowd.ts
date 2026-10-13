import type { StageTier } from '../api/modes'

/**
 * Synthesised audience soundscape (megaev.md §6.3, §37.3): filtered noise as crowd murmur,
 * a ConvolverNode with a generated impulse response matching the tier's RT60, and scheduled
 * distractions. Everything is generated in the browser, so there are no recorded assets.
 */
export interface Crowd {
  stop: () => void
}

function impulseResponse(ctx: AudioContext, rt60: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * rt60))
  const ir = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      // -60 dB at rt60: amplitude decays as 10^(-3 t / rt60).
      data[i] = (Math.random() * 2 - 1) * Math.pow(10, (-3 * i) / length)
    }
  }
  return ir
}

function murmurBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02 // brown noise
    d[i] = last * 3.5
  }
  return buf
}

function beep(ctx: AudioContext, out: AudioNode, at: number, freq: number, dur: number, gain = 0.2) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.value = freq
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(out)
  o.start(at)
  o.stop(at + dur)
}

export function startCrowd(tier: StageTier): Crowd {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)

  const reverb = ctx.createConvolver()
  reverb.buffer = impulseResponse(ctx, tier.rt60_sec)
  reverb.connect(master)

  if (tier.crowd_level > 0) {
    const src = ctx.createBufferSource()
    src.buffer = murmurBuffer(ctx)
    src.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 500
    band.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.value = tier.crowd_level
    const pan = ctx.createStereoPanner()
    pan.pan.value = 0
    src.connect(band).connect(g).connect(pan)
    pan.connect(master)
    pan.connect(reverb)
    src.start()
  }

  const timers: number[] = []
  const t0 = ctx.currentTime
  for (const d of tier.distractions) {
    const at = t0 + d.at_sec
    if (d.kind === 'phone') {
      for (let k = 0; k < 3; k++) beep(ctx, reverb, at + k * 0.6, 880, 0.25)
    } else if (d.kind === 'mic_pop') {
      beep(ctx, master, at, 70, 0.15, 0.5)
    } else if (d.kind === 'murmur') {
      beep(ctx, reverb, at, 220, 1.2, 0.08)
    } else if (d.kind === 'poi_shout' && 'speechSynthesis' in window) {
      timers.push(
        window.setTimeout(() => {
          const u = new SpeechSynthesisUtterance('Point of information!')
          u.rate = 1.1
          window.speechSynthesis.speak(u)
        }, d.at_sec * 1000),
      )
    }
  }

  return {
    stop: () => {
      timers.forEach((id) => window.clearTimeout(id))
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      void ctx.close()
    },
  }
}

/** Microphone level meter: current level and level over the measured noise floor (dB). */
export interface Meter {
  stop: () => void
}

export async function startMeter(onLevel: (dbfs: number, overFloor: number) => void): Promise<Meter> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  })
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  src.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)
  const history: number[] = []
  let raf = 0
  let last = 0
  const tick = (now: number) => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    const db = 20 * Math.log10(Math.max(Math.sqrt(sum / buf.length), 1e-5))
    history.push(db)
    if (history.length > 600) history.shift() // ~10 s at 60 fps
    if (now - last > 100) {
      last = now
      const sorted = [...history].sort((a, b) => a - b)
      const floor = sorted[Math.floor(sorted.length * 0.1)] ?? db
      onLevel(db, db - floor)
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return {
    stop: () => {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}
