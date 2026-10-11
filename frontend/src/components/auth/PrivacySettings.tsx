import { CircleAlert, Download } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { privacyApi } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/context'
import { setConsent, useConsent, type ConsentChoice } from '../../lib/consent'
import { CookieChoices } from '../legal/CookieBanner'
import { PasswordField } from './PasswordField'

export function CookiePreferences() {
  const { choice, needsChoice } = useConsent()
  const [draft, setDraft] = useState<ConsentChoice>(choice)
  const [saved, setSaved] = useState(false)
  const dirty = draft.preferences !== choice.preferences || draft.history !== choice.history || needsChoice
  return (
    <div className="stack gap-12">
      <CookieChoices
        value={draft}
        onChange={(c) => {
          setDraft(c)
          setSaved(false)
        }}
      />
      <div className="row gap-12">
        <button
          type="button"
          className="btn"
          disabled={!dirty}
          onClick={() => {
            setConsent(draft)
            setSaved(true)
          }}
        >
          Save choices
        </button>
        {saved && <span className="t-small muted">Saved. Anything you turned off was deleted from this browser.</span>}
      </div>
    </div>
  )
}

export function ExportData() {
  const [state, setState] = useState<{ busy: boolean; msg?: string; bad?: boolean }>({ busy: false })
  const download = async () => {
    setState({ busy: true })
    try {
      const blob = await privacyApi.exportData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'speech-arena-my-data.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setState({ busy: false, msg: 'Downloaded speech-arena-my-data.json.' })
    } catch (e) {
      setState({ busy: false, bad: true, msg: e instanceof ApiError ? e.message : 'The export failed.' })
    }
  }
  return (
    <div className="row gap-12 wrap">
      <button type="button" className="btn" onClick={() => void download()} disabled={state.busy}>
        <Download size={14} /> {state.busy ? 'Preparing…' : 'Download my data'}
      </button>
      {state.msg && (
        <span className="t-small" style={{ color: state.bad ? 'var(--bad)' : 'var(--muted)' }}>
          {state.msg}
        </span>
      )}
    </div>
  )
}

export function DeleteAccount() {
  const { user, accountDeleted } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await privacyApi.deleteAccount(password, confirm)
      accountDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The account could not be deleted.')
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
          Delete account
        </button>
      </div>
    )
  }
  return (
    <form className="stack gap-12 delete-box" onSubmit={submit} style={{ maxWidth: 420 }}>
      <p className="notice notice-bad">
        <CircleAlert size={15} />
        <span>
          This permanently deletes your account, sign-in sessions and agreement records. It can't be undone. Download
          your data first if you want a copy.
        </span>
      </p>
      <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
      <PasswordField id="delete-password" label="Your password" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="field">
        <label htmlFor="delete-confirm">
          Type <span className="mono">DELETE</span> to confirm
        </label>
        <input
          id="delete-confirm"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {error && <p className="t-small" style={{ color: 'var(--bad)' }}>{error}</p>}
      <div className="row gap-8">
        <button type="submit" className="btn btn-danger" disabled={busy || !password || confirm !== 'DELETE'}>
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setOpen(false)
            setPassword('')
            setConfirm('')
            setError(null)
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
