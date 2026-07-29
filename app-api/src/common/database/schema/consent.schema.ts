import { sql } from 'drizzle-orm';
import { check, foreignKey, index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { person } from './platform.schema';

/** Application-owned immutable bilingual consent versions and approval state. */
export const consentTemplate = fleet.table('consent_template', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: orgId(),
  domain: text('domain').notNull(),
  version: text('version').notNull(),
  status: text('status').notNull().default('Draft'),
  contentEn: text('content_en').notNull(),
  contentAr: text('content_ar').notNull(),
  contentSha256: text('content_sha256').notNull(),
  effectiveAtUtc: timestamp('effective_at_utc', { withTimezone: true }).notNull(),
  createdByPersonId: uuid('created_by_person_id').notNull(),
  activatedByPersonId: uuid('activated_by_person_id'),
  activatedAtUtc: timestamp('activated_at_utc', { withTimezone: true }),
  retiredByPersonId: uuid('retired_by_person_id'),
  retiredAtUtc: timestamp('retired_at_utc', { withTimezone: true }),
  ...timestamps(),
}, (t) => [
  uniqueIndex('consent_template_version_uq').on(t.organizationId, t.domain, t.version),
  uniqueIndex('consent_template_active_uq').on(t.organizationId, t.domain).where(sql`${t.status} = 'Active'`),
  index('consent_template_domain_status_idx').on(t.organizationId, t.domain, t.status, t.effectiveAtUtc),
  foreignKey({ columns: [t.organizationId, t.createdByPersonId], foreignColumns: [person.organizationId, person.id], name: 'consent_template_created_actor_org_fk' }),
  foreignKey({ columns: [t.organizationId, t.activatedByPersonId], foreignColumns: [person.organizationId, person.id], name: 'consent_template_activated_actor_org_fk' }),
  foreignKey({ columns: [t.organizationId, t.retiredByPersonId], foreignColumns: [person.organizationId, person.id], name: 'consent_template_retired_actor_org_fk' }),
  check('consent_template_domain_valid', sql`${t.domain} IN ('Booking', 'DedicatedVehicle')`),
  check('consent_template_status_valid', sql`${t.status} IN ('Draft', 'Active', 'Retired')`),
  check('consent_template_content_present', sql`length(trim(${t.contentEn})) > 0 AND length(trim(${t.contentAr})) > 0`),
  check('consent_template_hash_valid', sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
]);
