import { useState } from 'react'
import AttemptForm from '../../components/recording/AttemptForm'
import type { Mode } from '../../lib/api/types'
import { MODES } from '../../lib/analysis/model'
import { useSettings } from '../../lib/settings'

export default function SpeechTest() {
  const { defaultMode } = useSettings()
  const [mode, setMode] = useState<Mode>((MODES.find((m) => m.key === defaultMode)?.key ?? 'sandbox') as Mode)
  const focus = MODES.find((m) => m.key === mode)?.focus

  return (
    <div className="practice-grid">
      <div className="panel panel-pad">
        <AttemptForm mode={mode} />
      </div>
      <aside className="stack gap-16">
        <div className="panel panel-pad stack gap-12">
          <span className="t-section">Practice mode</span>
          <div className="stack gap-4" role="radiogroup" aria-label="Practice mode">
            {MODES.map((m) => (
              <label key={m.key} className={`mode-option ${m.key === mode ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name="practice-mode"
                  id={`mode-${m.key}`}
                  value={m.key}
                  checked={m.key === mode}
                  onChange={() => setMode(m.key)}
                />
                <span className="stack">
                  <span className="mode-option-title">{m.label}</span>
                  <span className="t-small muted">{m.focus}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="t-small faint">Selected: {focus}</p>
        </div>
        <div className="panel panel-pad stack gap-8">
          <span className="t-section">How the score works</span>
          <ol className="howto">
            <li>Your words are matched to the reference word by word.</li>
            <li>Pace, pauses, pitch range and energy are measured per word.</li>
            <li>Deviations past fixed thresholds become flaws with exact timestamps.</li>
            <li>Each flaw deducts points from its bucket, up to a cap.</li>
          </ol>
        </div>
      </aside>
    </div>
  )
}
