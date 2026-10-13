import { Check, CircleAlert, Info, LockKeyhole } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PasswordFeedback, PasswordField } from '../../components/auth/PasswordField'
import SiteFooter from '../../components/legal/SiteFooter'
import { authApi, type PasswordPolicy } from '../../lib/api/auth'
import { ApiError, API_BASE } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/context'
import { safeNext } from '../../lib/auth/redirect'

const DEFAULT_POLICY: PasswordPolicy = {
  min_length: 8,
  max_length: 128,
  registration_open: true,
  lockout_attempts: 5,
  lock_minutes: 15,
}

function usePolicy(): PasswordPolicy {
  const [p, setP] = useState(DEFAULT_POLICY)
  useEffect(() => {
    authApi.policy().then(setP).catch(() => {})
  }, [])
  return p
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-brand">
          <svg width="22" height="22" viewBox="0 0 22 22">
            <rect x="2" y="8" width="2" height="6" rx="1" fill="currentColor" />
            <rect x="6" y="4" width="2" height="14" rx="1" fill="currentColor" />
            <rect x="10" y="7" width="2" height="8" rx="1" fill="currentColor" />
            <rect x="14" y="2" width="2" height="18" rx="1" fill="currentColor" />
            <rect x="18" y="9" width="2" height="4" rx="1" fill="currentColor" />
          </svg>
          Speech Guru
        </div>
        <svg className="auth-wave" viewBox="0 0 400 120" preserveAspectRatio="none">
          {Array.from({ length: 80 }, (_, i) => {
            const h = 6 + Math.abs(Math.sin(i * 0.23) * Math.cos(i * 0.071)) * 96 + ((i * 37) % 9)
            return <rect key={i} x={i * 5} y={60 - h / 2} width="2" height={h} rx="1" />
          })}
        </svg>
        <p className="auth-tagline">
          Train how you speak.
          <br />
          Measure how you deliver.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="stack gap-4">
            <h1 className="t-title">{title}</h1>
            <p className="muted t-small">{subtitle}</p>
          </div>
          {children}
        </div>
        <SiteFooter compact />
      </main>
    </div>
  )
}

function OfflineNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="notice notice-warn" role="alert">
      <CircleAlert size={15} />
      <span>
        Can't reach the Speech Guru API at <span className="mono">{API_BASE}</span>, or its database (MongoDB)
        isn't running. Start them, then{' '}
        <button type="button" className="link-btn" onClick={onRetry}>
          try again
        </button>
        .
      </span>
    </p>
  )
}

export function LoginPage() {
  const { signIn, notice, clearNotice, status, refresh } = useAuth()
  const policy = usePolicy()
  const nav = useNavigate()
  const loc = useLocation()
  const next = safeNext(new URLSearchParams(loc.search).get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    clearNotice()
    try {
      await signIn(email, password)
      nav(next, { replace: true })
    } catch (err) {
      setPassword('')
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Sign in to see your analyses and practice.">
      {status === 'offline' && <OfflineNotice onRetry={() => void refresh()} />}
      {notice && !error && (
        <p className="notice" role="status">
          <Info size={15} />
          <span>{notice}</span>
        </p>
      )}
      <form className="stack gap-16" onSubmit={submit} noValidate={false}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            maxLength={254}
          />
        </div>
        <PasswordField
          id="login-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          invalid={Boolean(error)}
          describedBy={error ? 'login-error' : undefined}
          headerRight={
            <Link to="/forgot-password" className="t-small muted link-btn">
              Forgot password?
            </Link>
          }
        />
        {error && (
          <p id="login-error" className="notice notice-bad" role="alert">
            <CircleAlert size={15} />
            <span>{error}</span>
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="t-small muted auth-foot">
        <LockKeyhole size={13} /> After {policy.lockout_attempts} wrong passwords the account locks for {policy.lock_minutes}{' '}
        minutes.
      </p>
      {policy.registration_open && (
        <p className="t-small auth-switch">
          New to Speech Guru? <Link to={`/register${loc.search}`}>Create an account</Link>
        </p>
      )}
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { register, status, refresh } = useAuth()
  const policy = usePolicy()
  const nav = useNavigate()
  const loc = useLocation()
  const next = safeNext(new URLSearchParams(loc.search).get('next'))
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeAge, setAgreeAge] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const matches = confirm.length > 0 && confirm === password

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pwOk || !matches || !agreeTerms || !agreeAge) return
    setBusy(true)
    setError(null)
    try {
      await register(email, name, password)
      nav(next, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!policy.registration_open) {
    return (
      <AuthLayout title="Registration is closed" subtitle="Ask an administrator to create an account for you.">
        <Link to="/login" className="btn btn-primary btn-lg">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Your analyses stay private to your account.">
      {status === 'offline' && <OfflineNotice onRetry={() => void refresh()} />}
      <form className="stack gap-16" onSubmit={submit}>
        <div className="field">
          <label htmlFor="reg-name">Display name</label>
          <input
            id="reg-name"
            name="name"
            className="input"
            autoComplete="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            name="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
          />
        </div>
        <PasswordField
          id="reg-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          describedBy="reg-pw-feedback"
        />
        <PasswordFeedback
          id="reg-pw-feedback"
          password={password}
          email={email}
          name={name}
          min={policy.min_length}
          max={policy.max_length}
          onValidity={setPwOk}
        />
        <PasswordField
          id="reg-confirm"
          label="Repeat password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={confirm.length > 0 && !matches}
          describedBy="reg-confirm-hint"
        />
        <p
          id="reg-confirm-hint"
          className="t-small"
          style={{ color: confirm && !matches ? 'var(--bad)' : matches ? 'var(--good)' : 'var(--muted)', marginTop: -8 }}
        >
          {confirm && !matches ? "The passwords don't match." : matches ? 'Passwords match.' : 'Type the same password again.'}
        </p>
        <div className="stack gap-8 agree">
          {/* Two separate, unticked boxes: agreement must be an explicit act. */}
          <label className="toggle" htmlFor="reg-terms">
            <input id="reg-terms" type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} required />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener">
                Terms
              </Link>{' '}
              and have read the{' '}
              <Link to="/privacy" target="_blank" rel="noopener">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <label className="toggle" htmlFor="reg-age">
            <input id="reg-age" type="checkbox" checked={agreeAge} onChange={(e) => setAgreeAge(e.target.checked)} required />
            <span>I'm 16 or older.</span>
          </label>
        </div>
        {error && (
          <p className="notice notice-bad" role="alert">
            <CircleAlert size={15} />
            <span>{error}</span>
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={busy || !pwOk || !matches || !email || !name.trim() || !agreeTerms || !agreeAge}
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="t-small auth-switch">
        Already have an account? <Link to={`/login${loc.search}`}>Sign in</Link>
      </p>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const policy = usePolicy()
  const loc = useLocation()
  const searchParams = new URLSearchParams(loc.search)
  const initialToken = searchParams.get('token') || ''

  const [step, setStep] = useState<'request' | 'reset'>(initialToken ? 'reset' : 'request')
  // The token arrives in the reset link; drop it from the address bar so it doesn't stay in history.
  useEffect(() => {
    if (initialToken) window.history.replaceState(null, '', loc.pathname)
  }, [initialToken, loc.pathname])
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(initialToken)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = confirmPassword.length > 0 && confirmPassword === newPassword

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      // The API never returns the token: the link goes only to the account's owner.
      const res = await authApi.forgotPassword(email)
      setSuccess(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to request password reset.')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!token || !pwOk || !matches) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await authApi.resetPassword(token, newPassword)
      setSuccess(res.message || 'Password successfully reset! You can now sign in.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Password reset failed. The token may be invalid or expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={step === 'request' ? 'Reset password' : 'Set new password'}
      subtitle={
        step === 'request'
          ? 'Enter your account email. If it has an account, a reset link is sent to its owner.'
          : `Choose a new password with at least ${policy.min_length} characters.`
      }
    >
      {success && (
        <p className="notice notice-ok" role="status">
          <Check size={15} />
          <span>{success}</span>
        </p>
      )}

      {error && (
        <p className="notice notice-bad" role="alert">
          <CircleAlert size={15} />
          <span>{error}</span>
        </p>
      )}

      {success && step === 'reset' && !busy && error === null ? (
        <div className="stack gap-16">
          <Link to="/login" className="btn btn-primary btn-lg" style={{ textAlign: 'center' }}>
            Back to Sign in
          </Link>
        </div>
      ) : step === 'request' ? (
        <form className="stack gap-16" onSubmit={handleRequest}>
          <div className="field">
            <label htmlFor="reset-email">Email address</label>
            <input
              id="reset-email"
              name="email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              maxLength={254}
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="t-small auth-switch">
            Remember your password? <Link to="/login">Sign in</Link>
          </p>
        </form>
      ) : (
        <form className="stack gap-16" onSubmit={handleReset}>
          <div className="field">
            <label htmlFor="reset-token">Reset Token</label>
            <input
              id="reset-token"
              name="token"
              className="input"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              placeholder="Paste the token from your reset link"
            />
          </div>
          <PasswordField
            id="reset-new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordFeedback
            id="reset-feedback"
            password={newPassword}
            email={email}
            min={policy.min_length}
            max={policy.max_length}
            onValidity={setPwOk}
          />
          <div className="field">
            <label htmlFor="reset-confirm">Confirm new password</label>
            <input
              id="reset-confirm"
              name="confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              maxLength={256}
            />
            {confirmPassword && !matches && (
              <p className="field-hint" style={{ color: 'var(--bad)' }}>
                Passwords don't match.
              </p>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={busy || !token || !pwOk || !matches}
          >
            {busy ? 'Updating password…' : 'Set New Password'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="link-btn t-small"
              onClick={() => {
                setStep('request')
                setError(null)
                setSuccess(null)
              }}
            >
              ← Request a new link
            </button>
            <Link to="/login" className="t-small">
              Back to Sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}

