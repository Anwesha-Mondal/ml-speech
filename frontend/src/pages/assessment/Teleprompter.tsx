import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Scrolls the script at a chosen reading rate. Purely a reading aid; nothing is measured here. */
export default function Teleprompter({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [wpm, setWpm] = useState(150)

  useEffect(() => {
    if (!running) return
    const box = boxRef.current
    if (!box) return
    const words = Math.max(1, text.split(/\s+/).filter(Boolean).length)
    const seconds = (words / wpm) * 60
    const pxPerSec = (box.scrollHeight - box.clientHeight) / seconds
    let last = performance.now()
    let acc = box.scrollTop
    let raf = 0
    const tick = (now: number) => {
      acc += ((now - last) / 1000) * pxPerSec
      last = now
      box.scrollTop = acc
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 1) {
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, wpm, text])

  if (!text.trim()) {
    return <div className="prompter prompter-empty muted">Paste a script below to load the teleprompter.</div>
  }

  return (
    <div className="prompter-wrap">
      <div ref={boxRef} className="prompter" tabIndex={0} aria-label="Teleprompter script">
        <div className="prompter-pad" />
        <p>{text}</p>
        <div className="prompter-pad" />
      </div>
      <div className="prompter-guide" aria-hidden="true" />
      <div className="row gap-8 wrap prompter-controls">
        <button type="button" className="btn btn-sm" onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? 'Pause' : 'Scroll'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => {
            setRunning(false)
            if (boxRef.current) boxRef.current.scrollTop = 0
          }}
        >
          <RotateCcw size={13} /> Reset
        </button>
        <label className="row gap-8 t-small muted">
          <span>Rate</span>
          <input
            id="prompter-wpm"
            type="range"
            min={90}
            max={210}
            step={10}
            value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
            className="ws-range"
          />
          <span className="mono num">{wpm} wpm</span>
        </label>
      </div>
    </div>
  )
}
