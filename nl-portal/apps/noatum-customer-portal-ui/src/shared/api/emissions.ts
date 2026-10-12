import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { publicGet, publicPost } from '../../api/public/client';
import {
  EmissionsEstimateSchema,
  EmissionsReferenceSchema,
  PUBLIC_ENDPOINTS,
  type EmissionsEstimateRequest,
} from '../../api/public/contracts';

/**
 * The lanes, modes and weights the calculator offers.
 *
 * Reference data, not a customer's data, so it caches for the session. When a
 * real emissions source is configured behind EmissionsAdapter this is the call
 * that starts returning its catalogue.
 */
export function useEmissionsReference() {
  return useQuery({
    queryKey: ['public', 'emissions', 'reference'],
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      publicGet(PUBLIC_ENDPOINTS.emissionsReference, EmissionsReferenceSchema, { signal }),
  });
}

/**
 * An indicative estimate for one lane, mode and weight.
 *
 * The arithmetic is deliberately not done here. A figure the customer sees must
 * have exactly one implementation, and it is the server's: a copy in the
 * browser is how the number on the screen ends up disagreeing with the number
 * on the quotation.
 *
 * Previous results are kept while a new one is in flight, so changing the
 * weight moves the bars rather than blanking them.
 */
export function useCo2Estimate(request: EmissionsEstimateRequest | null) {
  return useQuery({
    queryKey: ['public', 'emissions', 'estimate', request?.laneId, request?.mode, request?.tonnes],
    enabled: request !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) =>
      publicPost(PUBLIC_ENDPOINTS.emissionsEstimate, request, EmissionsEstimateSchema, { signal }),
  });
}
