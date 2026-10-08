import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import { MODES, SCORING_VERSION } from '../../lib/analysis/model'
import { clearAnalyses, useAnalyses } from '../../lib/analysis/store'
import { API_BASE } from '../../lib/api/client'
import { clearBattles, useBattles } from '../../lib/battles'
import { updateSettings, useSettings, type Theme } from '../../lib/settings'

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="panel settings-section">
      <div className="stack gap-4">
        <span className="t-section">{title}</span>
        <span className="t-small muted">{desc}</span>
      </div>
      <div className="stack gap-16">{children}</div>
    </section>
  )
}

export default function Settings() {
  const s = useSettings()
  const analyses = useAnalyses()
  const battles = useBattles()
  const [confirming, setConfirming] = useState(false)
  const [cleared, setCleared] = useState(false)

  return (
    <>
      <PageHeader title="Settings" description="Saved in this browser only." />
      <div className="settings">
        <Section title="Profile" desc="Shown on battles and in the top bar.">
          <label className="field">
            <span>Display name</span>
            <input
              id="settings-name"
              className="input"
              style={{ maxWidth: 320 }}
              value={s.name}
              maxLength={32}
              onChange={(e) => updateSettings({ name: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && updateSettings({ name: 'You' })}
            />
          </label>
        </Section>

        <Section title="Appearance" desc="Light is the default. System follows your operating system.">
          <div className="segmented" role="group" aria-label="Theme">
            {(['light', 'dark', 'system'] as Theme[]).map((t) => (
              <button key={t} type="button" aria-pressed={s.theme === t} onClick={() => updateSettings({ theme: t })}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Audio & practice" desc="Defaults for new attempts.">
          <label className="field">
            <span>Default practice mode</span>
            <select
              id="settings-mode"
              className="select"
              style={{ maxWidth: 320 }}
              value={s.defaultMode}
              onChange={(e) => updateSettings({ defaultMode: e.target.value })}
            >
              {MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle">
            <input
              id="settings-confidence"
              type="checkbox"
              checked={s.showConfidence}
              onChange={(e) => updateSettings({ showConfidence: e.target.checked })}
            />
            <span>Warn when a flaw's measurement confidence is below 0.80</span>
          </label>
        </Section>

        <Section title="Privacy" desc="What leaves your device.">
          <ul className="howto">
            <li>Recordings are sent to the Speech Arena API at <span className="mono">{API_BASE}</span> for scoring.</li>
            <li>The browser never stores recordings. Scores, flaws and transcripts are kept in local storage.</li>
            <li>Mimic Party runs entirely in your browser; nothing is uploaded.</li>
            <li>No speaker identity, emotion or personality is inferred.</li>
          </ul>
        </Section>

        <Section title="Data" desc="Everything saved in this browser.">
          <p className="t-small">
            {analyses.length} analyses and {battles.length} battles saved.
          </p>
          {confirming ? (
            <div className="confirm" role="alert">
              <span className="grow">Delete all saved analyses and battles? This can't be undone.</span>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  clearAnalyses()
                  clearBattles()
                  setConfirming(false)
                  setCleared(true)
                }}
              >
                Delete all
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="row gap-12">
              <button
                type="button"
                className="btn btn-danger"
                disabled={!analyses.length && !battles.length}
                onClick={() => {
                  setCleared(false)
                  setConfirming(true)
                }}
              >
                Delete saved data
              </button>
              {cleared && <span className="t-small muted">Deleted.</span>}
            </div>
          )}
        </Section>

        <Section title="Scoring information" desc="How results are produced.">
          <p className="t-small">
            Scoring version <span className="mono">{SCORING_VERSION}</span>. Scores are deterministic: the same input gives the
            same score. Explanations are fixed templates, not generated text.{' '}
            <Link to="/system/scoring">See the rules</Link>.
          </p>
        </Section>
      </div>
    </>
  )
}
