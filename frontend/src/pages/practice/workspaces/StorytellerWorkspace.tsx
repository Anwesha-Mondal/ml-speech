import { Check, CircleAlert, Minus, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AudioInput from '../../../components/recording/AudioInput'
import ProcessingSteps from '../../../components/recording/ProcessingSteps'
import type { Analysis } from '../../../lib/analysis/model'
import { useInlineRun } from '../../../lib/analysis/useInlineRun'
import { modesApi, parseScript, type ArcResult, type StoryScript, type StorySummary } from '../../../lib/api/modes'

const CHECK_LABELS: Record<string, string> = {
  climax_is_loudest_phase: 'Climax is the loudest phase',
  climax_above_exposition: 'Climax clearly louder than the opening',
  resolution_below_climax: 'Resolution settles below the climax',
}

/** Storyteller studio (megaev.md §7): character-coded scripts and a Freytag energy arc. */
export default function StorytellerWorkspace() {
  const [stories, setStories] = useState<StorySummary[]>([])
  const [storyId, setStoryId] = useState('')
  const [story, setStory] = useState<StoryScript | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [arc, setArc] = useState<ArcResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inline = useInlineRun()

  useEffect(() => {
    modesApi
      .storyScripts()
      .then((s) => {
        setStories(s.scripts)
        setStoryId(s.scripts[0]?.script_id ?? '')
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!storyId) return
    modesApi
      .storyScript(storyId)
      .then(setStory)
      .catch((e: Error) => setError(e.message))
  }, [storyId])

  const segments = useMemo(() => (story ? parseScript(story.script_text) : []), [story])
  const voiceIndex = (name: string | null) => (name ? (story?.characters.findIndex((c) => c.name === name) ?? 0) : 0)

  const submit = async () => {
    if (!story || !file) return
    setError(null)
    setArc(null)
    const a = await inline.run({
      participant: file,
      transcript: story.text,
      mode: 'storytelling',
      title: `Story · ${story.title}`,
      referenceLabel: 'none',
    })
    if (!a) return
    setAnalysis(a)
    if (a.jobId) {
      try {
        setArc(await modesApi.storyArc(a.jobId))
      } catch (e) {
        setError((e as Error).message)
      }
    }
  }

  const metrics = analysis?.raw?.metrics
  const maxDb = arc ? Math.max(...arc.phases.map((p) => p.mean_energy_db ?? -60)) : 0
  const minDb = arc ? Math.min(...arc.phases.map((p) => p.mean_energy_db ?? -60)) : 0

  return (
    <div className="mode-grid">
      <div className="panel panel-pad stack gap-16">
        {error && (
          <p className="notice notice-bad">
            <CircleAlert size={15} />
            <span>{error}</span>
          </p>
        )}
        <label className="field">
          <span>Story</span>
          <select
            id="story-script"
            className="select"
            value={storyId}
            onChange={(e) => {
              setStoryId(e.target.value)
              setAnalysis(null)
              setArc(null)
            }}
          >
            {stories.map((s) => (
              <option key={s.script_id} value={s.script_id}>
                {s.title} · {s.format}
              </option>
            ))}
          </select>
        </label>

        {story && (
          <div className="story-script" aria-label="Story script">
            {segments.map((s, i) =>
              s.kind === 'pause' ? (
                <span key={i} className="cue">
                  ⏸ {s.seconds}s
                </span>
              ) : s.kind === 'climax' ? (
                <span key={i} className="cue cue-climax">
                  climax
                </span>
              ) : (
                <span key={i} className={`voice voice-${voiceIndex(s.voice)}`}>
                  {s.text}
                </span>
              ),
            )}
          </div>
        )}

        {inline.progress ? (
          <div className="stack gap-12">
            <ProcessingSteps progress={inline.progress} />
            {inline.error && (
              <div className="stack gap-12">
                <p className="notice notice-bad">
                  <CircleAlert size={15} />
                  <span>{inline.error}</span>
                </p>
                <div className="row gap-8">
                  <button type="button" className="btn btn-primary" onClick={inline.reset}>
                    <RotateCcw size={14} /> Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <AudioInput id="story-audio" file={file} onFile={setFile} label="Your reading" />
            {inline.error && (
              <p className="notice notice-bad">
                <CircleAlert size={15} />
                <span>{inline.error}</span>
              </p>
            )}
            <div>
              <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={!file || !story}>
                Analyze story
              </button>
            </div>
          </>
        )}

        {analysis && (
          <div className="stack gap-12">
            <div className="row between wrap gap-8">
              <span className="t-section">
                Delivery score <span className="mono num">{analysis.score.total.toFixed(1)}</span>
              </span>
              <Link to={`/analysis/${analysis.id}`} className="btn btn-sm">
                Full analysis
              </Link>
            </div>
            {arc && (
              <div className="arc" aria-label="Narrative energy arc">
                {arc.phases.map((p) => {
                  const h = p.mean_energy_db === null || maxDb === minDb ? 10 : 15 + ((p.mean_energy_db - minDb) / (maxDb - minDb)) * 85
                  return (
                    <div key={p.id} className="arc-col">
                      <div className="arc-bar" style={{ height: `${h}%` }} title={`${p.mean_energy_db ?? '–'} dB`} />
                      <span className="t-small">{p.label}</span>
                      <span className="t-small mono num muted">{p.mean_energy_db === null ? '–' : `${p.mean_energy_db} dB`}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {arc && (
              <ul className="star-list">
                {Object.entries(arc.checks).map(([k, ok]) => (
                  <li key={k} className={ok ? 'is-on' : ''}>
                    {ok ? <Check size={14} /> : <Minus size={14} />}
                    <span>{CHECK_LABELS[k] ?? k}</span>
                  </li>
                ))}
              </ul>
            )}
            {metrics && story && (
              <p className="t-small">
                Pitch range <span className="mono num">{metrics.pitch_range_st.toFixed(1)} st</span> (target ≥{' '}
                {story.target_pitch_range_st} st) · energy range{' '}
                <span className="mono num">{metrics.energy_range_db.toFixed(1)} dB</span> · deliberate pauses{' '}
                <span className="mono num">{metrics.deliberate_pause_count}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="stack gap-16">
        {story && (
          <div className="panel panel-pad stack gap-8">
            <span className="t-section">Voices</span>
            <span className="t-small muted">
              {story.genre} · climax around {story.target_climax_sec.toFixed(0)} s
            </span>
            <ul className="voice-legend">
              {story.characters.map((c, i) => (
                <li key={c.name}>
                  <span className={`voice-dot voice-${i}`} />
                  <span>
                    <strong>{c.name}</strong>{' '}
                    <span className="mono num">
                      {c.semitone_shift > 0 ? '+' : ''}
                      {c.semitone_shift.toFixed(1)} st
                    </span>
                    <br />
                    <span className="t-small muted">{c.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="focus">
          <span className="t-label">Measured with extra weight</span>
          <ul>
            <li>Dynamic range in pitch</li>
            <li>Dynamic range in energy</li>
            <li>Pauses before key lines</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
