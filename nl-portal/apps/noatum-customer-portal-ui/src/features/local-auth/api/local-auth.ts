import createClient from 'openapi-fetch';

import type { paths } from '../../../api/generated/schema';

export type LocalSession =
  paths['/api/auth/local/sign-in']['post']['responses'][200]['content']['application/json'];
export type ActivationSubject =
  paths['/api/auth/local/activation/{token}']['get']['responses'][200]['content']['application/json'];
export type MfaEnrolment =
  paths['/api/auth/local/mfa/enrolment']['post']['responses'][200]['content']['application/json'];

export type SetPasswordPurpose = 'activation' | 'bootstrap' | 'reset';

const CSRF_STORAGE_KEY = 'noatum.csrf';

/**
 * The session lives in an HttpOnly cookie the browser sends on its own. Only the CSRF
 * token is held here.
 *
 * localStorage rather than sessionStorage on purpose: the cookie is shared by every tab,
 * so a per-tab token makes a second tab look signed out when it is not. The token is a
 * double-submit value, not a credential - it is useless without the cookie.
 */
export function csrfToken(): string | null {
  return localStorage.getItem(CSRF_STORAGE_KEY);
}

function rememberCsrf(session: LocalSession): LocalSession {
  if (session.csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, session.csrfToken);
  return session;
}

export function forgetCsrf(): void {
  localStorage.removeItem(CSRF_STORAGE_KEY);
}

/**
 * Recovers the token for a tab that has the cookie but no cached token - a new tab, a
 * bookmark, or a browser restart. Answers whether a usable session exists.
 */
export async function restoreLocalSession(): Promise<boolean> {
  if (csrfToken()) return true;
  try {
    await accountStatus();
    return true;
  } catch {
    forgetCsrf();
    return false;
  }
}

function origin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (!configured) throw new LocalAuthError('unavailable');
  const url = new URL(configured, window.location.origin);
  const localHttp =
    import.meta.env.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !localHttp)) {
    throw new LocalAuthError('unavailable');
  }
  return url.origin;
}

/** Carries the message the API chose, which is deliberately vague on sign-in failures. */
export class LocalAuthError extends Error {
  constructor(
    readonly kind: 'rejected' | 'expired' | 'unavailable' | 'conflict' | 'throttled',
    message?: string,
  ) {
    super(message ?? kind);
  }
}

function client() {
  const token = csrfToken();
  return createClient<paths>({
    baseUrl: origin(),
    // The session cookie has to travel, which is the whole point of this module.
    credentials: 'include',
    cache: 'no-store',
    redirect: 'error',
    headers: token ? { 'x-csrf-token': token } : undefined,
  });
}

function fail(response: Response, body: unknown): never {
  const message =
    body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message
      : undefined;
  if (response.status === 429) throw new LocalAuthError('throttled', message);
  if (response.status === 409) throw new LocalAuthError('conflict', message);
  if (response.status === 400 || response.status === 404) throw new LocalAuthError('expired', message);
  if (response.status === 401 || response.status === 403) throw new LocalAuthError('rejected', message);
  throw new LocalAuthError('unavailable', message);
}

export async function signIn(
  email: string,
  password: string,
  audience: 'customer' | 'staff' = 'customer',
): Promise<LocalSession> {
  const { data, error, response } = await client().POST('/api/auth/local/sign-in', {
    body: { email, password, audience },
  });
  if (!data) fail(response, error);
  return rememberCsrf(data);
}

export async function signOut(): Promise<void> {
  await client().POST('/api/auth/local/sign-out', {});
  forgetCsrf();
}

export async function verifyMfa(input: { code?: string; recoveryCode?: string }): Promise<LocalSession> {
  const { data, error, response } = await client().POST('/api/auth/local/mfa/verify', { body: input });
  if (!data) fail(response, error);
  return rememberCsrf(data);
}

export async function beginMfaEnrolment(): Promise<MfaEnrolment> {
  const { data, error, response } = await client().POST('/api/auth/local/mfa/enrolment', {});
  if (!data) fail(response, error);
  return data;
}

export async function confirmMfaEnrolment(code: string): Promise<string[]> {
  const { data, error, response } = await client().POST('/api/auth/local/mfa/enrolment/confirm', {
    body: { code },
  });
  if (!data) fail(response, error);
  return data.codes;
}

export async function activationSubject(token: string): Promise<ActivationSubject> {
  const { data, error, response } = await client().GET('/api/auth/local/activation/{token}', {
    params: { path: { token } },
  });
  if (!data) fail(response, error);
  return data;
}

const SET_PASSWORD_PATHS = {
  activation: '/api/auth/local/activation',
  bootstrap: '/api/auth/local/bootstrap',
  reset: '/api/auth/local/password/reset',
} as const;

export async function setPassword(
  purpose: SetPasswordPurpose,
  token: string,
  password: string,
): Promise<LocalSession> {
  const { data, error, response } = await client().POST(SET_PASSWORD_PATHS[purpose], {
    body: { token, password },
  });
  if (!data) fail(response, error);
  return rememberCsrf(data);
}

/** Always resolves: whether the address is known is not something we disclose. */
export async function requestPasswordReset(email: string): Promise<void> {
  await client().POST('/api/auth/local/password/reset-request', { body: { email } });
}

export type AccountStatus =
  paths['/api/auth/local/account']['get']['responses'][200]['content']['application/json'];

export async function accountStatus(signal?: AbortSignal): Promise<AccountStatus> {
  const { data, error, response } = await client().GET('/api/auth/local/account', { signal });
  if (!data) {
    // A refused read means the cookie is gone or spent; a stale token would only
    // make every later call fail in a more confusing way.
    if (response.status === 401 || response.status === 403) forgetCsrf();
    fail(response, error);
  }
  // Reissued on every read, so a tab left open overnight still has a usable token.
  if (data.csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, data.csrfToken);
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { error, response } = await client().POST('/api/auth/local/password/change', {
    body: { currentPassword, newPassword },
  });
  if (!response.ok) fail(response, error);
}

export async function signOutEverywhere(): Promise<number> {
  const { data, error, response } = await client().POST('/api/auth/local/sign-out-everywhere', {});
  if (!data) fail(response, error);
  return data.revoked;
}

export async function regenerateRecoveryCodes(): Promise<string[]> {
  const { data, error, response } = await client().POST('/api/auth/local/mfa/recovery-codes', {});
  if (!data) fail(response, error);
  return data.codes;
}

export async function replaceMfa(currentPassword: string): Promise<MfaEnrolment> {
  const { data, error, response } = await client().POST('/api/auth/local/mfa/replace', {
    body: { currentPassword },
  });
  if (!data) fail(response, error);
  return data;
}

export async function removeMfa(currentPassword: string): Promise<void> {
  const { error, response } = await client().POST('/api/auth/local/mfa/remove', {
    body: { currentPassword },
  });
  if (!response.ok) fail(response, error);
}
