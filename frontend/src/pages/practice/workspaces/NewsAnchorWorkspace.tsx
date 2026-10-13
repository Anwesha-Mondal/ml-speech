import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import AttemptForm from '../../../components/recording/AttemptForm'
import { modesApi, type NewsConfig, type NewsScript, type NewsScriptSummary } from '../../../lib/api/modes'
import BroadcastPrompter from './components/BroadcastPrompter'

/** News Anchor studio (megaev.md §5): wire scripts, teleprompter, breaking-news interruption. */
export default function NewsAnchorWorkspace() {
  const [cfg, setCfg] = useState<NewsConfig | null>(null)
  const [scripts, setScripts] = useState<NewsScriptSummary[]>([])
  const [scriptId, setScriptId] = useState('')
  const [script, setScript] = useState<NewsScript | null>(null)
  const [withAlert, setWithAlert] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([modesApi.newsConfig(), modesApi.newsScripts()])
      .then(([c, s]) => {
        setCfg(c)
        setScripts(s.scripts)
        setScriptId(s.scripts[0]?.script_id ?? '')
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!scriptId) return
    modesApi
      .newsScript(scriptId)
      .then(setScript)
      .catch((e: Error) => setError(e.message))
  }, [scriptId])

  // The anchor reads the flash aloud when it appears, so it is part of what gets aligned.
  const flash = script?.breaking_alert.flash_text.replace(/^FLASH:\s*/, '') ?? ''
  const transcript = script ? (withAlert ? `${script.text} ${flash}` : script.text) : ''

  return (
    <div className="mode-grid">
      <div className="panel panel-pad stack gap-16">
        {error && (
          <p className="notice notice-bad">
            <CircleAlert size={15} />
            <span>{error}</span>
          </p>
        )}
        <div className="grid-2">
          <label className="field">
            <span>Wire script</span>
            <select id="news-script" className="select" value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
              {scripts.map((s) => (
                <option key={s.script_id} value={s.script_id}>
                  {s.title} · {s.target_wpm} wpm
                </option>
              ))}
            </select>
          </label>
          <label className="toggle" style={{ alignSelf: 'end' }}>
            <input id="news-alert" type="checkbox" checked={withAlert} onChange={(e) => setWithAlert(e.target.checked)} />
            <span>Breaking-news interruption</span>
          </label>
        </div>
        {script && cfg && (
          <AttemptForm
            key={`${script.script_id}-${withAlert}`}
            mode="news_anchor"
            showReferencePicker={false}
            initialTranscript={transcript}
            transcriptLabel="Script (used for word timing)"
            transcriptHelp="Includes the breaking-news line when the interruption is on."
            stage={() => (
              <BroadcastPrompter
                text={script.text}
                cfg={cfg}
                targetWpm={script.target_wpm}
                alert={withAlert ? script.breaking_alert : null}
              />
            )}
            submitLabel="Analyze broadcast"
          />
        )}
      </div>
      <aside className="stack gap-16">
        <div className="focus">
          <span className="t-label">Measured with extra weight</span>
          <ul>
            <li>Steady pacing in the broadcast band</li>
            <li>Rising pitch at the end of statements</li>
            <li>Clarity and energy</li>
          </ul>
        </div>
        {script && (
          <div className="panel panel-pad stack gap-8">
            <span className="t-section">Studio notes</span>
            <p className="t-small muted">
              {script.category} · about {Math.round(script.estimated_duration_sec)} s at {script.target_wpm} wpm
            </p>
            {script.phonetics.length > 0 && (
              <ul className="howto">
                {script.phonetics.map((p) => (
                  <li key={p.word}>
                    <strong>{p.word}</strong> <span className="mono">{p.say}</span>
                  </li>
                ))}
              </ul>
            )}
            {withAlert && (
              <p className="t-small muted">
                A breaking-news line appears at {script.breaking_alert.trigger_at_second.toFixed(0)} s. Pause briefly,
                read it, then return to the script.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
