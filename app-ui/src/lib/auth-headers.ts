/**
 * Holds the current auth credential and turns it into request headers.
 * Two mechanisms match the backend `AuthGuard`:
 *  - SSO:       `Authorization: Bearer <Entra access token>` (resolved per
 *               request via a provider so it stays fresh / auto-refreshes).
 *  - Dev-login: `x-dev-person-id: <person id>` (lower environments only).
 *
 * Lives in `lib/` (not `features/`) so the API client can depend on it without
 * a features → lib layering inversion.
 */
import { isDevLoginEnabled } from './env'

/** Resolves a valid access token (or null if one cannot be obtained). */
export type BearerTokenProvider = () => Promise<string | null>

const DEV_STORAGE_KEY = 'fleet-dev-person-id'

let mode: 'dev' | 'bearer' | null = null
let devPersonId: string | null = null
let bearerProvider: BearerTokenProvider | null = null
let unauthorizedHandler: (() => void) | null = null

function restore(): void {
  // Only rehydrate the dev-login stand-in where it is actually allowed.
  if (typeof window === 'undefined' || !isDevLoginEnabled) return
  try {
    const stored = window.sessionStorage?.getItem(DEV_STORAGE_KEY)
    if (stored) {
      mode = 'dev'
      devPersonId = stored
    }
  } catch {
    /* storage unavailable */
  }
}
restore()

/** Whether a credential (dev or bearer) is currently set. */
export function hasCredential(): boolean {
  return mode !== null
}

export function setDevCredential(personId: string): void {
  mode = 'dev'
  devPersonId = personId
  bearerProvider = null
  try {
    window.sessionStorage?.setItem(DEV_STORAGE_KEY, personId)
  } catch {
    /* storage unavailable */
  }
}

/** Registers the SSO token provider (invoked per request to stay fresh). */
export function setBearerProvider(provider: BearerTokenProvider): void {
  mode = 'bearer'
  bearerProvider = provider
  devPersonId = null
}

export function clearAuthCredential(): void {
  mode = null
  devPersonId = null
  bearerProvider = null
  try {
    window.sessionStorage?.removeItem(DEV_STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}

/** Called by the API client on a 401 so the app can drop the session. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.()
}

/** Resolves auth headers for the current credential (empty when signed out). */
export async function authHeaders(): Promise<Record<string, string>> {
  if (mode === 'dev' && devPersonId) {
    return { 'x-dev-person-id': devPersonId }
  }
  if (mode === 'bearer' && bearerProvider) {
    const token = await bearerProvider()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  return {}
}
