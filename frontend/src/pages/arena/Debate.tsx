import { CircleAlert, Mic, SkipForward, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BUCKETS, type Analysis } from '../../lib/analysis/model'
import { runAnalysis } from '../../lib/analysis/run'
import { useRecorder } from '../../lib/audio/useRecorder'
import { fmtDeduction, fmtTime } from '../../lib/format'

const ROUNDS = [
  { key: 'opening', label: 'Opening', limit: 120, focus: 'Clarity and pacing; avoid rushing.' },
  { key: 'response', label: 'Response', limit: 60, focus: 'Hesitation and long pauses.' },
  { key: 'rebuttal', label: 'Rebuttal', limit: 60, focus: 'Pitch stability under pressure.' },
] as const

interface Turn {
  round: number
  speaker: 0 | 1
  file: File | null
  result: Analysis | null
}

const ORDER: { round: number; speaker: 0 | 1 }[] = ROUNDS.flatMap((_, r) => [
  { round: r, speaker: 0 as const },
  { round: r, speaker: 1 as const },
])

export default function Debate() {
  const [names, setNames] = useState<[string, string]>(['Affirmative', 'Negative'])
  const [motion, setMotion] = useState('Public speaking should be taught as a core school subject.')
  const [turns, setTurns] = useState<Turn[]>(ORDER.map((o) => ({ ...o, file: null, result: null })))
  const [current, setCurrent] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'live' | 'scoring' | 'result'>('setup')
  const [error, setError] = useState<string | null>(null)
  const turnRef = useRef(current)
  useEffect(() => {
    turnRef.current = current
  }, [current])

  const rec = useRecorder((file) => {
    const idx = turnRef.current
    setTurns((ts) => ts.map((t, i) => (i === idx ? { ...t, file } : t)))
    setCurrent((c) => c + 1)
  })

  const turn = ORDER[current]
  const round = turn ? ROUNDS[turn.round] : null
  const overLimit = round ? rec.elapsed >= round.limit : false

  useEffect(() => {
    if (rec.recording && overLimit) rec.stop()
  }, [rec, overLimit])

  const scoreAll = async () => {
    setPhase('scoring')
    setError(null)
    try {
      const results = await Promise.all(
        turns.map((t) =>
          t.file
            ? runAnalysis(
                {
                  participant: t.file,
                  transcript: '',
                  mode: t.round === 1 ? 'interviewer' : 'sandbox',
                  title: `Debate · ${ROUNDS[t.round].label} · ${names[t.speaker]}`,
                  referenceLabel: 'none',
                },
                () => {},
                undefined,
                { save: false },
              )
            : Promise.resolve(null),
        ),
      )
      setTurns((ts) => ts.map((t, i) => ({ ...t, result: results[i] })))
      setPhase('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The debate could not be scored.')
      setPhase('live')
    }
  }

  if (phase === 'setup') {
    return (
      <div className="panel panel-pad stack gap-16" style={{ maxWidth: 760 }}>
        <label className="field">
          <span>Motion</span>
          <input id="debate-motion" className="input" value={motion} onChange={(e) => setMotion(e.target.value)} />
        </label>
        <div className="grid-2">
          {names.map((n, i) => (
            <label key={i} className="field">
              <span>{i === 0 ? 'First speaker' : 'Second speaker'}</span>
              <input
                id={`debate-name-${i}`}
                className="input"
                value={n}
                maxLength={24}
                onChange={(e) => setNames((ns) => (i === 0 ? [e.target.value, ns[1]] : [ns[0], e.target.value]))}
              />
            </label>
          ))}
        </div>
        <ol className="debate-plan">
          {ROUNDS.map((r) => (
            <li key={r.key}>
              <span className="t-section">{r.label}</span>
              <span className="mono t-small muted">{fmtTime(r.limit)} each</span>
              <span className="t-small muted">{r.focus}</span>
            </li>
          ))}
        </ol>
        <div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setPhase('live')} disabled={!motion.trim()}>
            Begin debate
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const total = (s: 0 | 1) => {
      const own = turns.filter((t) => t.speaker === s && t.result)
      return own.length ? own.reduce((acc, t) => acc + (t.result as Analysis).score.total, 0) / own.length : 0
    }
    const t0 = total(0)
    const t1 = total(1)
    const win = Math.abs(t0 - t1) < 0.05 ? null : t0 > t1 ? 0 : 1
    return (
      <div className="stack gap-16">
        <div className="panel panel-pad stack gap-8">
          <span className="t-label">Debate result</span>
          <h2 className="t-title">{motion}</h2>
          <p className="muted">
            {win == null ? 'Draw on delivery.' : `${names[win]} delivered closer to the reference standard.`} Average score{' '}
            {names[0]} <span className="mono num">{t0.toFixed(1)}</span>, {names[1]} <span className="mono num">{t1.toFixed(1)}</span>.
          </p>
        </div>
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Round</th>
                <th>Speaker</th>
                <th className="r">Score</th>
                {BUCKETS.map((b) => (
                  <th key={b.key} className="r">
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turns.map((t, i) => (
                <tr key={i}>
                  <td>{ROUNDS[t.round].label}</td>
                  <td>{names[t.speaker]}</td>
                  {t.result ? (
                    <>
                      <td className="r mono num">{t.result.score.total.toFixed(1)}</td>
                      {BUCKETS.map((b) => (
                        <td key={b.key} className="r mono num">
                          {fmtDeduction((t.result as Analysis).score.buckets[b.key])}
                        </td>
                      ))}
                    </>
                  ) : (
                    <td colSpan={5} className="muted">
                      Skipped
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setTurns(ORDER.map((o) => ({ ...o, file: null, result: null })))
              setCurrent(0)
              setPhase('setup')
            }}
          >
            New debate
          </button>
        </div>
      </div>
    )
  }

  const finished = current >= ORDER.length
  const recorded = turns.filter((t) => t.file).length

  return (
    <div className="debate">
      <ol className="debate-track" aria-label="Turns">
        {ORDER.map((o, i) => (
          <li key={i} className={i < current ? 'is-done' : i === current ? 'is-now' : ''}>
            <span className="t-small">{ROUNDS[o.round].label}</span>
            <span className="t-small muted">{names[o.speaker]}</span>
          </li>
        ))}
      </ol>

      {!finished && turn && round ? (
        <div className="panel panel-pad debate-stage">
          <span className="t-label">
            Round {turn.round + 1} · {round.label}
          </span>
          <h2 className="t-title">{names[turn.speaker]} speaks</h2>
          <p className="muted">{motion}</p>
          <div className={`debate-timer mono num ${overLimit ? 'down' : ''}`} aria-live="off">
            {fmtTime(rec.recording ? Math.max(0, round.limit - rec.elapsed) : round.limit)}
          </div>
          <p className="t-small muted">Focus: {round.focus}</p>
          <div className="row gap-8 wrap" style={{ justifyContent: 'center' }}>
            {rec.recording ? (
              <button type="button" className="btn btn-danger btn-lg" onClick={rec.stop}>
                <Square size={13} fill="currentColor" /> End turn
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => void rec.start()}>
                <Mic size={15} /> Start turn
              </button>
            )}
            {!rec.recording && (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setCurrent((c) => c + 1)}>
                <SkipForward size={15} /> Skip
              </button>
            )}
          </div>
          {rec.recording && <span className="row gap-8 t-small muted"><span className="rec-dot" /> Recording</span>}
          {rec.error && <p className="t-small" style={{ color: 'var(--bad)' }}>{rec.error}</p>}
        </div>
      ) : (
        <div className="panel panel-pad debate-stage">
          <span className="t-label">All turns complete</span>
          <h2 className="t-title">
            {recorded} of {ORDER.length} turns recorded
          </h2>
          {error && (
            <p className="notice notice-bad">
              <CircleAlert size={15} />
              <span>{error}</span>
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={!recorded || phase === 'scoring'}
            onClick={() => void scoreAll()}
          >
            {phase === 'scoring' ? `Scoring ${recorded} turns…` : 'Score the debate'}
          </button>
        </div>
      )}
    </div>
  )
}
