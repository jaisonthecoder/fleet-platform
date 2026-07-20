import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuthCredential,
  hasCredential,
  setBearerProvider,
  setDevCredential,
  setUnauthorizedHandler,
} from '@/lib/auth-headers'
import { isDevLoginEnabled, isSsoConfigured } from '@/lib/env'
import { fetchMe, type Me } from './auth.contract'
import { apiScopes, getMsal } from './msal'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  me: Me | null
  isSsoConfigured: boolean
  isDevLoginEnabled: boolean
  /** Starts the Entra redirect sign-in (throws if SSO is not configured). */
  loginSso: () => Promise<void>
  /** Signs in with the dev-login stand-in and loads the principal. */
  loginDev: (personId: string) => Promise<void>
  /** Dev-only: enter the app without a backend session (no seeded users yet). */
  loginSkip: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Registers the per-request SSO token provider (fresh, auto-refreshing). */
function registerBearerProvider(): void {
  setBearerProvider(async () => {
    const msal = await getMsal()
    const account = msal?.getAllAccounts()[0]
    if (!msal || !account) return null
    try {
      const result = await msal.acquireTokenSilent({
        scopes: apiScopes,
        account,
      })
      return result.accessToken
    } catch {
      return null
    }
  })
}

/** Provides authentication state + actions to the app (SSO + dev-login). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const bootstrapped = useRef(false)

  const loadMe = useCallback(async () => {
    const principal = await fetchMe()
    setMe(principal)
    setStatus('authenticated')
  }, [])

  // Drop the session whenever any API call reports 401.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuthCredential()
      setMe(null)
      setStatus('unauthenticated')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Restore an existing session on first mount.
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true
    void (async () => {
      try {
        if (isSsoConfigured) {
          const msal = await getMsal()
          if (msal) {
            const redirect = await msal.handleRedirectPromise()
            const account =
              redirect?.account ?? msal.getAllAccounts()[0] ?? null
            if (account) {
              registerBearerProvider()
              await loadMe()
              return
            }
          }
        }
        if (hasCredential()) {
          await loadMe()
          return
        }
        setStatus('unauthenticated')
      } catch {
        clearAuthCredential()
        setStatus('unauthenticated')
      }
    })()
  }, [loadMe])

  const loginSso = useCallback(async () => {
    const msal = await getMsal()
    if (!msal) throw new Error('sso-not-configured')
    await msal.loginRedirect({ scopes: apiScopes })
  }, [])

  const loginDev = useCallback(
    async (personId: string) => {
      setDevCredential(personId.trim())
      try {
        await loadMe()
      } catch (error) {
        clearAuthCredential()
        setStatus('unauthenticated')
        throw error
      }
    },
    [loadMe],
  )

  const loginSkip = useCallback(() => {
    // Temporary dev escape hatch used only when no seeded users exist. Sets a
    // local guest session (no backend credential); any authed call will 401 and
    // return to login.
    if (!isDevLoginEnabled) return
    clearAuthCredential()
    setMe({
      organizationId: '00000000-0000-4000-8000-000000000001',
      personId: 'dev-guest',
      fullName: 'Guest (dev)',
      roles: [],
    })
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    clearAuthCredential()
    setMe(null)
    setStatus('unauthenticated')
    if (isSsoConfigured) {
      const msal = await getMsal()
      const account = msal?.getAllAccounts()[0]
      if (msal && account) await msal.logoutRedirect({ account })
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      isSsoConfigured,
      isDevLoginEnabled,
      loginSso,
      loginDev,
      loginSkip,
      logout,
    }),
    [status, me, loginSso, loginDev, loginSkip, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
