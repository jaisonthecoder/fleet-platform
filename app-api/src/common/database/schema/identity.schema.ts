import { sql } from 'drizzle-orm';
import { boolean, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { person } from './platform.schema';

/**
 * The login identity (ADR-009 / Sub-Phase 1A₂). SSO via Entra is the login;
 * this row links the Entra subject (`entra_object_id`) to the HR `person`.
 * Created just-in-time on first successful sign-in; roles/scopes come from
 * `role_assignment`. Suspended/deprovisioned, never hard-deleted.
 */
export const userAccount = fleet.table(
  'user_account',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    /** The Entra (OIDC) subject/object id — the stable SSO identity key. */
    entraObjectId: text('entra_object_id').notNull(),
    /** Link to the HR master; null until matched (then no roles until an admin links). */
    personId: uuid('person_id').references(() => person.id),
    email: text('email'),
    displayName: text('display_name'),
    /** Active / Suspended / Deprovisioned. */
    status: text('status').notNull().default('Active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    isServiceAccount: boolean('is_service_account').notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex('user_account_entra_object_id_uq').on(t.entraObjectId)],
);
