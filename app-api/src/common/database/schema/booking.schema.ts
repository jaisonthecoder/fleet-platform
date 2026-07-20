import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { person } from './platform.schema';
import { vehicle } from './vehicle.schema';

/** Booking lifecycle. The active subset reserves the vehicle (exclusion). */
export const bookingStatusEnum = pgEnum('fleet_booking_status', [
  'Draft',
  'PendingApproval',
  'Approved',
  'Active',
  'Completed',
  'Declined',
  'Cancelled',
  'Expired',
  'NoShow',
]);

/** Consent lifecycle transitions (signed / voided on decline-or-modify / re-consent). */
export const consentEventEnum = pgEnum('fleet_consent_event', [
  'Signed',
  'Voided',
  'ReConsented',
]);

/**
 * A pool-vehicle booking (C2 / M4). `reservation_start`/`reservation_end` are
 * the PDP-buffer-expanded window used by BOTH availability and the commit — the
 * single source that makes double-booking structurally impossible (P1B-R2-1) —
 * enforced by the hand-authored `booking_no_double_book` `btree_gist` exclusion
 * constraint over the active statuses. The unique `booking_number` is issued
 * only inside the consent transaction (P1B-R2-3), so it is nullable until then.
 */
export const booking = fleet.table(
  'booking',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    bookingNumber: text('booking_number'),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    driverPersonId: uuid('driver_person_id').notNull().references(() => person.id),
    requestedByPersonId: uuid('requested_by_person_id').notNull().references(() => person.id),
    status: bookingStatusEnum('status').notNull().default('Draft'),
    pickupAtUtc: timestamp('pickup_at_utc', { withTimezone: true }).notNull(),
    returnAtUtc: timestamp('return_at_utc', { withTimezone: true }).notNull(),
    reservationStart: timestamp('reservation_start', { withTimezone: true }).notNull(),
    reservationEnd: timestamp('reservation_end', { withTimezone: true }).notNull(),
    bufferMinutes: integer('buffer_minutes').notNull().default(0),
    destination: text('destination'),
    purpose: text('purpose'),
    passengerCount: integer('passenger_count'),
    consentRecordId: uuid('consent_record_id'),
    workflowInstanceId: uuid('workflow_instance_id'),
    policyVersion: text('policy_version'),
    policyProvenance: jsonb('policy_provenance').notNull().default(sql`'{}'::jsonb`),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('booking_number_uq')
      .on(t.bookingNumber)
      .where(sql`${t.bookingNumber} IS NOT NULL`),
    index('booking_vehicle_status_idx').on(t.vehicleId, t.status),
    index('booking_driver_idx').on(t.driverPersonId),
    index('booking_requested_by_idx').on(t.requestedByPersonId),
  ],
);

/** Waitlist when no vehicle is available for a window (FR-BOOK-13). */
export const waitlistEntry = fleet.table(
  'waitlist_entry',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    driverPersonId: uuid('driver_person_id').notNull().references(() => person.id),
    vehicleId: uuid('vehicle_id').references(() => vehicle.id),
    pickupAtUtc: timestamp('pickup_at_utc', { withTimezone: true }).notNull(),
    returnAtUtc: timestamp('return_at_utc', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('Waiting'),
    ...timestamps(),
  },
  (t) => [index('waitlist_driver_idx').on(t.driverPersonId)],
);

/** Append-only log of booking state transitions (FR-BOOK-16). */
export const bookingEvent = fleet.table(
  'booking_event',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    bookingId: uuid('booking_id').notNull().references(() => booking.id),
    eventType: text('event_type').notNull(),
    detail: jsonb('detail'),
    actorRef: text('actor_ref'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('booking_event_booking_idx').on(t.bookingId, t.atUtc)],
);

/**
 * Insert-only pointer to the immutable consent blob (FR-BOOK-07). Binds driver
 * + vehicle + window + the policy version in force; written in the same
 * transaction that issues the booking number (P1B-R2-3).
 */
export const consentRecord = fleet.table(
  'consent_record',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    bookingId: uuid('booking_id').notNull().references(() => booking.id),
    driverPersonId: uuid('driver_person_id').notNull().references(() => person.id),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    vehicleCategoryCode: text('vehicle_category_code'),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    policyVersion: text('policy_version'),
    consentDocumentVersion: text('consent_document_version').notNull(),
    signatureRef: text('signature_ref'),
    employeeId: text('employee_id'),
    ip: text('ip'),
    device: text('device'),
    signedAtUtc: timestamp('signed_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('consent_record_booking_idx').on(t.bookingId)],
);

/** Consent signed / voided (on decline or material change) / re-consent. */
export const consentLifecycleEvent = fleet.table(
  'consent_lifecycle_event',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    bookingId: uuid('booking_id').notNull().references(() => booking.id),
    consentRecordId: uuid('consent_record_id').references(() => consentRecord.id),
    eventType: consentEventEnum('event_type').notNull(),
    reason: text('reason'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('consent_lifecycle_booking_idx').on(t.bookingId, t.atUtc)],
);
