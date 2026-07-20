import { sql } from 'drizzle-orm';
import { index, integer, numeric, pgEnum, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { booking } from './booking.schema';
import { person } from './platform.schema';
import { vehicle } from './vehicle.schema';

export const fineStatusEnum = pgEnum('fleet_fine_status', ['Recorded', 'Attributed', 'Disputed', 'Recovered', 'Closed']);
export const blackPointStatusEnum = pgEnum('fleet_black_point_status', ['Open', 'Transferred', 'Overdue']);

/**
 * A traffic fine (C7 / M8). Auto-attributed to the booking-active driver, else
 * the assigned driver, honouring substitution windows; `attribution_basis`
 * records how (auditable). `booking_id` is nullable (a fine may have no booking).
 * Money is `numeric(14,2)` + currency — never floats.
 */
export const fine = fleet.table(
  'fine',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    bookingId: uuid('booking_id').references(() => booking.id),
    attributedPersonId: uuid('attributed_person_id').references(() => person.id),
    attributionBasis: text('attribution_basis').notNull(),
    eventTimeUtc: timestamp('event_time_utc', { withTimezone: true }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('AED'),
    authority: text('authority').notNull(),
    externalRef: text('external_ref'),
    status: fineStatusEnum('status').notNull().default('Recorded'),
    points: integer('points').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('fine_vehicle_idx').on(t.vehicleId, t.eventTimeUtc),
    index('fine_attributed_person_idx').on(t.attributedPersonId, t.eventTimeUtc),
  ],
);

/** Black points arising from a fine; overdue transfer blocks the driver platform-wide. */
export const blackPoint = fleet.table(
  'black_point',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    subjectPersonId: uuid('subject_person_id').notNull().references(() => person.id),
    fineId: uuid('fine_id').references(() => fine.id),
    points: integer('points').notNull(),
    transferDeadline: timestamp('transfer_deadline', { withTimezone: true }),
    transferStatus: blackPointStatusEnum('transfer_status').notNull().default('Open'),
    ...timestamps(),
  },
  (t) => [index('black_point_subject_idx').on(t.subjectPersonId, t.transferStatus)],
);

/** Accidents register (auto-attributed like fines). */
export const accident = fleet.table(
  'accident',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    bookingId: uuid('booking_id').references(() => booking.id),
    attributedPersonId: uuid('attributed_person_id').references(() => person.id),
    attributionBasis: text('attribution_basis').notNull(),
    occurredAtUtc: timestamp('occurred_at_utc', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    severity: text('severity'),
    status: text('status').notNull().default('Open'),
    ...timestamps(),
  },
  (t) => [index('accident_vehicle_idx').on(t.vehicleId, t.occurredAtUtc)],
);

/** Minimal recovery instruction record (payroll export is Phase 2 / D13). */
export const recoveryRecord = fleet.table(
  'recovery_record',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    fineId: uuid('fine_id').notNull().references(() => fine.id),
    personId: uuid('person_id').references(() => person.id),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('AED'),
    status: text('status').notNull().default('Pending'),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [index('recovery_record_fine_idx').on(t.fineId)],
);

/**
 * Substitution attribution model — live in Phase 1 (UI is Phase 2). A fine whose
 * event time falls in an active window attributes to the substitute driver
 * (FR-SUB-01/02). Boundary is [start, end) — inclusive start, exclusive end.
 */
export const substitutionWindow = fleet.table(
  'substitution_window',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    substitutePersonId: uuid('substitute_person_id').notNull().references(() => person.id),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    reason: text('reason'),
    ...timestamps(),
  },
  (t) => [index('substitution_window_vehicle_idx').on(t.vehicleId, t.windowStart)],
);
