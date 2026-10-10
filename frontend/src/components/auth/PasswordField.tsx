import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authApi } from '../../lib/api/auth'
import { passwordRules, strength } from '../../lib/auth/password'

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid = false,
  autoFocus = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  describedBy?: string
  invalid?: boolean
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          name={id}
          className="input pw-input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoFocus={autoFocus}
          maxLength={256}
          required
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}

/**
 * Live rule checklist, strength meter and the server's blocklist check (debounced).
 * Reports `ok` only when every local rule passes and the server agrees.
 */
export function PasswordFeedback({
  id,
  password,
  email,
  name,
  min,
  max,
  onValidity,
}: {
  id: string
  password: string
  email?: string
  name?: string
  min: number
  max: number
  onValidity: (ok: boolean) => void
}) {
  const rules = passwordRules(password, { min, max, email, name })
  const localOk = rules.every((r) => r.ok)
  const [server, setServer] = useState<{ pw: string; problems: string[]; checked: boolean } | null>(null)
  const estimated = strength(password)

  useEffect(() => {
    if (!password || !localOk) return
    const t = setTimeout(() => {
      authApi
        .checkPolicy(password, email, name)
        .then((r) => setServer({ pw: password, problems: r.problems, checked: true }))
        // Couldn't check (API down): show it as unchecked, never as passed.
        .catch(() => setServer({ pw: password, problems: [], checked: false }))
    }, 350)
    return () => clearTimeout(t)
  }, [password, email, name, localOk])

  const serverProblems = server && server.pw === password && server.checked ? server.problems : null
  const unchecked = Boolean(server && server.pw === password && !server.checked)
  const ok = localOk && serverProblems !== null && serverProblems.length === 0
  // A password that breaks a rule is weak however varied its characters are.
  const s = password && (!localOk || (serverProblems && serverProblems.length > 0)) ? { score: 1 as const, label: 'Weak' } : estimated
  useEffect(() => onValidity(ok), [ok, onValidity])

  return (
    <div id={id} className="pw-feedback" aria-live="polite">
      <div className="pw-meter" aria-hidden={!password}>
        <div className="pw-meter-bars">
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i <= s.score ? `on s${s.score}` : ''} />
          ))}
        </div>
        <span className="t-small muted">{s.label ? `Strength: ${s.label}` : 'Use a long passphrase: three or four unrelated words work well.'}</span>
      </div>
      <ul className="pw-rules">
        {rules.map((r) => (
          <li key={r.id} className={password ? (r.ok ? 'ok' : 'bad') : ''}>
            {password && r.ok ? <Check size={13} /> : <X size={13} />}
            {r.label}
          </li>
        ))}
        <li className={serverProblems ? (serverProblems.length ? 'bad' : 'ok') : ''}>
          {serverProblems && !serverProblems.length ? <Check size={13} /> : <X size={13} />}
          Not a commonly used password{unchecked ? ' (not checked: the API is unreachable)' : ''}
        </li>
      </ul>
      {serverProblems && serverProblems.length > 0 && (
        <p className="t-small" style={{ color: 'var(--bad)' }}>
          {serverProblems.join(' ')}
        </p>
      )}
    </div>
  )
}
