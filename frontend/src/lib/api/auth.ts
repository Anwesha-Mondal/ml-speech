import { API_BASE, ApiError, request } from './client'

export type Role = 'user' | 'admin'

export interface AuthUser {
  id: string
  email: string
  display_name: string
  role: Role
  created_at: string | null
  password_changed_at: string | null
  /** Shown on leaderboards (display name and best scores). Off unless the user turns it on. */
  leaderboard_opt_in: boolean
}

export interface SessionPayload {
  user: AuthUser
  csrf_token: string
  session_id: string
  /** Required documents ("terms", "privacy") whose current version hasn't been accepted. */
  consent_needed: string[]
}

export interface PasswordPolicy {
  min_length: number
  max_length: number
  registration_open: boolean
  lockout_attempts: number
  lock_minutes: number
}

export interface SessionInfo {
  id: string
  current: boolean
  created_at: string | null
  last_seen_at: string | null
  ip: string
  user_agent: string
}

export interface AdminUser {
  id: string
  email: string
  display_name: string
  role: Role
  is_active: boolean
  locked_until: string | null
  created_at: string | null
  last_login_at: string | null
}

export interface AuditEvent {
  id: number
  at: string | null
  event: string
  email: string
  user_id: string | null
  actor_id: string | null
  ip: string
  detail: string
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const authApi = {
  me: () => request<SessionPayload>('/api/auth/me', undefined, 6000),
  policy: () => request<PasswordPolicy>('/api/auth/policy', undefined, 6000),
  checkPolicy: (password: string, email = '', display_name = '') =>
    request<{ ok: boolean; problems: string[] }>('/api/auth/policy/check', json({ password, email, display_name })),
  login: (email: string, password: string) => request<SessionPayload>('/api/auth/login', json({ email, password }), 20000),
  register: (email: string, display_name: string, password: string) =>
    request<SessionPayload>(
      '/api/auth/register',
      // Only sent once the person has ticked both boxes on the form.
      json({ email, display_name, password, accept_terms: true, confirm_age: true }),
      20000,
    ),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (display_name: string) =>
    request<{ user: AuthUser }>('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name }),
    }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean; revoked_sessions: number }>(
      '/api/auth/change-password',
      json({ current_password, new_password }),
      20000,
    ),
  sessions: () => request<{ sessions: SessionInfo[] }>('/api/auth/sessions'),
  revokeSession: (id: string) =>
    request<{ ok: boolean }>(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  logoutOthers: () => request<{ ok: boolean; revoked_sessions: number }>('/api/auth/logout-others', { method: 'POST' }),
}

export const adminApi = {
  users: () => request<{ users: AdminUser[] }>('/api/admin/users'),
  updateUser: (id: string, patch: { role?: Role; is_active?: boolean }) =>
    request<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  audit: (limit = 100) => request<{ events: AuditEvent[] }>(`/api/admin/audit?limit=${limit}`),
}

export const privacyApi = {
  accept: (documents: string[]) =>
    request<{ ok: boolean; outstanding: string[] }>('/api/privacy/accept', json({ documents })),
  recordCookieChoice: (preferences: boolean, history: boolean) =>
    request<{ ok: boolean }>('/api/privacy/cookie-consent', json({ preferences, history })),
  deleteAccount: (password: string, confirm: string) =>
    request<{ ok: boolean }>('/api/privacy/delete-account', json({ password, confirm }), 20000),
  /** Downloads everything the server holds about the signed-in user as a JSON file. */
  async exportData(): Promise<Blob> {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/api/privacy/export`, { credentials: 'include' })
    } catch {
      throw new ApiError(`Can't reach the Speech Arena API at ${API_BASE}.`, 0)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(typeof body?.detail === 'string' ? body.detail : 'The export failed.', res.status)
    }
    return res.blob()
  },
}
