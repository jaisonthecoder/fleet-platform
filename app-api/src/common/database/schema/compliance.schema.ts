import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  pgEnum,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { person } from './platform.schema';

export const complianceItemStatusEnum = pgEnum('fleet_compliance_item_status', [
  'Valid',
  'ExpiringSoon',
  'Expired',
]);

/**
 * A per-vehicle / per-driver compliance obligation (Mulkiya, insurance, licence,
 * black-point). `next_alert_at` drives the scheduled expiry ladders. Partial
 * indexes keep the not-yet-expired hot set fast.
 */
export const complianceItem = fleet.table(
  'compliance_item',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    subjectType: text('subject_type').notNull(),
    subjectRef: uuid('subject_ref').notNull(),
    itemType: text('item_type').notNull(),
    status: complianceItemStatusEnum('status').notNull().default('Valid'),
    expiryDate: date('expiry_date'),
    nextAlertAt: timestamp('next_alert_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('compliance_item_subject_idx').on(t.subjectType, t.subjectRef),
    index('compliance_item_expiry_idx').on(t.expiryDate).where(sql`${t.status} <> 'Expired'`),
    index('compliance_item_next_alert_idx').on(t.nextAlertAt),
  ],
);

/** Append-only record of every eligibility check — the "why was it allowed/denied" trail. */
export const eligibilityEvaluation = fleet.table(
  'eligibility_evaluation',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    driverPersonId: uuid('driver_person_id').notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    decision: text('decision').notNull(),
    reasons: text('reasons').array(),
    policyVersion: text('policy_version'),
    dataAsOf: timestamp('data_as_of', { withTimezone: true }),
    evaluatedAtUtc: timestamp('evaluated_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('eligibility_evaluation_driver_idx').on(t.driverPersonId, t.evaluatedAtUtc)],
);

/**
 * Platform-wide access block (e.g. overdue black-point transfer). While active,
 * the person is blocked from booking / using / accessing any vehicle service.
 */
export const accessBlock = fleet.table(
  'access_block',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    personId: uuid('person_id').notNull().references(() => person.id),
    reason: text('reason').notNull(),
    active: boolean('active').notNull().default(true),
    blockedAtUtc: timestamp('blocked_at_utc', { withTimezone: true }).notNull().defaultNow(),
    liftedAtUtc: timestamp('lifted_at_utc', { withTimezone: true }),
  },
  (t) => [index('access_block_person_idx').on(t.personId, t.active)],
);
