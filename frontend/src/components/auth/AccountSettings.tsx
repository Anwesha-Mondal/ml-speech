import { CircleAlert, Laptop, LogOut, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { authApi, type PasswordPolicy, type SessionInfo } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/context'
import { fmtDateTime } from '../../lib/format'
import { PasswordFeedback, PasswordField } from './PasswordField'

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

export function ProfileForm() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.display_name ?? '')
  const [state, setState] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; msg?: string }>({ kind: 'idle' })
  if (!user) return null
  const dirty = name.trim() !== user.display_name && name.trim().length > 0

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setState({ kind: 'saving' })
    try {
      const r = await authApi.updateProfile(name.trim())
      updateUser(r.user)
      setState({ kind: 'saved' })
    } catch (err) {
      setState({ kind: 'error', msg: errMsg(err, 'Could not save your name.') })
    }
  }

  return (
    <form className="stack gap-12" onSubmit={save}>
      <dl className="kv" style={{ maxWidth: 420 }}>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Role</dt>
        <dd>
          <span className={`badge badge-mono ${user.role === 'admin' ? 'badge-warn' : ''}`}>{user.role.toUpperCase()}</span>
        </dd>
        <dt>Member since</dt>
        <dd>{user.created_at ? fmtDateTime(user.created_at) : '—'}</dd>
      </dl>
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="settings-name">Display name</label>
        <input
          id="settings-name"
          className="input"
          value={name}
          maxLength={64}
          autoComplete="nickname"
          onChange={(e) => {
            setName(e.target.value)
            setState({ kind: 'idle' })
          }}
        />
      </div>
      <div className="row gap-12">
        <button type="submit" className="btn" disabled={!dirty || state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Saving…' : 'Save name'}
        </button>
        {state.kind === 'saved' && <span className="t-small muted">Saved.</span>}
        {state.kind === 'error' && <span className="t-small" style={{ color: 'var(--bad)' }}>{state.msg}</span>}
      </div>
    </form>
  )
}

export function ChangePasswordForm() {
  const { user } = useAuth()
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nextOk, setNextOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    authApi.policy().then(setPolicy).catch(() => {})
  }, [])

  const matches = confirm.length > 0 && confirm === next
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!nextOk || !matches) return
    setBusy(true)
    setResult(null)
    try {
      const r = await authApi.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setResult({
        ok: true,
        msg:
          r.revoked_sessions > 0
            ? `Password changed. ${r.revoked_sessions} other session${r.revoked_sessions === 1 ? ' was' : 's were'} signed out.`
            : 'Password changed.',
      })
    } catch (err) {
      setResult({ ok: false, msg: errMsg(err, 'Could not change the password.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack gap-12" onSubmit={submit} style={{ maxWidth: 420 }}>
      {/* Hidden username field lets password managers attach the new password to the right account. */}
      <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
      <PasswordField id="pw-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField id="pw-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" describedBy="pw-new-feedback" />
      <PasswordFeedback
        id="pw-new-feedback"
        password={next}
        email={user?.email}
        name={user?.display_name}
        min={policy?.min_length ?? 12}
        max={policy?.max_length ?? 128}
        onValidity={setNextOk}
      />
      <PasswordField
        id="pw-confirm"
        label="Repeat new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        invalid={confirm.length > 0 && !matches}
      />
      {confirm && !matches && (
        <p className="t-small" style={{ color: 'var(--bad)', marginTop: -6 }}>
          The passwords don't match.
        </p>
      )}
      {result && (
        <p className={`notice ${result.ok ? '' : 'notice-bad'}`} role={result.ok ? 'status' : 'alert'}>
          {!result.ok && <CircleAlert size={15} />}
          <span>{result.msg}</span>
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy || !current || !nextOk || !matches}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </div>
      <p className="t-small faint">Changing your password signs out every other device.</p>
    </form>
  )
}

function describeAgent(ua: string): { label: string; mobile: boolean } {
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua)
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : ua
            ? ua.split(/[ /]/)[0].slice(0, 24) // e.g. "curl" or a script's client name
            : 'Unknown client'
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return { label: os ? `${browser} on ${os}` : browser, mobile }
}

export function SessionsPanel() {
  const { signOut } = useAuth()
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSessions((await authApi.sessions()).sessions)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Could not load your sessions.'))
    }
  }, [])

  useEffect(() => {
    let alive = true
    authApi
      .sessions()
      .then((r) => alive && setSessions(r.sessions))
      .catch((e) => alive && setError(errMsg(e, 'Could not load your sessions.')))
    return () => {
      alive = false
    }
  }, [])

  const others = sessions?.filter((s) => !s.current).length ?? 0

  return (
    <div className="stack gap-12">
      {error && <p className="notice notice-bad">{error}</p>}
      {sessions && (
        <ul className="sessions">
          {sessions.map((s) => {
            const a = describeAgent(s.user_agent)
            const Icon = a.mobile ? Smartphone : Laptop
            return (
              <li key={s.id}>
                <Icon size={18} strokeWidth={1.6} />
                <span className="grow stack">
                  <span>
                    {a.label} {s.current && <span className="badge badge-good">This device</span>}
                  </span>
                  <span className="t-small muted">
                    {s.ip || 'unknown IP'} · last active {s.last_seen_at ? fmtDateTime(s.last_seen_at) : '—'} · signed in{' '}
                    {s.created_at ? fmtDateTime(s.created_at) : '—'}
                  </span>
                </span>
                {!s.current && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={async () => {
                      try {
                        await authApi.revokeSession(s.id)
                        setMsg('Signed out that device.')
                        await load()
                      } catch (e) {
                        setError(errMsg(e, 'Could not sign out that device.'))
                      }
                    }}
                  >
                    Sign out
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="row gap-8 wrap">
        <button
          type="button"
          className="btn"
          disabled={!others}
          onClick={async () => {
            try {
              const r = await authApi.logoutOthers()
              setMsg(`Signed out ${r.revoked_sessions} other session${r.revoked_sessions === 1 ? '' : 's'}.`)
              await load()
            } catch (e) {
              setError(errMsg(e, 'Could not sign out other sessions.'))
            }
          }}
        >
          Sign out all other devices
        </button>
        <button type="button" className="btn btn-danger" onClick={() => void signOut()}>
          <LogOut size={14} /> Sign out
        </button>
        {msg && <span className="t-small muted">{msg}</span>}
      </div>
    </div>
  )
}
