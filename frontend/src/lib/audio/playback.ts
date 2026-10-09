import { useEffect, useMemo, useSyncExternalStore } from 'react'

type TickFn = (t: number) => void

/**
 * One clock for the analysis workstation. When a recording is available it wraps an
 * <audio> element; otherwise (the built-in example) it runs a silent timer so the
 * playhead, transcript sync and flaw seeking still work.
 *
 * Time updates go to subscribers on requestAnimationFrame and never through React
 * state, so a playing clip does not re-render the page 60 times a second.
 */
export class PlaybackClock {
  readonly duration: number
  readonly hasAudio: boolean
  private audio: HTMLAudioElement | null = null
  private virtualT = 0
  private virtualStart = 0
  private playing = false
  private rate = 1
  private raf = 0
  private ticks = new Set<TickFn>()
  private state = new Set<() => void>()
  private snapshot = { playing: false, rate: 1, volume: 1 }

  constructor(duration: number, audioUrl?: string) {
    this.duration = duration
    this.hasAudio = Boolean(audioUrl)
    if (audioUrl) {
      const a = new Audio(audioUrl)
      a.preload = 'auto'
      a.addEventListener('ended', () => this.setPlaying(false))
      a.addEventListener('pause', () => this.setPlaying(false))
      a.addEventListener('play', () => this.setPlaying(true))
      a.addEventListener('seeked', () => this.emitTick())
      this.audio = a
    }
  }

  get time(): number {
    if (this.audio) return this.audio.currentTime
    if (!this.playing) return this.virtualT
    return Math.min(this.duration, this.virtualT + ((performance.now() - this.virtualStart) / 1000) * this.rate)
  }

  getState() {
    return this.snapshot
  }

  private setPlaying(p: boolean) {
    if (this.playing === p && this.snapshot.playing === p) return
    this.playing = p
    this.publish()
    if (p) this.loop()
    else {
      cancelAnimationFrame(this.raf)
      this.emitTick()
    }
  }

  private publish() {
    this.snapshot = { playing: this.playing, rate: this.rate, volume: this.audio?.volume ?? 1 }
    this.state.forEach((f) => f())
  }

  private loop = () => {
    const t = this.time
    this.emitTick()
    if (!this.audio && t >= this.duration) {
      this.virtualT = this.duration
      this.setPlaying(false)
      return
    }
    if (this.playing) this.raf = requestAnimationFrame(this.loop)
  }

  private emitTick() {
    const t = this.time
    this.ticks.forEach((f) => f(t))
  }

  async play() {
    if (this.audio) {
      if (this.audio.ended || this.audio.currentTime >= this.duration - 0.05) {
        this.audio.currentTime = 0
      }
      try {
        await this.audio.play()
      } catch (e) {
        this.setPlaying(false)
      }
      return
    }
    if (this.virtualT >= this.duration) this.virtualT = 0
    this.virtualStart = performance.now()
    this.setPlaying(true)
  }

  pause() {
    if (this.audio) {
      this.audio.pause()
      return
    }
    this.virtualT = this.time
    this.setPlaying(false)
  }

  toggle() {
    if (this.playing) this.pause()
    else void this.play()
  }

  seek(t: number) {
    const clamped = Math.max(0, Math.min(this.duration, t))
    if (this.audio) {
      this.audio.currentTime = clamped
    } else {
      this.virtualT = clamped
      this.virtualStart = performance.now()
    }
    this.emitTick()
  }

  setRate(r: number) {
    if (!this.audio && this.playing) {
      this.virtualT = this.time
      this.virtualStart = performance.now()
    }
    this.rate = r
    if (this.audio) this.audio.playbackRate = r
    this.publish()
  }

  setVolume(v: number) {
    if (this.audio) this.audio.volume = v
    this.publish()
  }

  onTick(fn: TickFn) {
    this.ticks.add(fn)
    fn(this.time)
    return () => {
      this.ticks.delete(fn)
    }
  }

  onState(fn: () => void) {
    this.state.add(fn)
    return () => {
      this.state.delete(fn)
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.audio?.pause()
    this.audio = null
    this.ticks.clear()
    this.state.clear()
  }
}

export function useClock(duration: number, audioUrl?: string): PlaybackClock {
  const clock = useMemo(() => new PlaybackClock(duration, audioUrl), [duration, audioUrl])
  useEffect(() => () => clock.dispose(), [clock])
  return clock
}

export function useClockState(clock: PlaybackClock) {
  return useSyncExternalStore(
    (cb) => clock.onState(cb),
    () => clock.getState(),
    () => clock.getState(),
  )
}
