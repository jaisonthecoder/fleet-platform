import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  numeric,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { fleet, orgId, timestamps } from './_shared';
import { vehicle } from './vehicle.schema';

/**
 * Canonical telemetry (TimescaleDB hypertable, partitioned by time). Written by
 * `telematics-ingest` via batched inserts; no FK to vehicle (high-write path).
 */
export const telemetry = fleet.table(
  'telemetry',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    vehicleId: uuid('vehicle_id').notNull(),
    deviceId: text('device_id'),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    speed: doublePrecision('speed'),
    ignition: boolean('ignition'),
    odometer: doublePrecision('odometer'),
    fuelLevel: doublePrecision('fuel_level'),
    dtcCodes: text('dtc_codes').array(),
    deviceHealth: jsonb('device_health'),
  },
  (t) => [index('telemetry_vehicle_time_idx').on(t.vehicleId, t.time)],
);

export const deviceStatusEnum = pgEnum('fleet_device_status', [
  'Registered',
  'Active',
  'Faulty',
  'UnderReplacement',
  'Retired',
]);

export const telematicsAlertTypeEnum = pgEnum('fleet_telematics_alert_type', [
  'Unplug',
  'Tamper',
  'DeviceSilent',
]);

/** GPS tracker device — independent of the vehicle (survives transfers/off-hires). */
export const device = fleet.table(
  'device',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    identifier: text('identifier').notNull(),
    model: text('model'),
    firmware: text('firmware'),
    sim: text('sim'),
    status: deviceStatusEnum('status').notNull().default('Registered'),
    lastHealthAt: timestamp('last_health_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('device_identifier_uq').on(t.identifier)],
);

/**
 * Effective-dated device↔vehicle pairing (a tracker moves between vehicles). A
 * `btree_gist` EXCLUDE (hand-authored SQL) prevents a device being actively
 * paired to two vehicles at once.
 */
export const devicePairing = fleet.table(
  'device_pairing',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    deviceId: uuid('device_id').notNull().references(() => device.id),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('device_pairing_device_idx').on(t.deviceId),
    index('device_pairing_vehicle_idx').on(t.vehicleId),
  ],
);

/** A derived trip. `booking_id` is nullable (no FK) — attached to a booking later. */
export const trip = fleet.table(
  'trip',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    deviceId: uuid('device_id').references(() => device.id),
    bookingId: uuid('booking_id'),
    driverPersonId: uuid('driver_person_id'),
    attributionBasis: text('attribution_basis'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    distanceKm: numeric('distance_km', { precision: 10, scale: 2 }),
    startOdometer: numeric('start_odometer', { precision: 12, scale: 1 }),
    endOdometer: numeric('end_odometer', { precision: 12, scale: 1 }),
    ...timestamps(),
  },
  (t) => [
    index('trip_vehicle_idx').on(t.vehicleId, t.startedAt),
    index('trip_booking_idx').on(t.bookingId),
  ],
);

/** Unplug / tamper / device-silent alert. */
export const telematicsAlert = fleet.table(
  'telematics_alert',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').references(() => vehicle.id),
    deviceId: uuid('device_id').references(() => device.id),
    alertType: telematicsAlertTypeEnum('alert_type').notNull(),
    detail: text('detail'),
    raisedAt: timestamp('raised_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (t) => [index('telematics_alert_vehicle_idx').on(t.vehicleId, t.raisedAt)],
);
