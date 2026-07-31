import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
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
import { hierarchyNode, person } from './platform.schema';
import { vehicle } from './vehicle.schema';

/** A handover record advances Handover → Returned (one per booking). */
export const handoverPhaseEnum = pgEnum('fleet_handover_phase', ['Handover', 'Returned']);
/** A damage pin is pre-existing at handover or newly recorded. */
export const damageStateEnum = pgEnum('fleet_damage_state', ['existing', 'new']);
/** Key set custody transition. */
export const keyCustodyEnum = pgEnum('fleet_key_custody', ['Issued', 'Returned', 'Lost', 'Recovered', 'Replaced']);

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
    revision: integer('revision').notNull().default(1),
    handoverAtUtc: timestamp('handover_at_utc', { withTimezone: true }).notNull().defaultNow(),
    startOdometer: numeric('start_odometer', { precision: 12, scale: 1 }),
    startFuelEighths: integer('start_fuel_eighths'),
    gpsStatus: text('gps_status'),
    keyIssueRef: text('key_issue_ref'),
    handoverSignatureRef: text('handover_signature_ref'),
    checklist: jsonb('checklist'),
    checklistDefinitionVersion: integer('checklist_definition_version'),
    releaseLocationNodeId: uuid('release_location_node_id').references(() => hierarchyNode.id),
    releaseLocationCode: text('release_location_code'),
    releaseLocationName: text('release_location_name'),
    offlineCaptured: boolean('offline_captured').notNull().default(false),
    returnAtUtc: timestamp('return_at_utc', { withTimezone: true }),
    endOdometer: numeric('end_odometer', { precision: 12, scale: 1 }),
    endFuelEighths: integer('end_fuel_eighths'),
    returnCondition: text('return_condition'),
    returnConditionCode: text('return_condition_code'),
    returnLocationNodeId: uuid('return_location_node_id').references(() => hierarchyNode.id),
    returnLocationCode: text('return_location_code'),
    returnLocationName: text('return_location_name'),
    keyReturnRef: text('key_return_ref'),
    keyOutcome: text('key_outcome'),
    keyReviewRef: text('key_review_ref'),
    returnSignatureRef: text('return_signature_ref'),
    expectedFuelConsumedLitres: numeric('expected_fuel_consumed_litres', { precision: 10, scale: 2 }),
    actualFuelConsumedLitres: numeric('actual_fuel_consumed_litres', { precision: 10, scale: 2 }),
    fuelDeviationPercent: numeric('fuel_deviation_percent', { precision: 6, scale: 2 }),
    fuelDeviationFlagged: boolean('fuel_deviation_flagged').notNull().default(false),
    odometerConflict: boolean('odometer_conflict').notNull().default(false),
    telematicsOdometer: numeric('telematics_odometer', { precision: 12, scale: 1 }),
    telematicsStatus: text('telematics_status'),
    telematicsObservedAtUtc: timestamp('telematics_observed_at_utc', { withTimezone: true }),
    reconciliationStatus: text('reconciliation_status'),
    reconciliationProvenance: jsonb('reconciliation_provenance'),
    lateReturn: boolean('late_return').notNull().default(false),
    evidenceCompleteness: text('evidence_completeness').notNull().default('LegacyPartial'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('handover_booking_uq').on(t.bookingId),
    index('handover_vehicle_idx').on(t.vehicleId),
    index('handover_org_activity_idx').on(t.organizationId, t.returnAtUtc, t.handoverAtUtc),
    check('handover_revision_positive', sql`${t.revision} > 0`),
    check('handover_return_condition_code_valid', sql`${t.returnConditionCode} IS NULL OR ${t.returnConditionCode} IN ('Good', 'MinorWear', 'DamageNoted')`),
    check('handover_key_outcome_valid', sql`${t.keyOutcome} IS NULL OR ${t.keyOutcome} IN ('Returned', 'LostReviewRequired')`),
    check('handover_telematics_status_valid', sql`${t.telematicsStatus} IS NULL OR ${t.telematicsStatus} IN ('MATCHED', 'STALE', 'UNAVAILABLE')`),
    check('handover_reconciliation_status_valid', sql`${t.reconciliationStatus} IS NULL OR ${t.reconciliationStatus} IN ('MATCHED', 'ADVISORY', 'CONFLICT', 'UNAVAILABLE')`),
    check('handover_evidence_completeness_valid', sql`${t.evidenceCompleteness} IN ('Complete', 'LegacyPartial')`),
  ],
);

/** Versioned immutable PASS/FAIL evidence for each capture phase checklist. */
export const handoverInspectionItem = fleet.table(
  'handover_inspection_item',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    handoverId: uuid('handover_id').notNull().references(() => handover.id),
    capturePhase: text('capture_phase').notNull(),
    definitionVersion: integer('definition_version').notNull(),
    itemCode: text('item_code').notNull(),
    verdict: text('verdict').notNull(),
    note: text('note'),
    evidenceRefs: text('evidence_refs').array().notNull().default(sql`'{}'::text[]`),
    capturedByPersonId: uuid('captured_by_person_id').references(() => person.id),
    capturedAtUtc: timestamp('captured_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('handover_inspection_item_uq').on(t.handoverId, t.capturePhase, t.itemCode),
    index('handover_inspection_handover_idx').on(t.handoverId, t.capturePhase, t.itemCode),
    check('handover_inspection_phase_valid', sql`${t.capturePhase} IN ('Handover', 'Return')`),
    check('handover_inspection_item_code_valid', sql`${t.itemCode} IN ('body', 'tyres', 'lights', 'assets', 'cabin')`),
    check('handover_inspection_verdict_valid', sql`${t.verdict} IN ('Pass', 'Fail')`),
    check('handover_inspection_definition_positive', sql`${t.definitionVersion} > 0`),
    check('handover_inspection_fail_evidence', sql`${t.verdict} = 'Pass' OR (NULLIF(btrim(${t.note}), '') IS NOT NULL AND cardinality(${t.evidenceRefs}) > 0)`),
  ],
);

/** Organization-owned staged or claimed private Handover evidence metadata. */
export const handoverEvidence = fleet.table(
  'handover_evidence',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    uploadedByPersonId: uuid('uploaded_by_person_id').notNull().references(() => person.id),
    handoverId: uuid('handover_id').references(() => handover.id),
    evidenceType: text('evidence_type').notNull(),
    status: text('status').notNull().default('Staged'),
    objectKey: text('object_key').notNull(),
    contentSha256: text('content_sha256').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    signerPersonId: uuid('signer_person_id').references(() => person.id),
    capturedByPersonId: uuid('captured_by_person_id').references(() => person.id),
    deviceRef: text('device_ref'),
    stagedAtUtc: timestamp('staged_at_utc', { withTimezone: true }).notNull().defaultNow(),
    claimedAtUtc: timestamp('claimed_at_utc', { withTimezone: true }),
    expiresAtUtc: timestamp('expires_at_utc', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('handover_evidence_object_key_uq').on(t.objectKey),
    index('handover_evidence_staged_expiry_idx').on(t.organizationId, t.status, t.expiresAtUtc),
    index('handover_evidence_handover_idx').on(t.handoverId, t.evidenceType),
    check('handover_evidence_type_valid', sql`${t.evidenceType} IN ('VehiclePhoto', 'DamagePhoto', 'Signature', 'LegacyReference')`),
    check('handover_evidence_status_valid', sql`${t.status} IN ('Staged', 'Claimed', 'Expired')`),
    check('handover_evidence_hash_valid', sql`${t.contentSha256} ~ '^[0-9a-f]{64}$'`),
    check('handover_evidence_size_valid', sql`${t.sizeBytes} > 0 AND ${t.sizeBytes} <= 10485760`),
  ],
);

/** Insert-only correction evidence layered over immutable custody facts. */
export const handoverAmendment = fleet.table(
  'handover_amendment',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    handoverId: uuid('handover_id').notNull().references(() => handover.id),
    revision: integer('revision').notNull(),
    reason: text('reason').notNull(),
    actorPersonId: uuid('actor_person_id').notNull().references(() => person.id),
    evidenceRefs: text('evidence_refs').array().notNull().default(sql`'{}'::text[]`),
    effectivePatch: jsonb('effective_patch').notNull().default(sql`'{}'::jsonb`),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('handover_amendment_revision_uq').on(t.handoverId, t.revision),
    index('handover_amendment_handover_idx').on(t.handoverId, t.revision),
    check('handover_amendment_revision_positive', sql`${t.revision} > 0`),
    check('handover_amendment_reason_required', sql`NULLIF(btrim(${t.reason}), '') IS NOT NULL`),
  ],
);

/** Durable replay ledger for Fleet Handover open/return commands. */
export const handoverCommandLedger = fleet.table(
  'handover_command_ledger',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    actorPersonId: uuid('actor_person_id').notNull(),
    commandType: text('command_type').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadSha256: text('payload_sha256').notNull(),
    resultHandoverId: uuid('result_handover_id').references(() => handover.id),
    resultBody: jsonb('result_body'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('handover_command_key_uq').on(t.organizationId, t.actorPersonId, t.commandType, t.idempotencyKey),
    index('handover_command_result_idx').on(t.resultHandoverId),
    foreignKey({ columns: [t.organizationId, t.actorPersonId], foreignColumns: [person.organizationId, person.id], name: 'handover_command_actor_org_fk' }),
    check('handover_command_payload_sha256_valid', sql`${t.payloadSha256} ~ '^[0-9a-f]{64}$'`),
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
    carriedFromDamagePinId: uuid('carried_from_damage_pin_id').references((): AnyPgColumn => damagePin.id),
    lifecycleStatus: text('lifecycle_status').notNull().default('Open'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('damage_pin_handover_idx').on(t.handoverId),
    check('damage_pin_lifecycle_status_valid', sql`${t.lifecycleStatus} IN ('Open', 'Repaired', 'Closed')`),
  ],
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
    incidentReason: text('incident_reason'),
    reviewRef: text('review_ref'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('key_log_vehicle_idx').on(t.vehicleId, t.atUtc)],
);
