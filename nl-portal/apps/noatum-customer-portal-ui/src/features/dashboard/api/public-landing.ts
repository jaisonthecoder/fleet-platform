import { useMutation, useQuery } from '@tanstack/react-query';

import { PublicApiError, publicGet, publicPost } from '../../../api/public/client';
import {
  AccessRequestSchema,
  PUBLIC_ENDPOINTS,
  PublicLandingSchema,
  PublicTrackingMissSchema,
  PublicTrackingSchema,
  type AccessRequestBody,
  type ReferenceKind,
} from '../../../api/public/contracts';

/**
 * The landing page's own content: the counters, the reference kinds the field
 * offers, and the sample references a visitor can try.
 *
 * Long-lived on purpose. None of it is per-visitor, and re-fetching counters
 * every time somebody comes back to the tab would be traffic for nothing.
 */
export function usePublicLanding() {
  return useQuery({
    queryKey: ['public', 'landing'],
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => publicGet(PUBLIC_ENDPOINTS.landing, PublicLandingSchema, { signal }),
  });
}

export interface TrackingLookup {
  reference: string;
  kind: ReferenceKind;
}

/** A lookup that found nothing, with whatever the API offered as a way out. */
export interface TrackingMiss {
  reference: string;
  samples: string[];
  /** The reference exists, but under this kind. Null when it is simply unknown. */
  suggestedKind: ReferenceKind | null;
}

/**
 * A public tracking lookup.
 *
 * Pass null for "nothing searched" — clearing the field is a state, not a
 * request, so the query simply goes idle and the card comes off the page.
 *
 * A miss is a 404 carrying the references that do resolve. It is an answer,
 * not a fault, so it is never retried and the screen shows a way out rather
 * than an error.
 */
export function usePublicTracking(
  lookup: TrackingLookup | null,
  options: {
    /** Called once per fetch that actually found something. */
    onResolved?: (reference: string) => void;
  } = {},
) {
  const query = useQuery({
    queryKey: ['public', 'tracking', lookup?.kind, lookup?.reference],
    enabled: lookup !== null,
    staleTime: 30_000,
    retry: (failureCount, error) =>
      !(error instanceof PublicApiError && error.status < 500) && failureCount < 2,
    queryFn: async ({ signal }) => {
      const found = await publicGet(PUBLIC_ENDPOINTS.tracking, PublicTrackingSchema, {
        query: { reference: lookup!.reference, kind: lookup!.kind },
        signal,
      });
      /*
       * Here rather than in an effect on the result.
       *
       * "This reference resolved" is something that happens once, when the
       * answer arrives — not a state the render has to be kept in sync with.
       * Watching the data with an effect meant setting state from an effect,
       * which cascades renders; a cached repeat also would not need recording,
       * because it is already in the list.
       */
      options.onResolved?.(found.reference);
      return found;
    },
  });

  /*
   * The 404 body is parsed, not cast.
   *
   * This body comes from a failure path, so it is the least tested thing the
   * API returns and the most likely to be a bare `{"message":"not found"}`.
   * Reading `.samples.length` off an unchecked cast is how a missing field
   * becomes a blank page. The schema defaults `samples` to an empty list, which
   * simply hides the chips, and a body that cannot be parsed at all still
   * yields a usable miss carrying the reference the visitor typed.
   */
  let miss: TrackingMiss | null = null;
  if (lookup && query.error instanceof PublicApiError && query.error.notFound) {
    const parsed = PublicTrackingMissSchema.safeParse(query.error.body);
    miss = {
      // What the visitor typed is the thing to echo back, whatever the body said.
      reference: lookup.reference,
      samples: parsed.success ? parsed.data.samples : [],
      suggestedKind: parsed.success ? parsed.data.suggestedKind : null,
    };
  }

  return {
    ...query,
    /** Set when the reference is simply unknown. */
    miss,
    /** Set when something actually went wrong — including a broken contract. */
    failed: query.isError && miss === null,
  };
}

/**
 * An enquiry from somebody who has no account.
 *
 * A mutation rather than a query: it is a write, it must not be retried
 * silently, and the visitor is told what happened either way. There is no
 * public sign-up here — this reaches a person in the local office.
 */
export function useAccessRequest() {
  return useMutation({
    mutationFn: (body: AccessRequestBody) =>
      publicPost(PUBLIC_ENDPOINTS.accessRequest, body, AccessRequestSchema),
  });
}
