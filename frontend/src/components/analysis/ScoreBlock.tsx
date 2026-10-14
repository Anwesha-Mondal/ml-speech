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
        Performance by Dimension
      </div>
      <ul className="deductions">
        {BUCKETS.map((b) => {
          const cap = b.cap ?? 25
          const d = Math.abs(buckets[b.key] ?? 0)
          const earned = Math.max(0, cap - d)
          return (
            <li key={b.key} style={{ marginBottom: 12 }}>
              <div className="row between">
                <span style={{ fontWeight: 500 }}>{b.label}</span>
                <span className="num mono">
                  <strong style={{ color: earned >= 20 ? 'var(--good)' : earned >= 12 ? 'var(--warn)' : 'var(--bad)' }}>
                    {fmtScore(earned)}
                  </strong>
                  <span className="faint"> / {cap} pts</span>
                  {d > 0 && <small className="muted" style={{ marginLeft: 6, fontSize: '0.8em', color: 'var(--bad)' }}>(-{fmtScore(d)})</small>}
                </span>
              </div>
              <div className="hbar" title={`Earned ${fmtScore(earned)} of ${cap} points (deducted: -${fmtScore(d)})`}>
                <i
                  style={{
                    width: `${(earned / cap) * 100}%`,
                    background: earned >= 20 ? 'var(--good)' : earned >= 12 ? 'var(--warn)' : 'var(--bad)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="t-small faint" style={{ lineHeight: 1.4, marginTop: 8 }}>
        <strong>Scoring basis:</strong> 100 points total (25 pts each across Pacing, Pitch, Pauses, and Energy). Deviations deduct from each category. Severe speech flaws or silence deduct up to 100 points (scores range 0–100).
      </p>
    </div>
  )
}
