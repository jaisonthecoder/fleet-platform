import { AnalyticsService } from '../../src/common/analytics/analytics.service';
import type { TenantContext } from '../../src/common/tenancy/tenant-context';
import type { TenantRepository } from '../../src/common/tenancy/tenant.repository';

/**
 * A real analytics recorder for database tests.
 *
 * Real rather than stubbed on purpose: an event that silently fails to persist is
 * exactly the defect this service was written to remove, so the suites that have a
 * database should be writing them for real.
 */
export function analyticsFor(repo: TenantRepository, context: TenantContext): AnalyticsService {
  return new AnalyticsService(repo, context);
}

/**
 * A no-op recorder for unit tests that have no database.
 *
 * Safe because the production service already swallows its own failures - counting
 * an action is worth strictly less than the action - so a test that does not count
 * is not testing anything different.
 */
export function noAnalytics(): AnalyticsService {
  return { record: async () => {}, recordIn: async () => {} } as unknown as AnalyticsService;
}
