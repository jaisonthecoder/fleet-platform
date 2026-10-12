import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { components } from '../../../api/generated/schema';
import { authenticatedClient } from '../../auth/api/current-user';

export type DashboardAnalytics = components['schemas']['DashboardAnalyticsDto'];
export type DashboardKpi = components['schemas']['DashboardKpiDto'];
export type DashboardLane = components['schemas']['DashboardLaneDto'];
export type DashboardAction = components['schemas']['DashboardActionDto'];
export type DashboardArrival = components['schemas']['DashboardArrivalDto'];

export type DashboardPeriod = DashboardAnalytics['period'];
export type DashboardModeFilter = DashboardAnalytics['mode'];

export interface DashboardFilters {
  period: DashboardPeriod;
  mode: DashboardModeFilter;
}

/**
 * The whole dashboard, in one call.
 *
 * `placeholderData` on purpose: changing the period or the mode re-asks the same
 * question of the same screen, and blanking nine panels back to skeletons every
 * time somebody presses "6 months" makes a dashboard feel broken. The old
 * figures stay while the new ones are fetched, and `isFetching` dims them.
 *
 * Returns null rather than throwing on a refusal. The switch behind this
 * endpoint can be off, and a dashboard that is not enabled is a state the page
 * explains — not an error it reports.
 */
export function useDashboardAnalytics(filters: DashboardFilters, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard-analytics', filters.period, filters.mode],
    enabled,
    retry: false,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<DashboardAnalytics | null> => {
      const client = await authenticatedClient('customer');
      const { data, response } = await client.GET('/api/dashboard/analytics', {
        params: { query: { period: filters.period, mode: filters.mode } },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      });
      if (!response.ok || !data) return null;
      return data as DashboardAnalytics;
    },
  });
}
