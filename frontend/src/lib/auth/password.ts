/**
 * Client-side password feedback. The API (backend/auth/passwords.py) is the authority;
 * these checks mirror it so people see problems while typing, before they submit.
 * Window sizes match configs/auth/auth.yaml (personal_window, sequence_run).
 */

export interface Rule {
  id: string
  label: string
  ok: boolean
}

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm']
const MIN_PERSONAL_TOKEN = 4
const PERSONAL_WINDOW = 5
const SEQUENCE_RUN = 5

function windows(s: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i + n <= s.length; i++) out.push(s.slice(i, i + n))
  return out
}

function trivial(pw: string): boolean {
  const low = pw.toLowerCase()
  if (new Set(low).size <= 2) return true
  return SEQUENCES.some((s) => {
    const rev = [...s].reverse().join('')
    return (
      s.includes(low) ||
      rev.includes(low) ||
      windows(s, SEQUENCE_RUN).some((w) => low.includes(w)) ||
      windows(rev, SEQUENCE_RUN).some((w) => low.includes(w))
    )
  })
}

function personalTokens(email = '', name = ''): string[] {
  const local = email.split('@')[0].toLowerCase()
  const full = name.trim().toLowerCase()
  const parts = `${local} ${full}`.split(/[^\p{L}\p{N}]+/u)
  return [...new Set([local, full, ...parts])].filter((t) => t.length >= MIN_PERSONAL_TOKEN)
}

function sharesPersonal(pw: string, email?: string, name?: string): boolean {
  const low = pw.toLowerCase()
  return personalTokens(email, name).some(
    (t) => low.includes(t) || (t.length >= PERSONAL_WINDOW && windows(t, PERSONAL_WINDOW).some((w) => low.includes(w))),
  )
}

export function passwordRules(pw: string, opts: { min: number; max: number; email?: string; name?: string }): Rule[] {
  return [
    { id: 'length', label: `${opts.min} to ${opts.max} characters`, ok: pw.length >= opts.min && pw.length <= opts.max },
    {
      id: 'personal',
      label: "Doesn't contain your name or email, or part of them",
      ok: pw.length > 0 && !sharesPersonal(pw, opts.email, opts.name),
    },
    { id: 'pattern', label: 'No repeated characters or sequences like 12345 or qwert', ok: pw.length > 0 && !trivial(pw) },
    { id: 'spaces', label: "Doesn't start or end with a space", ok: pw.length > 0 && pw === pw.trim() },
  ]
}

export type Strength = 0 | 1 | 2 | 3 | 4

/** Rough guessability estimate from length and character variety (bits of entropy, discounted). */
export function strength(pw: string): { score: Strength; label: string } {
  if (!pw) return { score: 0, label: '' }
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33
  const unique = new Set(pw).size
  const bits = Math.log2(Math.max(pool, 2)) * Math.min(pw.length, unique * 2)
  const score: Strength = bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] }
}
