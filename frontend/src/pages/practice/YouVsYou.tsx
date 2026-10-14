import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import LineChart from '../../components/ui/LineChart'
import SourceTag from '../../components/ui/SourceTag'
import { getHistory } from '../../lib/api/client'
import type { ApiHistory } from '../../lib/api/types'
import { BUCKETS } from '../../lib/analysis/model'
import { useAnalyses } from '../../lib/analysis/store'
import { fmtDate, fmtDeduction, fmtSigned } from '../../lib/format'

function flawDensity(flawCount: number, duration: number) {
  return duration > 0 ? (flawCount / duration) * 60 : 0
}


export default function YouVsYou() {
  const all = useAnalyses()
  const attempts = [...all].reverse() // oldest first
  const [remoteHistory, setRemoteHistory] = useState<ApiHistory | null>(null)

  useEffect(() => {
    getHistory()
      .then((res) => {
        if (res && res.history && res.history.length > 0) {
          setRemoteHistory(res)
        }
      })
      .catch(() => {})
  }, [])

  if (attempts.length < 2) {
    return (
      <div className="stack gap-16">
        <div className="panel">
          <EmptyState
            title={attempts.length === 1 ? 'One attempt recorded' : 'Record your first speech attempt'}
            action={
              <Link to="/practice" className="btn btn-primary">
                Start a speech test
              </Link>
            }
          >
            {attempts.length === 1 ? (
              <p>
                Baseline analysis recorded! Complete your second speech attempt to unlock live You vs You longitudinal progression, deduction delta tables, and flaw density trends.
              </p>
            ) : (
              <p>
                You vs You compares your baseline and latest speech analyses with acoustic metrics and deduction tracking. Record at least two attempts to begin.
              </p>
            )}
          </EmptyState>
        </div>

        {remoteHistory && remoteHistory.history.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <span className="t-section">Cloud Synced Progress History</span>
              <SourceTag kind="live" />
            </div>
            <div className="panel-pad stack gap-12">
              <LineChart
                series={[{ label: 'Score', values: remoteHistory.history.map((x) => x.score), color: 'var(--participant)' }]}
                xLabels={remoteHistory.history.map((x) => fmtDate(x.date))}
                yMin={0}
                yMax={100}
              />
              {remoteHistory.insights && remoteHistory.insights.length > 0 && (
                <ul className="muted t-small" style={{ paddingLeft: 16 }}>
                  {remoteHistory.insights.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const first = attempts[0]
  const latest = attempts[attempts.length - 1]
  const scoreDelta = latest.score.total - first.score.total
  const densityFirst = flawDensity(first.flaws.length, first.duration)
  const densityLatest = flawDensity(latest.flaws.length, latest.duration)

  return (
    <div className="stack gap-16">
      <div className="grid-4">
        <div className="panel panel-pad stat">
          <span className="t-label">First attempt</span>
          <span className="stat-value">
            {first.score.total.toFixed(1)}
            <small>/100</small>
          </span>
          <span className="t-small muted">{fmtDate(first.createdAt)}</span>
        </div>
        <div className="panel panel-pad stat">
          <span className="t-label">Latest attempt</span>
          <span className="stat-value">
            {latest.score.total.toFixed(1)}
            <small>/100</small>
          </span>
          {Math.abs(scoreDelta) < 0.05 ? (
            <span className="stat-delta muted">Same as the first attempt</span>
          ) : (
            <span className={`stat-delta ${scoreDelta > 0 ? 'up' : 'down'}`}>{fmtSigned(scoreDelta, 1)} points</span>
          )}
        </div>
        <div className="panel panel-pad stat">
          <span className="t-label">Flaw density</span>
          <span className="stat-value">
            {densityLatest.toFixed(1)}
            <small>/min</small>
          </span>
          <span
            className={`stat-delta ${densityLatest < densityFirst - 0.05 ? 'up' : densityLatest > densityFirst + 0.05 ? 'down' : 'muted'}`}
          >
            was {densityFirst.toFixed(1)}/min
          </span>
        </div>
        <div className="panel panel-pad stat">
          <span className="t-label">Attempts</span>
          <span className="stat-value">{attempts.length}</span>
          <span className="t-small muted">saved in this browser</span>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <span className="t-section">Score progression</span>
            <SourceTag kind="live" />
          </div>
          <div className="panel-pad">
            <LineChart
              series={[{ label: 'Score', values: attempts.map((a) => Number(a.score.total.toFixed(1))), color: 'var(--participant)' }]}
              xLabels={attempts.map((_, i) => `#${i + 1}`)}
              yMin={0}
              yMax={100}
            />
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <span className="t-section">Deductions by bucket, first → latest</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th className="r">First</th>
                  <th className="r">Latest</th>
                  <th className="r">Change</th>
                </tr>
              </thead>
              <tbody>
                {BUCKETS.map((b) => {
                  const f = Math.abs(first.score.buckets[b.key])
                  const l = Math.abs(latest.score.buckets[b.key])
                  const better = l < f
                  return (
                    <tr key={b.key}>
                      <td>{b.label}</td>
                      <td className="r mono num">{fmtDeduction(f)}</td>
                      <td className="r mono num">{fmtDeduction(l)}</td>
                      <td className={`r mono num ${l === f ? 'muted' : better ? 'up' : 'down'}`}>
                        {l === f ? 'same' : better ? `${(f - l).toFixed(1)} fewer` : `${(l - f).toFixed(1)} more`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
