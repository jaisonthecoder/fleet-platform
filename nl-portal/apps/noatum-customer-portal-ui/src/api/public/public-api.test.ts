import { describe, expect, it } from 'vitest';

import {
  EmissionsEstimateSchema,
  EmissionsReferenceSchema,
  PublicLandingSchema,
  PublicTrackingMissSchema,
  PublicTrackingSchema,
  PUBLIC_ENDPOINTS,
} from './contracts';
import { mockFetch } from './mock/mockFetch';

/* ────────────────────────────────────────────────────────────────────────────
 * The stand-in is tested against the same schemas the app parses with.
 *
 * That is the whole point of it. If the stand-in and the contract can drift,
 * then building the page against the stand-in proves nothing — the screen would
 * be written to a shape the real API was never asked for. These tests pin the
 * two together, so a change to either one has to be a change to both.
 *
 * They also cover the answers that are easy to forget: the 404 that means "no
 * such reference", the 404 body a *real* API might send instead, and the
 * matching rules — because a stand-in that says yes to everything hides exactly
 * the states it exists to exercise.
 * ──────────────────────────────────────────────────────────────────────────── */

const base = 'https://api.test';
const get = (path: string, query: Record<string, string> = {}) => {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return mockFetch(url.toString(), { method: 'GET' });
};
const post = (path: string, body: unknown) =>
  mockFetch(new URL(path, base).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('public landing endpoint', () => {
  it('answers with a body the contract accepts', async () => {
    const response = await get(PUBLIC_ENDPOINTS.landing);
    expect(response.status).toBe(200);
    expect(PublicLandingSchema.safeParse(await response.json()).success).toBe(true);
  });

  it('offers samples that actually resolve', async () => {
    const landing = PublicLandingSchema.parse(await (await get(PUBLIC_ENDPOINTS.landing)).json());
    expect(landing.samples.length).toBeGreaterThan(0);

    for (const reference of landing.samples) {
      // Without a kind, any filing matches — which is what the samples rely on.
      const hit = await get(PUBLIC_ENDPOINTS.tracking, { reference });
      expect(hit.status, `sample ${reference} should resolve`).toBe(200);
    }
  });
});

describe('public tracking', () => {
  it('returns a result the contract accepts', async () => {
    const response = await get(PUBLIC_ENDPOINTS.tracking, { reference: 'MSCU 774512-3' });
    expect(response.status).toBe(200);

    const parsed = PublicTrackingSchema.safeParse(await response.json());
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
  });

  it('ignores case, spaces and dashes in the reference', async () => {
    for (const spelling of ['MSCU 774512-3', 'mscu7745123', 'MSCU-774512-3', 'mscu 774512 3']) {
      const response = await get(PUBLIC_ENDPOINTS.tracking, { reference: spelling });
      expect(response.status, `${spelling} should resolve`).toBe(200);
    }
  });

  it('does not match on a fragment', async () => {
    // A stand-in that answers "7" with a shipment makes the not-found screen
    // unreachable and flatters the page. Partial input is not a reference.
    for (const fragment of ['7', 'MSCU', '774512', '020']) {
      const response = await get(PUBLIC_ENDPOINTS.tracking, { reference: fragment });
      expect(response.status, `${fragment} should not resolve`).toBe(404);
    }
  });

  it('404s with a body the miss schema accepts', async () => {
    const response = await get(PUBLIC_ENDPOINTS.tracking, { reference: 'NOPE-0000' });
    expect(response.status).toBe(404);

    const miss = PublicTrackingMissSchema.parse(await response.json());
    expect(miss.samples.length).toBeGreaterThan(0);
    expect(miss.suggestedKind).toBeNull();
  });

  it('honours the reference kind rather than ignoring it', async () => {
    // The container number is filed under `container`, so asking for it as a
    // booking must not succeed — otherwise the kind selector is decoration.
    const wrong = await get(PUBLIC_ENDPOINTS.tracking, {
      reference: 'MSCU 774512-3',
      kind: 'booking',
    });
    expect(wrong.status).toBe(404);

    const right = await get(PUBLIC_ENDPOINTS.tracking, {
      reference: 'MSCU 774512-3',
      kind: 'container',
    });
    expect(right.status).toBe(200);
  });

  it('says which kind a mis-filed reference belongs to', async () => {
    const response = await get(PUBLIC_ENDPOINTS.tracking, {
      reference: 'MSCU 774512-3',
      kind: 'booking',
    });
    const miss = PublicTrackingMissSchema.parse(await response.json());
    expect(miss.suggestedKind).toBe('container');
  });

  it('never leaks the filing kind into the result body', async () => {
    const response = await get(PUBLIC_ENDPOINTS.tracking, { reference: 'MSCU 774512-3' });
    expect(await response.json()).not.toHaveProperty('kind');
  });

  it('rejects an empty reference rather than answering something', async () => {
    expect((await get(PUBLIC_ENDPOINTS.tracking, { reference: '  ' })).status).toBe(400);
  });
});

describe('the miss schema survives an API that is not ours', () => {
  /*
   * These are the bodies that used to take the page down. The screen reads
   * `miss.samples.length`, so a 404 without `samples` must still parse.
   */
  it.each([
    ['a bare message', { message: 'not found' }],
    ['an empty object', {}],
    ['samples of the wrong type', { samples: 'none' }],
    ['a nulled field', { samples: null }],
  ])('parses %s into an empty sample list', (_label, body) => {
    const parsed = PublicTrackingMissSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.samples).toEqual([]);
  });

  it('fails cleanly on a body that is not an object at all', () => {
    // The hook falls back to a usable miss when this happens; what matters is
    // that it reports failure rather than handing back a broken object.
    expect(PublicTrackingMissSchema.safeParse(null).success).toBe(false);
    expect(PublicTrackingMissSchema.safeParse('<html>502</html>').success).toBe(false);
  });
});

describe('emissions', () => {
  it('returns reference data the contract accepts', async () => {
    const response = await get(PUBLIC_ENDPOINTS.emissionsReference);
    const parsed = EmissionsReferenceSchema.safeParse(await response.json());
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
  });

  it('estimates a lane the contract accepts', async () => {
    const response = await post(PUBLIC_ENDPOINTS.emissionsEstimate, {
      laneId: 'cntao-esvlc',
      mode: 'Sea FCL',
      tonnes: 34,
    });
    const parsed = EmissionsEstimateSchema.safeParse(await response.json());
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
  });

  it('scales linearly with weight, which is what the panel implies', async () => {
    const one = EmissionsEstimateSchema.parse(
      await (await post(PUBLIC_ENDPOINTS.emissionsEstimate, { laneId: 'cntao-esvlc', mode: 'Sea FCL', tonnes: 10 })).json(),
    );
    const two = EmissionsEstimateSchema.parse(
      await (await post(PUBLIC_ENDPOINTS.emissionsEstimate, { laneId: 'cntao-esvlc', mode: 'Sea FCL', tonnes: 20 })).json(),
    );
    expect(two.kg).toBeCloseTo(one.kg * 2, 6);
    expect(two.perTonneKg).toBeCloseTo(one.perTonneKg, 6);
  });

  it('answers with a served mode when asked for one the lane does not run', async () => {
    // Barcelona to Lyon is road and rail only. Returning an error here would
    // leave the panel showing zero, so it substitutes and says which it used.
    const estimate = EmissionsEstimateSchema.parse(
      await (await post(PUBLIC_ENDPOINTS.emissionsEstimate, { laneId: 'esbcn-frlyn', mode: 'Sea FCL', tonnes: 5 })).json(),
    );
    expect(estimate.mode).not.toBe('Sea FCL');
    expect(estimate.byMode.map((entry) => entry.mode)).toContain(estimate.mode);
  });

  it('floors a zero or missing weight instead of reporting no emissions', async () => {
    const estimate = EmissionsEstimateSchema.parse(
      await (await post(PUBLIC_ENDPOINTS.emissionsEstimate, { laneId: 'cntao-esvlc', mode: 'Air', tonnes: 0 })).json(),
    );
    expect(estimate.kg).toBeGreaterThan(0);
  });

  it('names the lowest and highest modes from its own figures', async () => {
    const estimate = EmissionsEstimateSchema.parse(
      await (await post(PUBLIC_ENDPOINTS.emissionsEstimate, { laneId: 'cntao-esvlc', mode: 'Sea FCL', tonnes: 12 })).json(),
    );
    const sorted = [...estimate.byMode].sort((a, b) => a.kg - b.kg);
    expect(estimate.lowestMode).toBe(sorted[0]!.mode);
    expect(estimate.highestMode).toBe(sorted[sorted.length - 1]!.mode);
  });

  it('rejects an unknown lane', async () => {
    const response = await post(PUBLIC_ENDPOINTS.emissionsEstimate, {
      laneId: 'nowhere',
      mode: 'Air',
      tonnes: 1,
    });
    expect(response.status).toBe(404);
  });
});

describe('access request', () => {
  it('accepts a complete enquiry and returns a reference', async () => {
    const response = await post(PUBLIC_ENDPOINTS.accessRequest, {
      company: 'Acme Freight',
      email: 'ana@acme.example',
      country: 'Spain',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ reference: expect.stringMatching(/^ACC-\d{4}-\d{4}$/) });
  });

  it('validates on the server regardless of what the form checked', async () => {
    const response = await post(PUBLIC_ENDPOINTS.accessRequest, {
      company: '',
      email: 'not-an-email',
      country: 'Spain',
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ problems: { company: 'required', email: 'invalid' } });
  });
});

describe('transport behaviour', () => {
  it('aborts rather than resolving late', async () => {
    const controller = new AbortController();
    const pending = mockFetch(new URL(PUBLIC_ENDPOINTS.landing, base).toString(), {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it('404s an endpoint it has no stand-in for', async () => {
    expect((await get('/api/public/nothing-here')).status).toBe(404);
  });
});
