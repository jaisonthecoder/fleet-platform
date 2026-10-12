import { useQuery } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';

export type QuoteInsights = components['schemas']['QuoteInsightsDto'];
export type QuoteInsightWaiting = components['schemas']['QuoteInsightWaitingDto'];
export type QuoteInsightRateLane = components['schemas']['QuoteInsightRateLaneDto'];
export type QuoteInsightRecent = components['schemas']['QuoteInsightRecentDto'];

/**
 * Everything the quotations landing page reports, in one call.
 *
 * Returns null on a refusal rather than throwing: the page's job is to let a
 * customer ask for a quote, and it must still do that when the reporting behind
 * it is unavailable.
 */
export function useQuoteInsights(enabled: boolean) {
  return useQuery({
    queryKey: ['quote-insights'],
    enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<QuoteInsights | null> => {
      const client = await authenticatedClient('customer');
      const { data, response } = await client.GET('/api/quotes/insights', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
      });
      if (!response.ok || !data) return null;
      return data as QuoteInsights;
    },
  });
}
