import { AlertTriangle, FlipHorizontal2, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { NewsConfig } from '../../../../lib/api/modes'

/**
 * Studio teleprompter (megaev.md §5.2-§5.4). Scrolls at the chosen words per minute; while it
 * runs, the ON AIR tally is lit and the breaking-news alert fires at its trigger second.
 * Scroll position lives in refs and is applied in requestAnimationFrame, not React state.
 */
export default function BroadcastPrompter({
  text,
  cfg,
  targetWpm,
  alert,
}: {
  text: string
  cfg: NewsConfig
  targetWpm: number
  alert: { trigger_at_second: number; flash_text: string } | null
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [wpm, setWpm] = useState(targetWpm)
  const [font, setFont] = useState(cfg.font_size_px.default)
  const [mirror, setMirror] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!running) return
    const box = boxRef.current
    if (!box) return
    const words = Math.max(1, text.split(/\s+/).filter(Boolean).length)
    const pxPerSec = (box.scrollHeight - box.clientHeight) / ((words / wpm) * 60)
    let last = performance.now()
    let pos = box.scrollTop
    let raf = 0
    let lastShown = -1
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      pos += dt * pxPerSec
      box.scrollTop = pos
      elapsedRef.current += dt
      const whole = Math.floor(elapsedRef.current)
      if (whole !== lastShown) {
        lastShown = whole
        setElapsed(whole) // once per second, not per frame
      }
      if (alert && elapsedRef.current >= alert.trigger_at_second) setFlash(alert.flash_text)
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 1) {
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, wpm, text, alert])

  const reset = () => {
    setRunning(false)
    setFlash(null)
    elapsedRef.current = 0
    setElapsed(0)
    if (boxRef.current) boxRef.current.scrollTop = 0
  }

  const [lo, hi] = cfg.target_wpm_band
  return (
    <div className="studio">
      <div className="studio-bar">
        <span className={`tally ${running ? 'is-live' : ''}`}>{running ? 'ON AIR' : 'STANDBY'}</span>
        <span className="mono num t-small">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </span>
        <span className={`t-small ${wpm < lo || wpm > hi ? 'warn-text' : 'muted'}`}>
          Broadcast band {lo}–{hi} wpm
        </span>
      </div>
      {flash && (
        <div className="breaking" role="alert">
          <AlertTriangle size={16} />
          <span>
            <strong>Breaking:</strong> {flash.replace(/^FLASH:\s*/, '')}
          </span>
        </div>
      )}
      <div className="prompter-wrap">
        <div
          ref={boxRef}
          className={`prompter ${mirror ? 'is-mirrored' : ''}`}
          style={{ fontSize: font }}
          tabIndex={0}
          aria-label="Teleprompter script"
        >
          <div className="prompter-pad" />
          <p style={{ fontSize: 'inherit' }}>{text}</p>
          <div className="prompter-pad" />
        </div>
        <div className="prompter-guide" aria-hidden="true" />
      </div>
      <div className="row gap-8 wrap prompter-controls">
        <button type="button" className="btn btn-sm" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? 'Pause' : 'Roll prompter'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={reset}>
          <RotateCcw size={13} /> Reset
        </button>
        <button type="button" className="btn btn-sm btn-ghost" aria-pressed={mirror} onClick={() => setMirror((m) => !m)}>
          <FlipHorizontal2 size={13} /> Mirror
        </button>
        <label className="row gap-8 t-small muted">
          <span>Rate</span>
          <input
            id="news-wpm"
            type="range"
            min={cfg.wpm_range[0]}
            max={cfg.wpm_range[1]}
            step={5}
            value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
            className="ws-range"
          />
          <span className="mono num">{wpm} wpm</span>
        </label>
        <label className="row gap-8 t-small muted">
          <span>Size</span>
          <input
            id="news-font"
            type="range"
            min={cfg.font_size_px.min}
            max={cfg.font_size_px.max}
            step={2}
            value={font}
            onChange={(e) => setFont(Number(e.target.value))}
            className="ws-range"
          />
        </label>
      </div>
    </div>
  )
}
