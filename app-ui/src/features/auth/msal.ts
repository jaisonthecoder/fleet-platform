import type {
  PublicClientApplication,
  Configuration,
} from '@azure/msal-browser'
import { env, isSsoConfigured } from '@/lib/env'

export { isSsoConfigured }

/** Scope(s) requested for the access token presented to the backend API. */
export const apiScopes: string[] = env.entraApiScope ? [env.entraApiScope] : []

let instance: PublicClientApplication | null = null
let initialised: Promise<void> | null = null

/**
 * Lazily constructs and initialises the MSAL client. Returns `null` when SSO is
 * not configured for this environment. The MSAL library is dynamically imported
 * so it stays out of the initial bundle until SSO is actually used.
 */
export async function getMsal(): Promise<PublicClientApplication | null> {
  if (!isSsoConfigured || !env.entraClientId || !env.entraTenantId) return null
  if (!instance) {
    const { PublicClientApplication } = await import('@azure/msal-browser')
    const configuration: Configuration = {
      auth: {
        clientId: env.entraClientId,
        authority:
          env.entraAuthority ??
          `https://login.microsoftonline.com/${env.entraTenantId}`,
        redirectUri: env.entraRedirectUri ?? window.location.origin,
        postLogoutRedirectUri:
          env.entraPostLogoutRedirectUri ?? window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    }
    instance = new PublicClientApplication(configuration)
  }
  if (!initialised) initialised = instance.initialize()
  await initialised
  return instance
}
