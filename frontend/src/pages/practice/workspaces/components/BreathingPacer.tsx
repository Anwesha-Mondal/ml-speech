import { useEffect, useState } from 'react'
import type { PublicConfig } from '../../../../lib/api/modes'

type Phase = 'inhale' | 'hold' | 'exhale'
const LABEL: Record<Phase, string> = { inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out slowly' }

/** 4-7-8 breathing guide (megaev.md §37.1). Calls onDone after the configured number of cycles. */
export default function BreathingPacer({ cfg, onDone }: { cfg: PublicConfig['breathing']; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const [cycle, setCycle] = useState(1)
  const [phase, setPhase] = useState<Phase>('inhale')
  const [left, setLeft] = useState(cfg.inhale_sec)

  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => {
      if (left > 1) return setLeft(left - 1)
      if (phase === 'inhale') {
        setPhase('hold')
        setLeft(cfg.hold_sec)
      } else if (phase === 'hold') {
        setPhase('exhale')
        setLeft(cfg.exhale_sec)
      } else if (cycle < cfg.cycles) {
        setCycle(cycle + 1)
        setPhase('inhale')
        setLeft(cfg.inhale_sec)
      } else {
        setRunning(false)
        onDone()
      }
    }, 1000)
    return () => clearTimeout(id)
  }, [running, left, phase, cycle, cfg, onDone])

  return (
    <div className="breath">
      <div className={`breath-circle ${running ? `is-${phase}` : ''}`} style={{ transitionDuration: `${left}s` }}>
        <span>{running ? left : '4-7-8'}</span>
      </div>
      <div className="stack gap-4">
        <span className="t-section">{running ? LABEL[phase] : 'Steady your breathing first'}</span>
        <span className="t-small muted">
          {running
            ? `Cycle ${cycle} of ${cfg.cycles}`
            : `Breathe in for ${cfg.inhale_sec} s, hold for ${cfg.hold_sec} s, breathe out for ${cfg.exhale_sec} s, ${cfg.cycles} times. Recording unlocks afterwards.`}
        </span>
        <div className="row gap-8">
          {!running && (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setRunning(true)}>
              Start breathing
            </button>
          )}
          <button type="button" className="btn btn-sm btn-ghost" onClick={onDone}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
