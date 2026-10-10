import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, privacyApi, type AuthUser, type SessionPayload } from '../../lib/api/auth'
import { ApiError, setConsentRequiredHandler, setCsrfToken, setUnauthorizedHandler } from '../../lib/api/client'
import { setStoreUser } from '../../lib/analysis/store'
import { AuthContext, type AuthState, type AuthStatus } from '../../lib/auth/context'
import { setBattleUser } from '../../lib/battles'
import { getConsent, needsChoice, onConsentChanged } from '../../lib/consent'

/** No answer (0), or the API is up but its session store or database isn't (503): not "signed out". */
const unreachable = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status === 503)

/** Owns the signed-in user. The session cookie is HttpOnly; only the CSRF token lives here, in memory. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [consentNeeded, setConsentNeeded] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const apply = useCallback((p: SessionPayload | null, why: string | null = null) => {
    setCsrfToken(p?.csrf_token ?? null)
    setStoreUser(p?.user.id ?? null)
    setBattleUser(p?.user.id ?? null)
    setUser(p?.user ?? null)
    setSessionId(p?.session_id ?? null)
    setConsentNeeded(p?.consent_needed ?? [])
    setStatus(p ? 'signedIn' : 'signedOut')
    if (why !== null) setNotice(why)
  }, [])

  /** Keep a server-side record of the storage choice (accountability), when signed in. */
  const recordCookieChoice = useCallback(() => {
    if (needsChoice()) return
    const c = getConsent()
    privacyApi.recordCookieChoice(c.preferences, c.history).catch(() => {
      /* best effort: the choice itself is already applied in this browser */
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      apply(await authApi.me())
    } catch (e) {
      if (unreachable(e)) {
        setStatus('offline')
      } else {
        apply(null)
      }
    }
  }, [apply])

  // Initial session check on page load.
  useEffect(() => {
    let alive = true
    authApi
      .me()
      .then((p) => alive && apply(p))
      .catch((e) => {
        if (!alive) return
        if (unreachable(e)) setStatus('offline')
        else apply(null)
      })
    return () => {
      alive = false
    }
  }, [apply])

  // Any API call that comes back 401 means the session ended elsewhere;
  // CONSENT_REQUIRED means updated terms were published while the page was open.
  useEffect(() => {
    setUnauthorizedHandler(() => apply(null, 'Your session ended. Sign in again to continue.'))
    setConsentRequiredHandler(() => void refresh())
    return () => {
      setUnauthorizedHandler(null)
      setConsentRequiredHandler(null)
    }
  }, [apply, refresh])

  // Record a changed storage choice while signed in.
  useEffect(() => {
    if (status !== 'signedIn') return
    return onConsentChanged(recordCookieChoice)
  }, [status, recordCookieChoice])

  const signIn = useCallback(
    async (email: string, password: string) => {
      apply(await authApi.login(email, password), null)
      setNotice(null)
      recordCookieChoice()
    },
    [apply, recordCookieChoice],
  )

  const register = useCallback(
    async (email: string, displayName: string, password: string) => {
      apply(await authApi.register(email, displayName, password), null)
      setNotice(null)
      recordCookieChoice()
    },
    [apply, recordCookieChoice],
  )

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* the session may already be gone; sign out locally regardless */
    }
    apply(null, 'You signed out.')
  }, [apply])

  const acceptDocuments = useCallback(async (docs: string[]) => {
    const r = await privacyApi.accept(docs)
    setConsentNeeded(r.outstanding)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      sessionId,
      consentNeeded,
      notice,
      signIn,
      register,
      signOut,
      accountDeleted: () => apply(null, 'Your account and its data were deleted.'),
      acceptDocuments,
      refresh,
      updateUser: setUser,
      clearNotice: () => setNotice(null),
    }),
    [status, user, sessionId, consentNeeded, notice, signIn, register, signOut, apply, acceptDocuments, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
