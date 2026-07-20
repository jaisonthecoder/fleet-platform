import type { PlatformRole } from '../../../common/database/schema';
import type {
  CostVisibility,
  FinesPerUserRow,
  FinesPerUserTile,
} from '../../../contracts/dashboards.contract';

/**
 * Server-side cost visibility from the caller's roles (FR-IAM-03): Finance sees
 * full per-entity cost, Executive sees aggregate totals only, everyone else has
 * cost masked. Pure — the roles are the only input — so it is exhaustively
 * unit-testable and can never be bypassed by client hiding.
 */
export function costVisibility(roles: readonly PlatformRole[]): CostVisibility {
  if (roles.includes('Finance')) {
    return 'full';
  }
  if (roles.includes('Executive')) {
    return 'aggregate';
  }
  return 'masked';
}

/**
 * Applies cost visibility to the fines-per-user tile:
 * - **full** → grand total + per-user breakdown;
 * - **aggregate** → grand total only (no per-user rows);
 * - **masked** → counts only (no monetary amounts at all).
 */
export function maskFinesTile(
  visibility: CostVisibility,
  data: { totalFines: number; totalAmount: string; perUser: FinesPerUserRow[] },
): FinesPerUserTile {
  if (visibility === 'full') {
    return { costVisibility: 'full', totalFines: data.totalFines, totalAmount: data.totalAmount, perUser: data.perUser };
  }
  if (visibility === 'aggregate') {
    return { costVisibility: 'aggregate', totalFines: data.totalFines, totalAmount: data.totalAmount, perUser: [] };
  }
  return { costVisibility: 'masked', totalFines: data.totalFines, totalAmount: null, perUser: [] };
}
