import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { booking } from './booking.schema';
import { person } from './platform.schema';
import { vehicle } from './vehicle.schema';

/** A handover record advances Handover → Returned (one per booking). */
export const handoverPhaseEnum = pgEnum('fleet_handover_phase', ['Handover', 'Returned']);
/** A damage pin is pre-existing at handover or newly recorded. */
export const damageStateEnum = pgEnum('fleet_damage_state', ['existing', 'new']);
/** Key set custody transition. */
export const keyCustodyEnum = pgEnum('fleet_key_custody', ['Issued', 'Returned']);

/**
 * Vehicle handover & return (C4 / M6). One row per booking captures the pickup
 * facts and, on return, the reconciliation. Fuel deviation is **advisory**
 * (PDP `fuel-deviation-threshold`); the odometer conflict flag records that the
 * manual reading disagreed with the telematics system of record (FR-HAND-11) —
 * telematics is never overwritten. `offline_captured` supports degraded-mode
 * field capture (Phase-2 sync).
 */
export const handover = fleet.table(
  'handover',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    bookingId: uuid('booking_id').notNull().references(() => booking.id),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    driverPersonId: uuid('driver_person_id').notNull().references(() => person.id),
    phase: handoverPhaseEnum('phase').notNull().default('Handover'),
    handoverAtUtc: timestamp('handover_at_utc', { withTimezone: true }).notNull().defaultNow(),
    startOdometer: numeric('start_odometer', { precision: 12, scale: 1 }),
    startFuelEighths: integer('start_fuel_eighths'),
    gpsStatus: text('gps_status'),
    keyIssueRef: text('key_issue_ref'),
    handoverSignatureRef: text('handover_signature_ref'),
    checklist: jsonb('checklist'),
    offlineCaptured: boolean('offline_captured').notNull().default(false),
    returnAtUtc: timestamp('return_at_utc', { withTimezone: true }),
    endOdometer: numeric('end_odometer', { precision: 12, scale: 1 }),
    endFuelEighths: integer('end_fuel_eighths'),
    returnCondition: text('return_condition'),
    keyReturnRef: text('key_return_ref'),
    returnSignatureRef: text('return_signature_ref'),
    expectedFuelConsumedLitres: numeric('expected_fuel_consumed_litres', { precision: 10, scale: 2 }),
    actualFuelConsumedLitres: numeric('actual_fuel_consumed_litres', { precision: 10, scale: 2 }),
    fuelDeviationPercent: numeric('fuel_deviation_percent', { precision: 6, scale: 2 }),
    fuelDeviationFlagged: boolean('fuel_deviation_flagged').notNull().default(false),
    odometerConflict: boolean('odometer_conflict').notNull().default(false),
    telematicsOdometer: numeric('telematics_odometer', { precision: 12, scale: 1 }),
    lateReturn: boolean('late_return').notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('handover_booking_uq').on(t.bookingId),
    index('handover_vehicle_idx').on(t.vehicleId),
  ],
);

/** A damage pin over the template-versioned vehicle diagram (normalized x/y). */
export const damagePin = fleet.table(
  'damage_pin',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    handoverId: uuid('handover_id').notNull().references(() => handover.id),
    x: numeric('x', { precision: 6, scale: 5 }).notNull(),
    y: numeric('y', { precision: 6, scale: 5 }).notNull(),
    region: text('region').notNull(),
    templateVersion: integer('template_version').notNull().default(1),
    photoRef: text('photo_ref'),
    note: text('note'),
    state: damageStateEnum('state').notNull().default('new'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('damage_pin_handover_idx').on(t.handoverId)],
);

/** Key set custody in/out log (C15 link). */
export const keyLog = fleet.table(
  'key_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    handoverId: uuid('handover_id').references(() => handover.id),
    custodyState: keyCustodyEnum('custody_state').notNull(),
    keyRef: text('key_ref'),
    personId: uuid('person_id').references(() => person.id),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('key_log_vehicle_idx').on(t.vehicleId, t.atUtc)],
);
