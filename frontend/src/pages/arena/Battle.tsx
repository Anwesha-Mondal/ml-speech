import { CircleAlert, Scale } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import MiniWave from '../../components/arena/MiniWave'
import AudioInput from '../../components/recording/AudioInput'
import { BUCKETS } from '../../lib/analysis/model'
import type { Analysis } from '../../lib/analysis/model'
import { runAnalysis } from '../../lib/analysis/run'
import { saveBattle, useBattles } from '../../lib/battles'
import { fmtDateTime, fmtDeduction, uid } from '../../lib/format'
import { GETTYSBURG_OPENING } from '../../lib/references'

type Phase = 'setup' | 'running' | 'done'

interface Side {
  name: string
  file: File | null
  status: string
  result: Analysis | null
}

function PlayerBlock({ side, label, flip, winner }: { side: Side; label: string; flip?: boolean; winner: boolean }) {
  const r = side.result
  return (
    <div className={`battle-player ${winner ? 'is-winner' : ''}`}>
      <div className="row between wrap gap-8">
        <div className="stack">
          <span className="t-label">{label}</span>
          <span className="t-title">{side.name}</span>
        </div>
        <div className="battle-score num">
          {r ? r.score.total.toFixed(1) : '—'}
          {winner && <span className="badge badge-good">Winner</span>}
        </div>
      </div>
      {r?.peaks?.participant && (
        <MiniWave peaks={r.peaks.participant} flip={flip} label={`${side.name} waveform`} />
      )}
      {r && (
        <div className="battle-metrics">
          {BUCKETS.map((b) => (
            <div key={b.key} className="stack">
              <span className="t-small muted">{b.label}</span>
              <span className="mono num">{fmtDeduction(r.score.buckets[b.key])}</span>
            </div>
          ))}
          <div className="stack">
            <span className="t-small muted">Flaws</span>
            <span className="mono num">{r.flaws.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Battle() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [error, setError] = useState<string | null>(null)
  const [a, setA] = useState<Side>({ name: 'Player A', file: null, status: '', result: null })
  const [b, setB] = useState<Side>({ name: 'Player B', file: null, status: '', result: null })
  const history = useBattles()

  const start = async () => {
    if (!a.file || !b.file) return
    setPhase('running')
    setError(null)
    const run = (side: Side, set: (fn: (s: Side) => Side) => void) =>
      runAnalysis(
        {
          participant: side.file as File,
          transcript: GETTYSBURG_OPENING,
          mode: 'sandbox',
          title: `Battle · ${side.name}`,
          referenceLabel: 'Gettysburg Address (opening)',
        },
        (p) =>
          set((s) => ({
            ...s,
            status: p.stage === 'upload' ? 'Uploading' : p.stage === 'server' ? 'Analyzing on the server' : 'Finishing',
          })),
        undefined,
        { save: false },
      )
    try {
      const [ra, rb] = await Promise.all([run(a, setA), run(b, setB)])
      setA((s) => ({ ...s, result: ra, status: 'Done' }))
      setB((s) => ({ ...s, result: rb, status: 'Done' }))
      const diff = ra.score.total - rb.score.total
      saveBattle({
        id: uid('b_'),
        createdAt: new Date().toISOString(),
        passage: 'Gettysburg Address (opening)',
        players: [ra, rb].map((r, i) => ({
          name: i ? b.name : a.name,
          score: r.score.total,
          buckets: r.score.buckets,
          flaws: r.flaws.length,
        })),
        winner: Math.abs(diff) < 0.05 ? null : diff > 0 ? 0 : 1,
      })
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The battle could not be scored.')
      setPhase('setup')
    }
  }

  const ra = a.result
  const rb = b.result
  const diff = ra && rb ? ra.score.total - rb.score.total : 0
  const winner = ra && rb ? (Math.abs(diff) < 0.05 ? null : diff > 0 ? 0 : 1) : null

  if (phase === 'done' && ra && rb) {
    return (
      <div className="stack gap-16">
        <div className="panel battle-board">
          <PlayerBlock side={a} label="Player A" winner={winner === 0} />
          <div className="battle-vs">
            <span>VS</span>
            <span className="t-small muted">
              {winner == null ? 'Draw' : `${winner === 0 ? a.name : b.name} by ${Math.abs(diff).toFixed(1)} points`}
            </span>
          </div>
          <PlayerBlock side={b} label="Player B" flip winner={winner === 1} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="t-section">Where points were lost</span>
          </div>
          <div className="panel-pad stack gap-12">
            {BUCKETS.map((bk) => {
              const da = Math.abs(ra.score.buckets[bk.key])
              const db = Math.abs(rb.score.buckets[bk.key])
              return (
                <div key={bk.key} className="duel-row">
                  <span className="duel-a mono num">{fmtDeduction(da)}</span>
                  <div className="duel-bar duel-bar-a">
                    <i style={{ width: `${(da / bk.cap) * 100}%` }} />
                  </div>
                  <span className="duel-label">{bk.label}</span>
                  <div className="duel-bar">
                    <i style={{ width: `${(db / bk.cap) * 100}%` }} />
                  </div>
                  <span className="duel-b mono num">{fmtDeduction(db)}</span>
                </div>
              )
            })}
          </div>
        </div>
        <p className="notice">
          <Scale size={15} />
          <span>
            <strong>Fair comparison.</strong> Scores use speaker-normalized acoustic features.
          </span>
        </p>
        <div className="row gap-8">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setA((s) => ({ ...s, file: null, result: null, status: '' }))
              setB((s) => ({ ...s, file: null, result: null, status: '' }))
              setPhase('setup')
            }}
          >
            New battle
          </button>
        </div>
      </div>
    )
  }

  const running = phase === 'running'
  return (
    <div className="stack gap-16">
      <div className="panel panel-pad stack gap-16">
        <div className="stack gap-4">
          <span className="t-section">Passage</span>
          <p className="battle-passage">{GETTYSBURG_OPENING}</p>
        </div>
        <div className="grid-2">
          {(
            [
              [a, setA, 'a'],
              [b, setB, 'b'],
            ] as const
          ).map(([side, set, key]) => (
            <div key={key} className="stack gap-12 battle-setup">
              <label className="field">
                <span>Name</span>
                <input
                  id={`battle-name-${key}`}
                  className="input"
                  value={side.name}
                  maxLength={24}
                  disabled={running}
                  onChange={(e) => set((s) => ({ ...s, name: e.target.value || (key === 'a' ? 'Player A' : 'Player B') }))}
                />
              </label>
              <AudioInput
                id={`battle-file-${key}`}
                label={`${side.name}'s reading`}
                file={side.file}
                disabled={running}
                onFile={(f) => set((s) => ({ ...s, file: f }))}
              />
              {running && <span className="t-small muted">{side.status || 'Waiting'}…</span>}
            </div>
          ))}
        </div>
        {error && (
          <p className="notice notice-bad">
            <CircleAlert size={15} />
            <span>{error}</span>
          </p>
        )}
        <div className="row gap-12 wrap">
          <button type="button" className="btn btn-primary btn-lg" disabled={!a.file || !b.file || running} onClick={() => void start()}>
            {running ? 'Scoring both readings…' : 'Start battle'}
          </button>
          <span className="t-small muted">Both readings are scored by the same pipeline, then compared.</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="t-section">Recent battles</span>
          <span className="t-small muted">in this browser</span>
        </div>
        {history.length ? (
          <ul className="list">
            {history.slice(0, 6).map((h) => (
              <li key={h.id} className="list-row">
                <span className="grow">
                  {h.players[0].name} <span className="faint">vs</span> {h.players[1].name}
                </span>
                <span className="mono num t-small">
                  {h.players[0].score.toFixed(1)} – {h.players[1].score.toFixed(1)}
                </span>
                <span className="badge">{h.winner == null ? 'Draw' : `${h.players[h.winner].name} won`}</span>
                <span className="t-small faint">{fmtDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-pad t-small muted">
            No battles yet. Two people read the same passage; the lower total deduction wins.{' '}
            <Link to="/leaderboard">See the leaderboard</Link>.
          </p>
        )}
      </div>
    </div>
  )
}
