import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import SourceTag from '../../components/ui/SourceTag'
import { getLeaderboard } from '../../lib/api/client'
import type { ApiLeaderboard } from '../../lib/api/types'
import { modeLabel } from '../../lib/analysis/model'
import { fmtDateTime } from '../../lib/format'

type Tab = 'transcript' | 'global' | 'friends'

function TranscriptBoard() {
  const [data, setData] = useState<ApiLeaderboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getLeaderboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <EmptyState title="Rankings unavailable">
        {error}
      </EmptyState>
    )
  }
  if (!data) {
    return (
      <div className="panel-pad stack gap-8">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 34 }} />
        ))}
      </div>
    )
  }
  return (
    <>
      <div className="panel-head">
        <div className="stack">
          <span className="t-section">Gettysburg Address</span>
          <span className="t-small muted">
            Prompt <span className="mono">{data.prompt_id}</span> · updated {fmtDateTime(data.last_updated)}
          </span>
        </div>
        <div className="row gap-8">
          <SourceTag kind="sample" />
          <span className="badge badge-mono" title="Only scores from the same scoring version are ranked together.">
            <Lock size={11} /> SCORING {data.version}
          </span>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Speaker</th>
              <th className="r">Score</th>
              <th className="r">Flaws / min</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {data.rankings.map((r) => (
              <tr key={r.rank} className={r.user_id === 'You' ? 'is-you' : ''}>
                <td className={`rank rank-${r.rank}`}>{String(r.rank).padStart(2, '0')}</td>
                <td style={r.user_id === 'You' ? { fontWeight: 600 } : undefined}>{r.user_id}</td>
                <td className="r mono num">{r.score}</td>
                <td className="r mono num">{r.flaw_density.toFixed(1)}</td>
                <td className="muted">{modeLabel(r.mode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('transcript')
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Rankings are per passage and locked to one scoring version, so a rule change never mixes old and new scores."
      />
      <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
        {(
          [
            ['transcript', 'Transcript'],
            ['global', 'Global'],
            ['friends', 'Friends'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel" role="tabpanel">
        {tab === 'transcript' && <TranscriptBoard />}
        {tab === 'global' && (
          <EmptyState
            title="No Elo ratings yet"
            action={
              <Link to="/arena/battle" className="btn">
                Start a battle
              </Link>
            }
          >
            Global rankings use Elo from 1v1 battles (everyone starts at 1200). They appear once battle results are
            stored on the server; today battles are kept only in your browser.
          </EmptyState>
        )}
        {tab === 'friends' && (
          <EmptyState title="No friends or cohort yet">
            Cohort rankings filter the transcript board by people you follow. Accounts aren't part of this build.
          </EmptyState>
        )}
      </div>
    </>
  )
}
