import type { ZodType } from 'zod';

import { mockFetch } from './mock/mockFetch';

/* ────────────────────────────────────────────────────────────────────────────
 * The transport for the public surfaces.
 *
 * There is exactly one seam between "no backend yet" and "backend": which
 * fetch is used. `mockFetch` answers with real `Response` objects — real status
 * codes, real JSON bodies, real latency — so every caller above this line runs
 * the same code in both worlds, including its 404 and its failure paths.
 *
 * To go live: drop VITE_PUBLIC_API_MOCK from the environment. To finish the
 * job, delete `./mock`, the import and the branch below. No hook, component or
 * query key changes either way.
 * ──────────────────────────────────────────────────────────────────────────── */

/*
 * Opt in, never opt out. An environment that has not been told to use the
 * stand-in gets the real API and, while that API has no public routes, an
 * honest failure state. The alternative default would mean one forgotten
 * variable is all it takes to show a deployed customer a shipment that does
 * not exist, which is the worst thing a tracking page can do.
 */
const useMock = import.meta.env.VITE_PUBLIC_API_MOCK === 'true';

const transport: typeof fetch = useMock ? mockFetch : (input, init) => fetch(input, init);

/** True while the page is served by the in-browser stand-in rather than the API. */
export const publicApiIsStandIn = useMock;

export class PublicApiError extends Error {
  constructor(
    readonly status: number,
    /** The raw body, when there was one. Carries the recovery data on a 404.
        Unparsed on purpose: the caller knows which shape it expects. */
    readonly body: unknown,
  ) {
    super(`public api ${status}`);
    this.name = 'PublicApiError';
  }

  /** No such reference — a normal answer on a lookup, not a fault. */
  get notFound() {
    return this.status === 404;
  }
}

/**
 * The API answered, but not with what it promised.
 *
 * Its own class because it is a different fault from a 500 and needs a
 * different fix: somebody changed the contract. It reaches the screen as an
 * ordinary failure state rather than a thrown render.
 */
export class PublicContractError extends Error {
  constructor(
    readonly path: string,
    readonly issues: unknown,
  ) {
    super(`public api response did not match the contract: ${path}`);
    this.name = 'PublicContractError';
  }
}

/** The configured API base is unusable, which is a deployment fault. */
export class PublicApiConfigError extends Error {
  constructor() {
    super('VITE_API_BASE_URL is not a usable API origin');
    this.name = 'PublicApiConfigError';
  }
}

/**
 * The same hardening the authenticated client applies, for the same reasons.
 *
 * This surface is anonymous, which makes it *more* exposed rather than less:
 * it is the one page an attacker can reach without an account. A base URL
 * carrying credentials, a query or a fragment is a misconfiguration; plain HTTP
 * outside local development is a downgrade. Both fail closed.
 */
function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  let url: URL;
  try {
    url = new URL(configured || window.location.origin, window.location.origin);
  } catch {
    throw new PublicApiConfigError();
  }

  const localHttpInDev =
    import.meta.env.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);

  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !localHttpInDev)) {
    throw new PublicApiConfigError();
  }
  return url.origin;
}

/**
 * Public endpoints are anonymous by definition: no cookie, no bearer token, no
 * credentials. That is not a shortcut, it is the security rule — a surface that
 * reveals nothing about which customers exist cannot be allowed to identify the
 * caller either.
 */
function url(path: string, query?: Record<string, string | undefined>): string {
  const target = new URL(path, apiOrigin());
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') target.searchParams.set(key, value);
  }
  return target.toString();
}

/**
 * Every response is parsed before anything reads a field off it.
 *
 * A failure body is handed back raw on the error, because the caller decides
 * what a 404 means; a success body that does not match is a contract error,
 * never a half-populated object handed to the render.
 */
async function parse<T>(response: Response, schema: ZodType<T>, path: string): Promise<T> {
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new PublicApiError(response.status, body);

  const result = schema.safeParse(body);
  if (!result.success) throw new PublicContractError(path, result.error.issues);
  return result.data;
}

/** Ten seconds, the same ceiling the authenticated calls use. */
const TIMEOUT_MS = 10_000;

const signalFor = (signal?: AbortSignal) =>
  signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS);

export async function publicGet<T>(
  path: string,
  schema: ZodType<T>,
  options: { query?: Record<string, string | undefined>; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await transport(url(path, options.query), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal: signalFor(options.signal),
  });
  return parse(response, schema, path);
}

export async function publicPost<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await transport(url(path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal: signalFor(options.signal),
  });
  return parse(response, schema, path);
}
