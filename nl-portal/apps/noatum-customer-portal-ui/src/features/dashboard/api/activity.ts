import { useQuery } from '@tanstack/react-query';

import { authenticatedClient } from '../../auth/api/current-user';

/**
 * Has this account done anything yet.
 *
 * There is no dashboard summary endpoint — `modules/dashboard` is still an empty
 * module — so the one customer-facing list that exists answers the question:
 * quotations. It is the first thing a customer creates, so "no quotations" is a
 * good proxy for "nothing here yet".
 *
 * When shipments, bookings and invoices arrive this should be replaced by a
 * single summary call rather than one request per section. The seam is here.
 */
export function useCustomerActivity(enabled: boolean) {
  return useQuery({
    queryKey: ['customer-activity'],
    enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const client = await authenticatedClient('customer');
      const { data, response } = await client.GET('/api/quotes', {
        // One row is enough to answer "is there anything"; the page does not
        // list them, so asking for more would be traffic for nothing. `total`
        // carries the real count, so the row itself is only a liveness check.
        params: { query: { pageSize: '1', page: '1' } as never },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
      /*
       * A refusal is not an answer. Without permission to read quotations we
       * cannot tell an empty account from a restricted one, so we report "no
       * activity" and the page shows the introduction — which is correct for
       * both, and never claims a count it does not have.
       */
      if (!response.ok || !data) return { quotes: 0 };
      const total = (data as { total?: unknown }).total;
      return { quotes: typeof total === 'number' ? total : 0 };
    },
  });
}
