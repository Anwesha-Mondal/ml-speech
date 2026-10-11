import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import { adminApi, type AdminUser, type AuditEvent, type Role } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/context'
import { fmtDateTime } from '../../lib/format'

export function AdminLayout() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Users & access"
        description="Manage who can sign in and who has administrator rights. Every change is written to the audit log."
        tabs={[
          { to: '/admin', label: 'Users', end: true },
          { to: '/admin/audit', label: 'Audit log' },
        ]}
      />
      <Outlet />
    </>
  )
}

export function AdminUsers() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      setUsers((await adminApi.users()).users)
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load users.')
    }
  }, [])

  useEffect(() => {
    let alive = true
    adminApi
      .users()
      .then((r) => alive && setUsers(r.users))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Could not load users.'))
    return () => {
      alive = false
    }
  }, [])

  const patch = async (u: AdminUser, p: { role?: Role; is_active?: boolean }) => {
    setBusy(u.id)
    setError(null)
    try {
      const r = await adminApi.updateUser(u.id, p)
      setUsers((list) => list?.map((x) => (x.id === u.id ? r.user : x)) ?? null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the user.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="stack gap-12">
      {error && <p className="notice notice-bad" role="alert">{error}</p>}
      <div className="panel">
        <div className="panel-head">
          <span className="t-section">{users ? `${users.length} account${users.length === 1 ? '' : 's'}` : 'Accounts'}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => void load()}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        {!users ? (
          <div className="panel-pad stack gap-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 34 }} />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.id === me?.id
                  const locked = u.locked_until && new Date(u.locked_until).getTime() > now
                  return (
                    <tr key={u.id} className={self ? 'is-you' : ''}>
                      <td>
                        <span className="stack">
                          <span style={{ fontWeight: 500 }}>
                            {u.display_name} {self && <span className="faint t-small">(you)</span>}
                          </span>
                          <span className="t-small muted">{u.email}</span>
                        </span>
                      </td>
                      <td>
                        <select
                          id={`role-${u.id}`}
                          aria-label={`Role for ${u.email}`}
                          className="select ws-select"
                          value={u.role}
                          disabled={self || busy === u.id}
                          title={self ? "You can't change your own role." : undefined}
                          onChange={(e) => void patch(u, { role: e.target.value as Role })}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className="row gap-8">
                          <span className={`status ${!u.is_active ? 'status-bad' : locked ? 'status-warn' : 'status-ok'}`}>
                            <span className="dot" />
                            {!u.is_active ? 'Disabled' : locked ? 'Locked' : 'Active'}
                          </span>
                          {!self && (
                            <button
                              type="button"
                              className={`btn btn-sm ${u.is_active ? 'btn-danger' : ''}`}
                              disabled={busy === u.id}
                              onClick={() => void patch(u, { is_active: !u.is_active || Boolean(locked) })}
                            >
                              {!u.is_active ? 'Enable' : locked ? 'Unlock' : 'Disable'}
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="muted">{u.last_login_at ? fmtDateTime(u.last_login_at) : 'Never'}</td>
                      <td className="muted">{u.created_at ? fmtDateTime(u.created_at) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="t-small faint">
        Disabling an account signs it out everywhere. At least one active administrator must remain, and you can't remove
        your own access.
      </p>
    </div>
  )
}

const EVENT_LABELS: Record<string, string> = {
  register: 'Account created',
  login: 'Signed in',
  login_failed: 'Sign-in failed',
  login_locked: 'Sign-in while locked',
  login_disabled: 'Sign-in to disabled account',
  logout: 'Signed out',
  password_changed: 'Password changed',
  password_change_failed: 'Password change failed',
  profile_updated: 'Profile updated',
  session_revoked: 'Device signed out',
  sessions_revoked: 'Other devices signed out',
  admin_user_updated: 'Changed by admin',
  admin_created_cli: 'Admin created (CLI)',
  admin_promoted_cli: 'Promoted to admin (CLI)',
  unlocked_cli: 'Unlocked (CLI)',
}

const WARN = new Set(['login_failed', 'login_locked', 'login_disabled', 'password_change_failed'])

export function AdminAudit() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    adminApi
      .audit(200)
      .then((r) => alive && setEvents(r.events))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Could not load the audit log.'))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <p className="notice notice-bad">{error}</p>
  return (
    <div className="panel">
      {!events ? (
        <div className="panel-pad">
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      ) : events.length === 0 ? (
        <EmptyState compact title="No security events yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Account</th>
                <th>IP</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {e.at ? fmtDateTime(e.at) : '—'}
                  </td>
                  <td>
                    <span className={`status ${WARN.has(e.event) ? 'status-warn' : 'status-off'}`}>
                      <span className="dot" />
                      {EVENT_LABELS[e.event] ?? e.event}
                    </span>
                  </td>
                  <td className="t-small">{e.email || '—'}</td>
                  <td className="mono t-small">{e.ip || '—'}</td>
                  <td className="t-small muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
