import { CircleAlert, Gauge, Headphones, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AttemptForm from '../../../components/recording/AttemptForm'
import { modesApi, type Motion, type PublicConfig, type Spar } from '../../../lib/api/modes'
import { startCrowd, startMeter, type Crowd, type Meter } from '../../../lib/audio/crowd'
import BreathingPacer from './components/BreathingPacer'

function DebateClock({ stages }: { stages: { id: string; label: string; seconds: number }[] }) {
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(stages[0]?.seconds ?? 0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || left <= 0) return
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [running, left])

  const stage = stages[idx]
  if (!stage) return null
  return (
    <div className="debate-clock">
      <div className="row between">
        <span className="t-small muted">
          {idx + 1}/{stages.length} · {stage.label}
        </span>
        <span className={`mono num debate-time ${left <= 30 ? 'warn-text' : ''}`}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="row gap-8">
        <button type="button" className="btn btn-sm" onClick={() => setRunning((r) => !r)} disabled={left <= 0}>
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={idx >= stages.length - 1}
          onClick={() => {
            setIdx(idx + 1)
            setLeft(stages[idx + 1].seconds)
            setRunning(false)
          }}
        >
          <SkipForward size={13} /> Next stage
        </button>
      </div>
    </div>
  )
}

/** Public Speaking & Debate arena (megaev.md §6, §19, §37). */
export default function PublicSpeakingWorkspace() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null)
  const [motions, setMotions] = useState<Motion[]>([])
  const [tier, setTier] = useState(1)
  const [ready, setReady] = useState(false)
  const [crowdOn, setCrowdOn] = useState(false)
  const crowd = useRef<Crowd | null>(null)
  const meter = useRef<Meter | null>(null)
  const [level, setLevel] = useState<{ db: number; over: number } | null>(null)
  const [motionId, setMotionId] = useState('')
  const [stance, setStance] = useState<'affirmative' | 'negative'>('affirmative')
  const [spar, setSpar] = useState<Spar | null>(null)
  const [format, setFormat] = useState('practice_round')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([modesApi.publicConfig(), modesApi.motions()])
      .then(([c, m]) => {
        setCfg(c)
        setMotions(m.motions)
        setMotionId(m.motions[0]?.motion_id ?? '')
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      crowd.current?.stop()
      meter.current?.stop()
    }
  }, [])

  const onBreathingDone = useCallback(() => setReady(true), [])

  const toggleCrowd = () => {
    if (!cfg) return
    if (crowdOn) {
      crowd.current?.stop()
      crowd.current = null
      setCrowdOn(false)
    } else {
      crowd.current = startCrowd(cfg.stage_tiers.find((t) => t.tier === tier) ?? cfg.stage_tiers[0])
      setCrowdOn(true)
    }
  }

  const toggleMeter = async () => {
    if (meter.current) {
      meter.current.stop()
      meter.current = null
      setLevel(null)
      return
    }
    try {
      meter.current = await startMeter((db, over) => setLevel({ db, over }))
    } catch {
      setError('The microphone is not available for the level meter.')
    }
  }

  const loadSpar = async () => {
    setError(null)
    try {
      setSpar(await modesApi.spar(motionId, stance))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!cfg) {
    return error ? (
      <p className="notice notice-bad">
        <CircleAlert size={15} />
        <span>{error}</span>
      </p>
    ) : null
  }

  const target = cfg.projection_target_db
  return (
    <div className="mode-grid">
      <div className="panel panel-pad stack gap-16">
        <div className="stack gap-8">
          <span className="t-section">Stage</span>
          <div className="segmented" role="group" aria-label="Stage tier">
            {cfg.stage_tiers.map((t) => (
              <button
                key={t.tier}
                type="button"
                aria-pressed={tier === t.tier}
                onClick={() => {
                  setTier(t.tier)
                  if (crowdOn) {
                    crowd.current?.stop()
                    crowd.current = startCrowd(t)
                  }
                }}
              >
                {t.tier}. {t.name}
              </button>
            ))}
          </div>
          <div className="row gap-8 wrap">
            <button type="button" className="btn btn-sm" onClick={toggleCrowd}>
              {crowdOn ? <VolumeX size={13} /> : <Volume2 size={13} />} {crowdOn ? 'Stop audience' : 'Play audience'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={toggleMeter}>
              <Gauge size={13} /> {level ? 'Stop level meter' : 'Level meter'}
            </button>
            <span className="t-small muted row gap-4">
              <Headphones size={13} /> Use headphones so the audience isn’t recorded.
            </span>
          </div>
          {level && (
            <div className="meter" aria-label="Projection over room noise">
              <div className="meter-bar" style={{ width: `${Math.max(0, Math.min(100, (level.over / (target * 2)) * 100))}%` }} />
              <div className="meter-target" style={{ left: '50%' }} />
              <span className="t-small mono num">
                {level.over.toFixed(1)} dB over room noise (target {target} dB)
              </span>
            </div>
          )}
        </div>

        {!ready ? (
          <BreathingPacer cfg={cfg.breathing} onDone={onBreathingDone} />
        ) : (
          <AttemptForm
            mode="public_speaking"
            showReferencePicker={false}
            initialTranscript=""
            transcriptLabel="Your speech as text (optional)"
            transcriptHelp="Speeches are usually improvised; leave empty to estimate word timing from the audio."
            submitLabel="Analyze speech"
          />
        )}
      </div>

      <aside className="stack gap-16">
        <div className="panel panel-pad stack gap-12">
          <span className="t-section">Debate sparring</span>
          <label className="field">
            <span>Motion</span>
            <select id="ps-motion" className="select" value={motionId} onChange={(e) => setMotionId(e.target.value)}>
              {motions.map((m) => (
                <option key={m.motion_id} value={m.motion_id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Your side">
            {(['affirmative', 'negative'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={stance === s} onClick={() => setStance(s)}>
                {s === 'affirmative' ? 'For' : 'Against'}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-sm" onClick={loadSpar} disabled={!motionId}>
            Hear the opposing case
          </button>
          {spar && (
            <div className="stack gap-8 t-small">
              <p className="muted">{spar.motion}</p>
              <p>
                <strong>Opponent ({spar.opponent_stance}):</strong> {spar.rebuttal_text}
              </p>
              <p>
                <strong>Cross-examination:</strong> {spar.cross_examination}
              </p>
              <p className="warn-text">{spar.point_of_information}</p>
            </div>
          )}
        </div>
        <div className="panel panel-pad stack gap-8">
          <span className="t-section">Debate clock</span>
          <select id="ps-format" className="select" value={format} onChange={(e) => setFormat(e.target.value)}>
            {Object.entries(cfg.debate_formats).map(([k, f]) => (
              <option key={k} value={k}>
                {f.label}
              </option>
            ))}
          </select>
          {/* Remount per format so the clock starts from the first stage. */}
          <DebateClock key={format} stages={cfg.debate_formats[format].stages} />
        </div>
        <div className="focus">
          <span className="t-label">Measured with extra weight</span>
          <ul>
            <li>Energy and projection</li>
            <li>Pitch variation</li>
            <li>Deliberate pauses of 1–2.5 s</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
