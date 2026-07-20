import { z } from 'zod'

/**
 * Validated, typed access to environment variables. Parsed once at startup so a
 * misconfigured environment fails fast and loudly instead of at random later.
 * Only `VITE_*` variables exist in the client bundle, and all of them are public.
 */
const envSchema = z.object({
  appEnv: z.enum(['development', 'ut', 'production']).default('development'),
  appName: z.string().min(1).default('Carpool & Fleet Platform'),
  apiBaseUrl: z.string().min(1).default('/api'),
  entraClientId: z.string().optional(),
  entraTenantId: z.string().optional(),
  entraAuthority: z.string().optional(),
  entraApiScope: z.string().optional(),
  entraRedirectUri: z.string().optional(),
  entraPostLogoutRedirectUri: z.string().optional(),
  authDevLogin: z.string().optional(),
})

export type AppEnv = z.infer<typeof envSchema>

const raw = import.meta.env

/**
 * Resolves the API base the client prefixes onto its versioned paths (`/v1/...`).
 * The SPA calls the backend **directly** cross-origin (no dev proxy) — the
 * backend allows the frontend origin via CORS. `VITE_API_URL` is the full
 * versioned base (e.g. `http://localhost:3000/api/v1`); we drop the trailing
 * `/v1` because the client already sends versioned paths. Falls back to
 * `VITE_API_BASE_URL`, then `/api`.
 */
function resolveApiBaseUrl(): string | undefined {
  const full = raw.VITE_API_URL?.trim()
  if (full) return full.replace(/\/+$/, '').replace(/\/v1$/i, '')
  return raw.VITE_API_BASE_URL
}

export const env: AppEnv = envSchema.parse({
  appEnv: raw.VITE_APP_ENV,
  appName: raw.VITE_APP_NAME,
  apiBaseUrl: resolveApiBaseUrl(),
  // Azure AD / Entra SSO — accept the VITE_AAD_* names (preferred) and fall back
  // to the legacy VITE_ENTRA_* names so both templates work unchanged.
  entraClientId: raw.VITE_AAD_CLIENT_ID ?? raw.VITE_ENTRA_CLIENT_ID,
  entraTenantId: raw.VITE_AAD_TENANT_ID ?? raw.VITE_ENTRA_TENANT_ID,
  entraAuthority: raw.VITE_AAD_AUTHORITY ?? raw.VITE_ENTRA_AUTHORITY,
  entraApiScope: raw.VITE_AAD_API_SCOPE ?? raw.VITE_ENTRA_API_SCOPE,
  entraRedirectUri: raw.VITE_AAD_REDIRECT_URI ?? raw.VITE_ENTRA_REDIRECT_URI,
  entraPostLogoutRedirectUri:
    raw.VITE_AAD_POST_LOGOUT_REDIRECT_URI ??
    raw.VITE_ENTRA_POST_LOGOUT_REDIRECT_URI,
  authDevLogin: raw.VITE_DEV_LOGIN ?? raw.VITE_AUTH_DEV_LOGIN,
})

export const isProduction = env.appEnv === 'production'

/** SSO is offered only when the Entra client + tenant are configured. */
export const isSsoConfigured = Boolean(env.entraClientId && env.entraTenantId)

/** Dev-login is offered in lower environments unless explicitly disabled; never in production. */
export const isDevLoginEnabled = !isProduction && env.authDevLogin !== 'false'
