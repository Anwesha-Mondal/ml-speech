import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

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
  readonly audioUrl?: string
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
    this.duration = Math.max(0.1, duration)
    this.audioUrl = audioUrl
    this.hasAudio = Boolean(audioUrl)
    if (audioUrl) {
      this.ensureAudio()
    }
  }

  ensureAudio(): HTMLAudioElement | null {
    if (!this.audioUrl) return null
    if (!this.audio) {
      const a = new Audio(this.audioUrl)
      a.preload = 'auto'
      a.volume = this.snapshot.volume
      a.playbackRate = this.rate
      a.addEventListener('ended', () => this.setPlaying(false))
      a.addEventListener('pause', () => this.setPlaying(false))
      a.addEventListener('play', () => this.setPlaying(true))
      a.addEventListener('seeked', () => this.emitTick())
      a.addEventListener('timeupdate', () => this.emitTick())
      a.addEventListener('error', (e) => {
        console.warn('Audio playback element error:', e)
        this.setPlaying(false)
      })
      this.audio = a
    }
    return this.audio
  }

  get time(): number {
    const a = this.audio
    if (a && !isNaN(a.currentTime)) return a.currentTime
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
    this.snapshot = { playing: this.playing, rate: this.rate, volume: this.audio?.volume ?? this.snapshot.volume }
    this.state.forEach((f) => f())
  }

  private loop = () => {
    const t = this.time
    this.emitTick()
    if (t >= this.duration) {
      const a = this.ensureAudio()
      if (a) {
        a.pause()
        try {
          a.currentTime = this.duration
        } catch {
          /* ignore */
        }
      } else {
        this.virtualT = this.duration
      }
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
    const a = this.ensureAudio()
    if (a) {
      if (a.ended || a.currentTime >= this.duration - 0.05) {
        try {
          a.currentTime = 0
        } catch {
          /* ignore */
        }
      }
      try {
        await a.play()
        this.setPlaying(true)
      } catch (e) {
        console.warn('Audio.play() failed:', e)
        this.setPlaying(false)
      }
      return
    }
    if (this.virtualT >= this.duration) this.virtualT = 0
    this.virtualStart = performance.now()
    this.setPlaying(true)
  }

  pause() {
    const a = this.ensureAudio()
    if (a) {
      a.pause()
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
    const a = this.ensureAudio()
    if (a) {
      try {
        a.currentTime = clamped
      } catch (e) {
        console.warn('Seek error:', e)
      }
    }
    this.virtualT = clamped
    this.virtualStart = performance.now()
    this.emitTick()
  }

  setRate(r: number) {
    if (!this.audio && this.playing) {
      this.virtualT = this.time
      this.virtualStart = performance.now()
    }
    this.rate = r
    const a = this.ensureAudio()
    if (a) a.playbackRate = r
    this.publish()
  }

  setVolume(v: number) {
    this.snapshot.volume = v
    const a = this.ensureAudio()
    if (a) a.volume = v
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
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
  }
}

export function useClock(duration: number, audioUrl?: string): PlaybackClock {
  const [clock, setClock] = useState(() => new PlaybackClock(duration, audioUrl))
  const keyRef = useRef(`${duration}:${audioUrl}`)

  useEffect(() => {
    const key = `${duration}:${audioUrl}`
    if (keyRef.current !== key) {
      keyRef.current = key
      setClock(new PlaybackClock(duration, audioUrl))
    }
  }, [duration, audioUrl])

  useEffect(() => {
    return () => {
      clock.dispose()
    }
  }, [clock])

  return clock
}

export function useClockState(clock: PlaybackClock) {
  return useSyncExternalStore(
    (cb) => clock.onState(cb),
    () => clock.getState(),
    () => clock.getState(),
  )
}
