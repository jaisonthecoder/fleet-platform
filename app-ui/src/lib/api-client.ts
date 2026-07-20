import { authHeaders, notifyUnauthorized } from './auth-headers'
import { env } from './env'

/** Structured error thrown for non-2xx API responses (RFC 7807-friendly). */
export class ApiRequestError extends Error {
  readonly status: number
  readonly reasons: string[] | undefined

  constructor(status: number, title: string, reasons?: string[]) {
    super(title)
    this.name = 'ApiRequestError'
    this.status = status
    this.reasons = reasons
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`
  // Only advertise a JSON body when one is actually sent — a bodyless POST
  // (e.g. activate/deactivate) with `Content-Type: application/json` makes
  // Fastify reject the empty body with 400.
  const hasBody = init?.body !== undefined && init?.body !== null
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeaders()),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized()
    let title = response.statusText
    let reasons: string[] | undefined
    try {
      const body = (await response.json()) as {
        title?: string
        reasons?: string[]
      }
      title = body.title ?? title
      reasons = body.reasons
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new ApiRequestError(response.status, title, reasons)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/**
 * Thin, typed HTTP client. Prefixes relative paths with `env.apiBaseUrl`,
 * sends/parses JSON, and normalises errors to `ApiRequestError`. Feature hooks
 * (TanStack Query) build on top of this rather than calling `fetch` directly.
 */
export const apiClient = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'DELETE' }),
}
