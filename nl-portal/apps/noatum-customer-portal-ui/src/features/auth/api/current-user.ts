import createClient from 'openapi-fetch';
import type { paths } from '../../../api/generated/schema';
import { accessToken, type SignInAudience } from '../../../auth/sign-in';
import { devAuthEnabled, getDevIdentity } from '../../../auth/dev-session';
import { csrfToken } from '../../local-auth/api/local-auth';

export class AccessError extends Error {
  constructor(readonly kind: 'signInRequired' | 'accessDenied' | 'accessUnavailable') {
    super(kind);
  }
}

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (!configured) throw new AccessError('accessUnavailable');
  const url = new URL(configured, window.location.origin);
  if (url.username || url.password || url.search || url.hash ||
    (url.protocol !== 'https:' && !(import.meta.env.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new AccessError('accessUnavailable');
  }
  return url.origin;
}

export async function authenticatedClient(audience: SignInAudience) {
  const origin = apiOrigin();
  const common = { credentials: 'omit', cache: 'no-store', redirect: 'error' } as const;

  // A portal session (ADR-006) lives in an HttpOnly cookie. Its presence is inferred
  // from the CSRF token issued alongside it, which is the only part script can read.
  const csrf = csrfToken();
  if (csrf) {
    return createClient<paths>({
      baseUrl: origin,
      headers: { 'x-csrf-token': csrf },
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
    });
  }

  // A locally picked identity travels in headers instead of a bearer token. The
  // API ignores these unless it too is configured for the bypass.
  const devIdentity = devAuthEnabled ? getDevIdentity() : null;
  if (devIdentity) {
    return createClient<paths>({
      baseUrl: origin,
      headers: {
        'X-Dev-User-Subject': devIdentity.subject,
        'X-Dev-User-Email': devIdentity.email,
        'X-Dev-User-Name': devIdentity.displayName,
      },
      ...common,
    });
  }

  let token: string;
  try { token = await accessToken(audience); }
  catch { throw new AccessError('signInRequired'); }
  return createClient<paths>({
    baseUrl: origin, headers: { Authorization: `Bearer ${token}` },
    ...common,
  });
}

export async function currentUser(audience: SignInAudience, signal: AbortSignal) {
  const client = await authenticatedClient(audience);
  const { data, response } = await client.GET('/api/me', {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
  });
  if (response.status === 401 || response.status === 403) throw new AccessError('accessDenied');
  if (!response.ok || !data || !Array.isArray(data.permissions) ||
    data.permissions.some((permission) => typeof permission !== 'string')) {
    throw new AccessError('accessUnavailable');
  }
  // An older API without `features` degrades to "nothing optional is on", which hides
  // controls rather than showing ones the guard would refuse.
  const features = Array.isArray(data.features)
    ? data.features.filter((key): key is string => typeof key === 'string')
    : [];
  // Settings fail the other way round: an absent map means every key falls back to the
  // caller's stated default, because a setting always has a value and blanking a screen
  // is worse than showing the platform default.
  const settings =
    data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
      ? data.settings
      : {};
  return { ...data, features, settings };
}
