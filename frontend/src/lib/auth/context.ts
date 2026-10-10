import { createContext, useContext } from 'react'
import type { AuthUser } from '../api/auth'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'offline'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  sessionId: string | null
  /** Required documents (terms, privacy) the user must accept in their current version. */
  consentNeeded: string[]
  /** Why the user was signed out, shown on the sign-in page. */
  notice: string | null
  signIn: (email: string, password: string) => Promise<void>
  register: (email: string, displayName: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Clears local state after the account was deleted on the server. */
  accountDeleted: () => void
  acceptDocuments: (docs: string[]) => Promise<void>
  refresh: () => Promise<void>
  updateUser: (user: AuthUser) => void
  clearNotice: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
