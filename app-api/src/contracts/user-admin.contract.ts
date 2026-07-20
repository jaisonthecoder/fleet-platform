import { z } from 'zod';
import { roleEnum } from '../common/database/schema';

/** The closed set of platform roles (mirrors the DB enum). */
export const platformRoleSchema = z.enum(roleEnum.enumValues);

/** Provenance of a role grant. */
export const roleSourceSchema = z.enum(['manual', 'hcm', 'entra-group']);

/** Admin: assign a role to a person at a hierarchy scope (SoD-checked). */
export const assignRoleSchema = z.object({
  personId: z.string().uuid(),
  role: platformRoleSchema,
  scopeNodeId: z.string().uuid(),
  /** The admin performing the grant (audited); null for system/HCM grants. */
  assignedByPersonId: z.string().uuid().optional(),
  source: roleSourceSchema.optional(),
});
export type AssignRole = z.infer<typeof assignRoleSchema>;

/** Admin: paged/filtered query for the workforce directory grid. */
export const listUsersQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(['Active', 'Suspended', 'Deprovisioned', 'NoLogin']).optional(),
  role: platformRoleSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** A generic paged result envelope for admin list endpoints. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * A workforce-directory row (admin users grid). The base entity is the HR
 * `person`, so **every** employee is listable and role-assignable regardless of
 * whether they have ever signed in. `userId` is the linked SSO login account
 * (created just-in-time on first sign-in) or null.
 */
export interface UserDirectoryDto {
  /** The HR person id — always present; the target of role assign/revoke. */
  personId: string;
  /** The linked SSO login account id, or null if the person has never signed in. */
  userId: string | null;
  /** The person's full name (HR master). */
  name: string;
  /** Person email, falling back to the account email; null if neither is set. */
  email: string | null;
  /** HCM employee id (falls back to a short person id). */
  employeeId: string;
  /** HR grade, or null. */
  grade: string | null;
  /** Distinct active role names the person holds. */
  roles: string[];
  /** Primary scope node name (first active assignment), or null. */
  cluster: string | null;
  /** Last successful sign-in (ISO-8601), or null if never signed in. */
  lastLoginAt: string | null;
  /** Raw account status, or 'NoLogin' when the person has no account yet. */
  accountStatus: string;
  /** Surface status for the grid chip (mirrors accountStatus). */
  status: string;
}

/** Admin: user-population summary tiles bucketed by role family. */
export interface UserSummaryDto {
  employees: number;
  fleetManagers: number;
  executives: number;
  administrators: number;
}

/** One active role a person holds (drives the per-user roles view + revoke). */
export interface UserRoleDto {
  /** The role-assignment id (needed to revoke the grant). */
  assignmentId: string;
  role: string;
  scopeNodeId: string;
  scopeName: string | null;
  source: string;
}

/** Which platform roles roll up into each summary tile. */
export const USER_SUMMARY_BUCKETS = {
  employees: ['Employee'],
  fleetManagers: ['FleetManager'],
  executives: ['Executive', 'ClusterCEO'],
  administrators: ['SystemAdmin', 'DataSteward'],
} as const satisfies Record<keyof UserSummaryDto, readonly string[]>;

/**
 * Buckets per-role active-person counts into the four summary tiles. A person
 * holding multiple roles in the same tile is counted once per role (summary
 * tiles are indicative totals, not distinct-headcount).
 */
export function bucketUserSummary(
  roleCounts: ReadonlyArray<{ role: string; count: number }>,
): UserSummaryDto {
  const summary: UserSummaryDto = { employees: 0, fleetManagers: 0, executives: 0, administrators: 0 };
  const byRole = new Map(roleCounts.map((r) => [r.role, r.count]));
  for (const bucket of Object.keys(USER_SUMMARY_BUCKETS) as (keyof UserSummaryDto)[]) {
    for (const role of USER_SUMMARY_BUCKETS[bucket]) {
      summary[bucket] += byRole.get(role) ?? 0;
    }
  }
  return summary;
}

/** One row of the access-review export ("who has what, where"). */
export interface AccessReviewRow {
  /** The role-assignment id (needed to revoke during recertification). */
  assignmentId: string;
  personId: string;
  role: string;
  scopeNodeId: string;
  source: string;
  assignedByPersonId: string | null;
}
