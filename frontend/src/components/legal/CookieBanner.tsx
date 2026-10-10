import { Cookie } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { closeCookieSettings, setConsent, useConsent, useCookieSettingsOpen, type ConsentChoice } from '../../lib/consent'

/** The two optional storage categories, as switches. Used in the banner and in Settings. */
export function CookieChoices({ value, onChange }: { value: ConsentChoice; onChange: (c: ConsentChoice) => void }) {
  return (
    <div className="cookie-choices">
      <label className="cookie-choice is-locked">
        <input type="checkbox" checked disabled id="cookie-necessary" />
        <span className="stack">
          <span className="cookie-choice-title">Strictly necessary</span>
          <span className="t-small muted">Keeps you signed in and remembers this choice. Always on.</span>
        </span>
      </label>
      <label className="cookie-choice">
        <input
          type="checkbox"
          id="cookie-preferences"
          checked={value.preferences}
          onChange={(e) => onChange({ ...value, preferences: e.target.checked })}
        />
        <span className="stack">
          <span className="cookie-choice-title">Preferences</span>
          <span className="t-small muted">Remember your theme, sidebar and default practice mode.</span>
        </span>
      </label>
      <label className="cookie-choice">
        <input
          type="checkbox"
          id="cookie-history"
          checked={value.history}
          onChange={(e) => onChange({ ...value, history: e.target.checked })}
        />
        <span className="stack">
          <span className="cookie-choice-title">History</span>
          <span className="t-small muted">Keep your past analysis scores and battles in this browser to track progress.</span>
        </span>
      </label>
    </div>
  )
}

/**
 * Shown until the visitor makes a choice (and again when the Cookie Policy version changes).
 * Rejecting is as easy as accepting: both are one click, side by side, equally prominent.
 * Nothing optional is stored before a choice is made.
 */
export default function CookieBanner() {
  const { needsChoice, choice } = useConsent()
  const reopen = useCookieSettingsOpen()
  const [detailed, setDetailed] = useState(false)
  const [draft, setDraft] = useState<ConsentChoice>(choice)
  const ref = useRef<HTMLDivElement>(null)
  const visible = needsChoice || reopen
  const showDetails = detailed || reopen

  useEffect(() => {
    if (reopen) ref.current?.focus()
  }, [reopen])

  if (!visible) return null

  const decide = (c: ConsentChoice) => {
    setConsent(c)
    setDetailed(false)
    closeCookieSettings()
  }

  return (
    <div
      ref={ref}
      className="cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      tabIndex={-1}
    >
      <div className="cookie-banner-inner">
        <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
          <Cookie size={18} strokeWidth={1.6} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
          <div className="stack gap-4 grow">
            <span id="cookie-title" className="t-section">
              Your storage choices
            </span>
            <p className="t-small muted">
              Speech Arena uses one essential cookie to keep you signed in. With your permission it also saves your
              preferences and analysis history in this browser. No ads, analytics or third-party cookies.{' '}
              <Link to="/cookies">Cookie Policy</Link>
            </p>
          </div>
        </div>
        {showDetails && <CookieChoices value={draft} onChange={setDraft} />}
        <div className="row gap-8 wrap cookie-actions">
          <button type="button" className="btn" onClick={() => decide({ preferences: false, history: false })}>
            Essential only
          </button>
          {showDetails ? (
            <button type="button" className="btn" onClick={() => decide(draft)}>
              Save my choices
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDraft(choice)
                setDetailed(true)
              }}
            >
              Choose
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => decide({ preferences: true, history: true })}>
            Allow all
          </button>
        </div>
      </div>
    </div>
  )
}
