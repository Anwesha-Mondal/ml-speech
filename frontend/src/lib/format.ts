export function fmtTime(sec: number, withTenths = false): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  if (withTenths) return `${m}:${s.toFixed(1).padStart(4, '0')}`
  return `${m}:${Math.floor(s).toString().padStart(2, '0')}`
}

export function fmtSec(sec: number): string {
  return `${sec.toFixed(1)}s`
}

export function fmtSigned(n: number, digits = 0): string {
  const v = Number(n.toFixed(digits))
  if (v === 0) return digits ? (0).toFixed(digits) : '0'
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
}

/** A bucket deduction (stored negative) as "−6.0", or "0" when nothing was deducted. */
export function fmtDeduction(n: number): string {
  const v = Math.abs(n)
  return v < 0.05 ? '0' : `−${v.toFixed(1)}`
}

export function fmtPct(rel: number): string {
  return `${fmtSigned(rel * 100)}%`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return prefix + r.replace(/-/g, '').slice(0, 10)
}
