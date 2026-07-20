import { z } from 'zod';

/** Optional scope filter — a hierarchy node id; absent ⇒ whole organization. */
export const dashboardScopeQuerySchema = z.object({
  scopeId: z.string().uuid().optional(),
});
export type DashboardScopeQuery = z.infer<typeof dashboardScopeQuerySchema>;

/**
 * How much cost detail a caller may see (enforced server-side, never by hiding
 * in the client): Finance sees everything, Executive sees aggregates only, all
 * other roles see cost masked (FR-IAM-03 / role-based cost visibility).
 */
export type CostVisibility = 'full' | 'aggregate' | 'masked';

/** Utilisation KPI over the scope (no cost — safe for all roles). */
export interface UtilisationTile {
  scopeId: string | null;
  totalVehicles: number;
  bookableVehicles: number;
  activeBookings: number;
  bookingsLast30d: number;
  utilizationPercent: number;
}

/** One driver's fine count + total (total omitted when masked). */
export interface FinesPerUserRow {
  personId: string;
  fineCount: number;
  totalAmount: string;
}

/** Fines-per-user KPI — the cost-masked tile. */
export interface FinesPerUserTile {
  costVisibility: CostVisibility;
  totalFines: number;
  /** Grand total (null when masked). */
  totalAmount: string | null;
  /** Per-user breakdown (empty unless the caller has full cost visibility). */
  perUser: FinesPerUserRow[];
}

/** Compliance heat map over the scope. */
export interface ComplianceHeatMapTile {
  valid: number;
  expiringSoon: number;
  expired: number;
  activeBlocks: number;
}

/** Dedicated-vehicle entitlement inventory over the scope. */
export interface EntitlementInventoryRow {
  justificationCategory: string;
  count: number;
}
export interface EntitlementInventoryTile {
  allocated: number;
  pendingApproval: number;
  byCategory: EntitlementInventoryRow[];
}

/** Telematics coverage: devices reporting vs the fleet in scope. */
export interface TelematicsCoverageTile {
  fleetInScope: number;
  devicesReporting: number;
  coveragePercent: number;
}
