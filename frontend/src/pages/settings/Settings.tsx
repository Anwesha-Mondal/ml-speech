import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChangePasswordForm, ProfileForm, SessionsPanel } from '../../components/auth/AccountSettings'
import { CookiePreferences, DeleteAccount, ExportData } from '../../components/auth/PrivacySettings'
import OptInToggle from '../../components/leaderboard/OptInToggle'
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
      <PageHeader title="Settings" description="Account and security settings are stored on the server. Appearance and practice defaults are saved in this browser." />
      <div className="settings">
        <Section title="Account" desc="Your sign-in identity. The display name is shown on battles and in the top bar.">
          <ProfileForm />
        </Section>

        <Section title="Password" desc="Use a long passphrase you don't use anywhere else.">
          <ChangePasswordForm />
        </Section>

        <Section title="Signed-in devices" desc="Sessions end after 24 hours without activity, or 7 days at most.">
          <SessionsPanel />
        </Section>

        <Section title="Leaderboard" desc="Off by default. Turning it off removes your name and deletes your stored scores.">
          <OptInToggle />
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

        <Section title="Privacy" desc="What leaves your device, and your choices.">
          <ul className="howto">
            <li>Recordings are sent to the Speech Arena API at <span className="mono">{API_BASE}</span> for scoring and are never stored.</li>
            <li>Passwords are stored only as salted scrypt hashes; the sign-in cookie can't be read by page scripts.</li>
            <li>Mimic Party runs entirely in your browser; nothing is uploaded.</li>
            <li>No speaker identity, emotion or personality is inferred. No ads, analytics or third-party cookies.</li>
          </ul>
          <p className="t-small">
            Read the <Link to="/privacy">Privacy Policy</Link>, <Link to="/terms">Terms</Link> and{' '}
            <Link to="/cookies">Cookie Policy</Link>.
          </p>
        </Section>

        <Section title="Cookies & browser storage" desc="Optional storage is off unless you turn it on.">
          <CookiePreferences />
        </Section>

        <Section title="Your data" desc="Download everything the server holds about you, or delete your account.">
          <ExportData />
          <DeleteAccount />
        </Section>

        <Section title="Saved in this browser" desc="Analyses and battles kept here for your account (only if you allowed History).">
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
