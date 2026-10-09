import type { ApiBattle, ApiHistory, ApiJob, ApiLeaderboard, ApiMimic, Mode } from './types'

export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal })
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
    throw new ApiError(`The API answered ${res.status}: ${detail}`, res.status)
  }
  return (await res.json()) as T
}

export function getHealth(): Promise<{ status: string }> {
  return request('/api/health', undefined, 4000)
}

export interface AnalyzeInput {
  participant: File
  reference?: File | null
  transcript: string
  mode: Mode
}

export function startAnalysis({ participant, reference, transcript, mode }: AnalyzeInput): Promise<ApiJob> {
  const form = new FormData()
  form.append('participant', participant)
  if (reference) form.append('reference', reference)
  form.append('transcript', transcript)
  form.append('mode', mode)
  return request('/api/analyze', { method: 'POST', body: form }, 60000)
}

export function getJob(jobId: string): Promise<ApiJob> {
  return request(`/api/jobs/${encodeURIComponent(jobId)}`)
}

export function generateTranscript(): Promise<{ transcript: string }> {
  return request('/api/generate-script', { method: 'POST' }, 120000) // generous timeout for model download
}

export function transcribeAudio(file: File): Promise<{ transcript: string }> {
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

export function getLeaderboard(promptId = 'T1_Gettysburg', version = 'v1.0.0'): Promise<ApiLeaderboard> {
  return request(
    `/api/leaderboard?prompt_id=${encodeURIComponent(promptId)}&version=${encodeURIComponent(version)}`,
  )
}
