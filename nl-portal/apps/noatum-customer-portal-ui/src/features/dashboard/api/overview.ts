import { useQuery } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';

export type AccountOverview = components['schemas']['AccountOverviewDto'];
export type AccountSetupStep = components['schemas']['AccountSetupStepDto'];
export type AccountOffice = components['schemas']['AccountOfficeDto'];
export type AccountContact = components['schemas']['AccountContactDto'];

/**
 * Everything the landing page says about this account.
 *
 * One call, not one per panel: the page asks the same question about itself
 * five ways — who am I, what may I see, what is set up, what is here already,
 * who do I talk to — and the API answers all of it together.
 *
 * Deliberately not `staleTime: Infinity`. Setup steps complete while the
 * customer is on the page, and a checklist that only refreshes on reload is a
 * checklist people stop trusting.
 */
export function useAccountOverview(enabled: boolean) {
  return useQuery({
    queryKey: ['account-overview'],
    enabled,
    retry: false,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<AccountOverview | null> => {
      const client = await authenticatedClient('customer');
      const { data, response } = await client.GET('/api/account/overview', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      });
      /*
       * A refusal is not an answer. Without the permission behind this call we
       * cannot tell a new account from a restricted one, so the page falls back
       * to its introduction rather than reporting zeroes it does not have.
       */
      if (!response.ok || !data) return null;
      return data;
    },
  });
}
