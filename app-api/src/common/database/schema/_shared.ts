import { pgEnum, pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';

/** All application tables live under the naming-neutral `fleet` schema. */
export const fleet = pgSchema('fleet');

/** Dormant multi-org seam anchor (ADR-008): a single seeded organization in Phase 1. */
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

/** Fresh created/updated UTC timestamp columns for a table (call per table). */
export const timestamps = () => ({
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAtUtc: timestamp('updated_at_utc', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Dormant tenant seam column (ADR-008): inert default, RLS off, never branched
 * on by application code. Call per table that needs it.
 */
export const orgId = () =>
  uuid('organization_id').notNull().default(DEFAULT_ORGANIZATION_ID);

/** Closed set of platform roles; a person may hold many at different scopes. */
export const roleEnum = pgEnum('fleet_role', [
  'Employee',
  'Approver',
  'Delegate',
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
  'ClusterCEO',
  'Procurement',
  'Finance',
  'HR',
  'InsuranceLead',
  'HSE',
  'InternalAudit',
  'Executive',
  'DataSteward',
  'SystemAdmin',
  'SubstituteDriver',
  'ProfessionalDriver',
]);

export type PlatformRole = (typeof roleEnum.enumValues)[number];
