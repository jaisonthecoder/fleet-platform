import {
  PUBLIC_ENDPOINTS,
  type AccessRequestBody,
  type AccessRequestDto,
  type EmissionsEstimateDto,
  type EmissionsEstimateRequest,
  type FreightMode,
  type PublicTrackingDto,
} from '../contracts';
import {
  INTENSITY,
  LANE_DISTANCE,
  MODES,
  emissionsReference,
  landing,
  trackingRecords,
  type TrackingRecord,
} from './data';

/* ────────────────────────────────────────────────────────────────────────────
 * An in-browser stand-in for the public API.
 *
 * It is written as a `fetch`, not as a set of canned objects, so that the app
 * above it exercises the real thing: status codes, JSON parsing, aborts,
 * latency, caching keys, retries. A screen that works against this one works
 * against the API, and a screen that only works because the data arrived
 * synchronously fails here — which is the point.
 *
 * Calculations live here rather than in the component because they belong to
 * the server. The frontend convention is explicit: anything the browser would
 * otherwise compute the same way as the server comes from an endpoint, since
 * duplicating it is how the number on screen ends up disagreeing with the
 * number on the quotation.
 *
 * Delete this folder when the API ships. See `../client.ts`.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Enough to see a loading state, not enough to be tiresome. */
const LATENCY_MS = 260;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Honours the caller's abort, so timeouts and unmounts behave as they will live. */
function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** "mscu7745123", "MSCU-774512-3" and "MSCU 774512-3" are one reference. */
const normalise = (value: string) => value.toLowerCase().replace(/[\s\-/.]/g, '');

/*
 * Whole reference only, after punctuation and case are stripped.
 *
 * An earlier version matched substrings in both directions, so typing "7"
 * returned a shipment. That made the stand-in far more forgiving than any real
 * tracking API — and it made the not-found screen, which is the whole reason
 * this returns 404s, almost unreachable. A stand-in that flatters the page is
 * worse than no stand-in: it hides exactly the states it exists to exercise.
 */
function track(reference: string, kind: string | null): Response {
  const needle = normalise(reference);
  const records = trackingRecords();
  const matches = records.filter((record) => normalise(record.reference) === needle);

  const hit: TrackingRecord | undefined = matches.find((record) => !kind || record.kind === kind);

  if (!hit) {
    // Found, but filed under a different kind. Saying so beats "no record":
    // the visitor picked the wrong tab, and the screen can offer the right one.
    const elsewhere = matches[0];
    return json(
      {
        reference,
        samples: landing.samples,
        suggestedKind: elsewhere?.kind ?? null,
      },
      404,
    );
  }

  // `kind` is how the lookup is indexed, not part of the answer.
  const { kind: _filed, ...body } = hit;
  return json(body satisfies PublicTrackingDto);
}

function estimate(request: EmissionsEstimateRequest): Response {
  const lane = LANE_DISTANCE.find((entry) => entry.id === request.laneId);
  if (!lane) return json({ message: 'unknown lane' }, 404);

  const served = MODES.filter((mode) => lane.distance[mode] !== undefined);
  if (served.length === 0) return json({ message: 'lane has no modes' }, 409);

  // Asking for a mode the lane does not serve is answered with the mode that
  // was used, not an error: the panel must never be left showing zero.
  const mode: FreightMode = served.includes(request.mode) ? request.mode : served[0]!;

  // A floor keeps a half-typed weight from reading as "no emissions".
  const tonnes = Math.max(0.1, Number(request.tonnes) || 0.1);
  const kgFor = (candidate: FreightMode) =>
    (tonnes * (lane.distance[candidate] ?? 0) * INTENSITY[candidate]) / 1000;

  const byMode = served.map((candidate) => ({ mode: candidate, kg: kgFor(candidate) }));
  const kg = kgFor(mode);

  const body: EmissionsEstimateDto = {
    laneId: lane.id,
    mode,
    tonnes,
    distanceKm: lane.distance[mode] ?? 0,
    intensity: INTENSITY[mode],
    kg,
    perTonneKg: kg / tonnes,
    byMode,
    lowestMode: byMode.reduce((best, entry) => (entry.kg < best.kg ? entry : best)).mode,
    highestMode: byMode.reduce((worst, entry) => (entry.kg > worst.kg ? entry : worst)).mode,
  };
  return json(body);
}

export const mockFetch: typeof fetch = async (input, init) => {
  const request = new Request(input as RequestInfo, init);
  const { pathname, searchParams } = new URL(request.url);

  await wait(LATENCY_MS, init?.signal ?? request.signal);

  if (pathname === PUBLIC_ENDPOINTS.landing) return json(landing);

  if (pathname === PUBLIC_ENDPOINTS.tracking) {
    const reference = searchParams.get('reference')?.trim() ?? '';
    if (!reference) return json({ message: 'reference is required' }, 400);
    return track(reference, searchParams.get('kind'));
  }

  if (pathname === PUBLIC_ENDPOINTS.emissionsReference) return json(emissionsReference);

  if (pathname === PUBLIC_ENDPOINTS.emissionsEstimate) {
    if (request.method !== 'POST') return json({ message: 'method not allowed' }, 405);
    const body = (await request.json().catch(() => null)) as EmissionsEstimateRequest | null;
    if (!body?.laneId) return json({ message: 'laneId is required' }, 400);
    return estimate(body);
  }

  if (pathname === PUBLIC_ENDPOINTS.accessRequest) {
    if (request.method !== 'POST') return json({ message: 'method not allowed' }, 405);
    const body = (await request.json().catch(() => null)) as AccessRequestBody | null;
    const problems: Record<string, string> = {};
    if (!body?.company?.trim()) problems.company = 'required';
    // The server validates regardless of what the form checked; a client-side
    // check is a convenience, never a second rulebook.
    if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim())) problems.email = 'invalid';
    if (Object.keys(problems).length > 0) return json({ problems }, 422);

    const created: AccessRequestDto = {
      reference: `ACC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      receivedAt: new Date().toISOString(),
    };
    return json(created, 201);
  }

  return json({ message: `no stand-in for ${pathname}` }, 404);
};
