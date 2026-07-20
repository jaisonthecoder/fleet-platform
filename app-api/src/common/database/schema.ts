/**
 * Drizzle schema barrel — the typed shape of the `fleet` database.
 *
 * Phase 0 lands the cross-cutting platform core (organization, hierarchy,
 * person, roles, delegation, SoD, policy, workflow, audit, outbox/inbox,
 * scheduled work). Feature tables (vehicle, booking, …) are added per slice
 * in later phases. Custom DDL (extensions, ltree, hash-chain trigger,
 * exclusion constraints) lives in hand-authored SQL migrations.
 */
export * from './schema/_shared';
export * from './schema/_types';
export * from './schema/platform.schema';
export * from './schema/lookup.schema';
export * from './schema/identity.schema';
export * from './schema/vehicle.schema';
export * from './schema/migration.schema';
export * from './schema/compliance.schema';
export * from './schema/booking.schema';
export * from './schema/handover.schema';
export * from './schema/entitlement.schema';
export * from './schema/fine.schema';
export * from './schema/policy.schema';
export * from './schema/workflow.schema';
export * from './schema/audit.schema';
export * from './schema/telematics.schema';
