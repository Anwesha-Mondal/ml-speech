import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth/context'
import { safeNext } from '../../lib/auth/redirect'
import ConsentGate from '../legal/ConsentGate'
import EmptyState from '../ui/EmptyState'

function Splash() {
  return (
    <div className="auth-splash" role="status" aria-live="polite">
      <span className="skeleton" style={{ width: 160, height: 10 }} />
      <span className="sr-only">Checking your session…</span>
    </div>
  )
}

/** Renders children only for a signed-in user; otherwise sends them to sign in and back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, consentNeeded } = useAuth()
  const loc = useLocation()
  if (status === 'loading') return <Splash />
  if (status !== 'signedIn') {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  // Updated Terms or Privacy Policy must be accepted first (the API enforces this too).
  if (consentNeeded.length) return <ConsentGate />
  return <>{children}</>
}

/** Inside the app shell: admin-only screens. The API enforces the same rule. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return (
      <div className="panel">
        <EmptyState
          title="Administrators only"
          action={
            <Link to="/" className="btn">
              Go to Overview
            </Link>
          }
        >
          Your account doesn't have access to this page.
        </EmptyState>
      </div>
    )
  }
  return <>{children}</>
}

/** Sign-in and registration pages: a signed-in user goes straight to where they were headed. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const loc = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'signedIn') {
    const next = new URLSearchParams(loc.search).get('next')
    return <Navigate to={safeNext(next)} replace />
  }
  return <>{children}</>
}
