import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/context'
import { LEGAL, type LegalSlug } from '../../lib/legal/docs'

/**
 * Shown instead of the app when the Terms or Privacy Policy changed since the user last
 * accepted them. The API refuses app features until they accept (CONSENT_REQUIRED).
 */
export default function ConsentGate() {
  const { consentNeeded, acceptDocuments, signOut } = useAuth()
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const docs = consentNeeded.filter((d): d is LegalSlug => d in LEGAL)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await acceptDocuments(docs)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your agreement. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="consent-gate">
      <form className="panel panel-pad stack gap-16 consent-card" onSubmit={submit}>
        <div className="stack gap-4">
          <span className="t-label">Updated terms</span>
          <h1 className="t-title">Please review what changed</h1>
          <p className="t-small muted">
            We updated the following since you last agreed. Read them, then accept to keep using Speech Arena.
          </p>
        </div>
        <ul className="list consent-list">
          {docs.map((d) => (
            <li key={d} className="list-row">
              <span className="grow stack">
                <span>{LEGAL[d].title}</span>
                <span className="t-small muted mono">
                  version {LEGAL[d].version} · effective {LEGAL[d].effective}
                </span>
              </span>
              <Link to={`/${d}`} target="_blank" rel="noopener" className="btn btn-sm">
                Read
              </Link>
            </li>
          ))}
        </ul>
        <label className="toggle" style={{ alignItems: 'flex-start' }}>
          <input id="consent-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I have read and agree to the updated {docs.map((d) => LEGAL[d].title).join(' and ')}.</span>
        </label>
        {error && (
          <p className="notice notice-bad" role="alert">
            <CircleAlert size={15} />
            <span>{error}</span>
          </p>
        )}
        <div className="row gap-8 wrap">
          <button type="submit" className="btn btn-primary" disabled={!agreed || busy}>
            {busy ? 'Saving…' : 'Accept and continue'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out instead
          </button>
        </div>
        <p className="t-small faint">
          If you don't agree, you can still sign out, download your data or delete your account from Settings after
          signing in again.
        </p>
      </form>
    </div>
  )
}
