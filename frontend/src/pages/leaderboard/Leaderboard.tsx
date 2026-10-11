import { Lock, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import OptInToggle from '../../components/leaderboard/OptInToggle'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import { getLeaderboard, getLeaderboardPrompts } from '../../lib/api/client'
import type { ApiLeaderboard, ApiLeaderboardPrompts } from '../../lib/api/types'
import { useAuth } from '../../lib/auth/context'

type Tab = 'passage' | 'global' | 'friends'

/** Remounted (via key) when the passage or opt-in changes, so it always starts empty. */
function Board({ promptId }: { promptId: string }) {
  const [data, setData] = useState<ApiLeaderboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    getLeaderboard(promptId)
      .then((d) => {
        if (live) setData(d)
      })
      .catch((e: Error) => {
        if (live) setError(e.message)
      })
    return () => {
      live = false
    }
  }, [promptId])

  if (error) return <EmptyState title="Rankings unavailable">{error}</EmptyState>
  if (!data) {
    return (
      <div className="panel-pad stack gap-8">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 34 }} />
        ))}
      </div>
    )
  }
  const global = data.prompt_id === 'global'
  return (
    <>
      <div className="panel-head">
        <div className="stack">
          <span className="t-section">{data.title}</span>
          <span className="t-small muted">
            {global ? "Each person's best score per passage, added up." : "Each person's best score on this passage."}
            {data.you.best_score !== null && (
              <>
                {' '}
                Your best: <span className="mono num">{data.you.best_score}</span>
              </>
            )}
          </span>
        </div>
        <span className="badge badge-mono" title="Only scores from the same scoring version are ranked together.">
          <Lock size={11} /> SCORING {data.scoring_version}
        </span>
      </div>
      {data.rankings.length === 0 ? (
        <EmptyState
          title="No ranked scores yet"
          action={
            <Link to="/practice" className="btn">
              Practice a passage
            </Link>
          }
        >
          Scores appear here when people who joined the leaderboard analyze a reference passage.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Speaker</th>
                <th className="r">{global ? 'Total' : 'Best score'}</th>
              </tr>
            </thead>
            <tbody>
              {data.rankings.map((r) => (
                <tr key={r.rank} className={r.you ? 'is-you' : ''}>
                  <td className={`rank rank-${r.rank}`}>{String(r.rank).padStart(2, '0')}</td>
                  <td style={r.you ? { fontWeight: 600 } : undefined}>
                    {r.display_name}
                    {r.you && <span className="t-small muted"> (you)</span>}
                  </td>
                  <td className="r mono num">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('passage')
  const [prompts, setPrompts] = useState<ApiLeaderboardPrompts | null>(null)
  const [promptId, setPromptId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    getLeaderboardPrompts()
      .then((p) => {
        setPrompts(p)
        setPromptId((cur) => cur || p.prompts[0]?.id || '')
      })
      .catch(() => setPrompts({ scoring_version: '', prompts: [] }))
  }, [])

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Rankings are per reference passage and locked to one scoring version, so a rule change never mixes old and new scores."
      />

      <section className="panel panel-pad stack gap-8" style={{ marginBottom: 16 }}>
        <span className="t-section row gap-8">
          <Trophy size={15} /> {user?.leaderboard_opt_in ? 'You are on the leaderboard' : 'You are not on the leaderboard'}
        </span>
        <OptInToggle onChange={() => setReloadKey((k) => k + 1)} />
      </section>

      <div className="row gap-12 wrap" style={{ marginBottom: 16, alignItems: 'center' }}>
        <div className="tabs" role="tablist">
          {(
            [
              ['passage', 'Passage'],
              ['global', 'All passages'],
              ['friends', 'Friends'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'passage' && prompts && prompts.prompts.length > 0 && (
          <select
            id="leaderboard-passage"
            aria-label="Passage"
            className="select"
            style={{ maxWidth: 320 }}
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
          >
            {prompts.prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="panel" role="tabpanel">
        {tab === 'passage' && promptId && <Board key={`${promptId}-${reloadKey}`} promptId={promptId} />}
        {tab === 'passage' && prompts && !promptId && (
          <EmptyState title="Rankings unavailable">The list of ranked passages couldn't be loaded.</EmptyState>
        )}
        {tab === 'global' && <Board key={`global-${reloadKey}`} promptId="global" />}
        {tab === 'friends' && (
          <EmptyState title="No friends or cohort yet">
            Cohort rankings would filter the passage boards by people you follow. Following isn't part of this build.
          </EmptyState>
        )}
      </div>
    </>
  )
}
