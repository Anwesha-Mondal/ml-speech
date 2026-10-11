import type { ApiBattle, ApiHistory, ApiJob, ApiLeaderboard, ApiLeaderboardPrompts, ApiMimic, Mode } from './types'

// Set in frontend/.env (gitignored). vite.config.ts refuses to start or build without it.
export const API_BASE: string = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ---- session plumbing (see lib/auth) ----
// The session itself is an HttpOnly cookie the browser sends automatically; script never sees it.
// The CSRF token is held in memory only and sent on every state-changing request.
let csrfToken: string | null = null
let onUnauthorized: (() => void) | null = null
let onConsentRequired: (() => void) | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

/** Called when the API says updated Terms or Privacy Policy must be accepted first. */
export function setConsentRequiredHandler(fn: (() => void) | null) {
  onConsentRequired = fn
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function request<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  if (!SAFE.has(method)) {
    // Custom headers force a CORS preflight, so only the app's own origin can send changes.
    // Reads skip them to avoid an extra preflight round trip.
    headers.set('X-Requested-With', 'SpeechArena')
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include', signal: ctrl.signal })
  } catch {
    throw new ApiError(`Can't reach the Speech Arena API at ${API_BASE}. Start the backend and try again.`, 0)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* body was not JSON */
    }
    // A 401 outside the auth endpoints means the session ended (expired, revoked, signed out elsewhere).
    if (res.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.()
    if (res.status === 403 && detail.startsWith('CONSENT_REQUIRED')) onConsentRequired?.()
    throw new ApiError(path.startsWith('/api/auth/') || path.startsWith('/api/admin/') ? detail : `The API answered ${res.status}: ${detail}`, res.status)
  }
  return (await res.json()) as T
}

export function getHealth(): Promise<{ status: string; services?: { mongodb?: 'up' | 'down'; redis?: 'up' | 'down' } }> {
  return request('/api/health', undefined, 4000)
}

export interface AnalyzeInput {
  participant: File
  reference?: File | null
  transcript: string
  mode: Mode
  /** Reference passage ID. Scores on leaderboard passages are ranked for opted-in users. */
  promptId?: string
}

export function startAnalysis({ participant, reference, transcript, mode, promptId }: AnalyzeInput): Promise<ApiJob> {
  const form = new FormData()
  form.append('participant', participant)
  if (reference) form.append('reference', reference)
  form.append('transcript', transcript)
  form.append('mode', mode)
  if (promptId) form.append('prompt_id', promptId)
  return request('/api/analyze', { method: 'POST', body: form }, 60000)
}

export function getJob(jobId: string): Promise<ApiJob> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`)
}

export function generateTranscript(): Promise<{ transcript: string }> {
  return request('/api/generate-script', { method: 'POST' }, 120000) // generous timeout for model download
}

export function transcribeAudio(file: File): Promise<{ transcript: string; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  return request('/api/transcribe', { method: 'POST', body: form }, 120000) // timeout for model download
}

export function getHistory(promptId = 'T1_Gettysburg'): Promise<ApiHistory> {
  return request(`/api/progress/history?prompt_id=${encodeURIComponent(promptId)}`)
}

export function startBattle(promptId: string, playerA: string, playerB: string): Promise<ApiBattle> {
  const form = new FormData()
  form.append('prompt_id', promptId)
  form.append('user_id_1', playerA)
  form.append('user_id_2', playerB)
  return request('/api/battle/1v1', { method: 'POST', body: form })
}

export function submitMimic(referenceId: string, participant: File): Promise<ApiMimic> {
  const form = new FormData()
  form.append('reference_id', referenceId)
  form.append('participant', participant)
  return request('/api/mimic-party', { method: 'POST', body: form }, 60000)
}

export function getLeaderboard(promptId = 'global'): Promise<ApiLeaderboard> {
  return request(`/api/leaderboard?prompt_id=${encodeURIComponent(promptId)}`)
}

export function getLeaderboardPrompts(): Promise<ApiLeaderboardPrompts> {
  return request('/api/leaderboard/prompts')
}

export function setLeaderboardOptIn(optIn: boolean): Promise<{ ok: boolean; leaderboard_opt_in: boolean; removed_scores: number }> {
  return request('/api/leaderboard/opt-in', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opt_in: optIn }),
  })
}
