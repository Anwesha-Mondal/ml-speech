import { useEffect, useState } from 'react'
import type { Bucket } from '../../lib/api/types'
import { BUCKETS, scoreSummary } from '../../lib/analysis/model'

function useCountUp(target: number, ms = 650) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [v, setV] = useState(0)
  useEffect(() => {
    if (reduce) return
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      setV(target * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, reduce])
  return reduce ? target : v
}

function fmtScore(n: number) {
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)
}

export default function ScoreBlock({
  total,
  buckets,
  version,
}: {
  total: number
  buckets: Record<Bucket, number>
  version: string
}) {
  const shown = useCountUp(total)
  return (
    <div className="score">
      <div className="score-head">
        <span className="t-label">Delivery score</span>
        <span className="badge badge-mono" title="Deterministic scoring model version">
          SCORING {version.replace(/^s/, 'v')}
        </span>
      </div>
      <div className="score-num" aria-label={`${fmtScore(total)} out of 100`}>
        <span className="num">{fmtScore(Math.abs(shown - total) < 0.05 ? total : shown)}</span>
        <small>/100</small>
      </div>
      <p className="score-summary">{scoreSummary(total)}</p>
      <hr className="rule" />
      <div className="t-label" style={{ marginTop: 14 }}>
        Deductions
      </div>
      <ul className="deductions">
        {BUCKETS.map((b) => {
          const d = Math.abs(buckets[b.key] ?? 0)
          return (
            <li key={b.key}>
              <div className="row between">
                <span>{b.label}</span>
                <span className="num mono">
                  {d ? `−${fmtScore(d)}` : '0'}
                  <span className="faint"> / {b.cap}</span>
                </span>
              </div>
              <div className="hbar" title={`Capped at ${b.cap} points`}>
                <i style={{ width: `${(d / b.cap) * 100}%`, background: d >= b.cap * 0.5 ? 'var(--bad)' : d ? 'var(--warn)' : 'var(--good)' }} />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="t-small faint">Each bucket's deductions are capped. Score = 100 − total deductions.</p>
    </div>
  )
}
