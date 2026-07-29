import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, jsonb, pgEnum, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { hierarchyNode, person } from './platform.schema';
import { policyRule, policyVersion } from './policy.schema';
import { vehicle } from './vehicle.schema';

/** Dedicated-vehicle entitlement lifecycle. */
export const entitlementStatusEnum = pgEnum('fleet_entitlement_status', [
  'Draft',
  'PendingApproval',
  'ModificationRequested',
  'Approved',
  'AwaitingConsent',
  'Allocated',
  'Returned',
  'Declined',
  'Cancelled',
  'Expired',
]);

/** Short-lived immutable evidence from a configured eligibility preview; creates no hold. */
export const entitlementEligibilityPreview = fleet.table(
  'entitlement_eligibility_preview',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    requesterPersonId: uuid('requester_person_id').notNull(),
    locationNodeId: uuid('location_node_id').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    policyRuleId: uuid('policy_rule_id').notNull().references(() => policyRule.id),
    policyVersionId: uuid('policy_version_id').notNull().references(() => policyVersion.id),
    policyVersion: text('policy_version').notNull(),
    decision: text('decision').notNull(),
    reasons: text('reasons').array().notNull().default(sql`'{}'::text[]`),
    permittedVehicleClasses: text('permitted_vehicle_classes').array().notNull().default(sql`'{}'::text[]`),
    eligibleVehicleIds: uuid('eligible_vehicle_ids').array().notNull().default(sql`'{}'::uuid[]`),
    evaluatedAtUtc: timestamp('evaluated_at_utc', { withTimezone: true }).notNull().defaultNow(),
    expiresAtUtc: timestamp('expires_at_utc', { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.requesterPersonId],
      foreignColumns: [person.organizationId, person.id],
      name: 'entitlement_preview_requester_org_fk',
    }),
    foreignKey({
      columns: [t.organizationId, t.locationNodeId],
      foreignColumns: [hierarchyNode.organizationId, hierarchyNode.id],
      name: 'entitlement_preview_location_org_fk',
    }),
    check('entitlement_preview_request_fingerprint_valid', sql`${t.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
    check('entitlement_preview_decision_valid', sql`${t.decision} IN ('ALLOW', 'DENY')`),
    check('entitlement_preview_expiry_valid', sql`${t.expiresAtUtc} > ${t.evaluatedAtUtc}`),
    index('entitlement_preview_requester_expiry_idx').on(
      t.organizationId,
      t.requesterPersonId,
      t.expiresAtUtc,
    ),
  ],
);

/**
 * A dedicated-vehicle entitlement request (C3 / M5). Eligibility is a PDP
 * pre-check (`dedicated-vehicle-eligibility`, D8); the approval chain culminates
 * at Cluster CEO via the workflow engine (`entitlement-approval-chain`). Driver
 * consent is captured before allocation (no consent ⇒ no allocation).
 */
export const entitlementRequest = fleet.table(
  'entitlement_request',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    requestType: text('request_type').notNull(),
    driverOption: text('driver_option'),
    requesterPersonId: uuid('requester_person_id').notNull().references(() => person.id),
    requestedByPersonId: uuid('requested_by_person_id').notNull().references(() => person.id),
    assignedDriverPersonId: uuid('assigned_driver_person_id').references(() => person.id),
    justificationCategory: text('justification_category').notNull(),
    justificationText: text('justification_text').notNull(),
    vehicleCategoryCode: text('vehicle_category_code'),
    preferredVehicleId: uuid('preferred_vehicle_id').references(() => vehicle.id),
    preferenceNote: text('preference_note'),
    vehicleId: uuid('vehicle_id').references(() => vehicle.id),
    durationStart: date('duration_start'),
    durationEnd: date('duration_end'),
    locationNodeId: uuid('location_node_id').references(() => hierarchyNode.id),
    businessUnit: text('business_unit'),
    costCentre: text('cost_centre'),
    status: entitlementStatusEnum('status').notNull().default('Draft'),
    revision: integer('revision').notNull().default(1),
    workflowInstanceId: uuid('workflow_instance_id'),
    workflowDefinitionVersionId: uuid('workflow_definition_version_id'),
    policyVersion: text('policy_version'),
    eligibilityResult: jsonb('eligibility_result'),
    approvalRouteProvenance: jsonb('approval_route_provenance'),
    eligibilityPreviewId: uuid('eligibility_preview_id').references(
      () => entitlementEligibilityPreview.id,
    ),
    consentSignedAtUtc: timestamp('consent_signed_at_utc', { withTimezone: true }),
    consentDocumentVersion: text('consent_document_version'),
    consentContentHash: text('consent_content_hash'),
    consentSignatureRef: text('consent_signature_ref'),
    allocatedAtUtc: timestamp('allocated_at_utc', { withTimezone: true }),
    renewedFromEntitlementId: uuid('renewed_from_entitlement_id'),
    ...timestamps(),
  },
  (t) => [
    index('entitlement_requester_idx').on(t.requesterPersonId),
    index('entitlement_status_idx').on(t.status),
    index('entitlement_owner_status_idx').on(t.organizationId, t.requesterPersonId, t.status, t.createdAtUtc),
    index('entitlement_scope_status_idx').on(t.organizationId, t.locationNodeId, t.status),
    index('entitlement_preferred_vehicle_idx')
      .on(t.preferredVehicleId)
      .where(sql`${t.preferredVehicleId} IS NOT NULL`),
    index('entitlement_request_eligibility_preview_idx')
      .on(t.eligibilityPreviewId)
      .where(sql`${t.eligibilityPreviewId} IS NOT NULL`),
    foreignKey({
      columns: [t.organizationId, t.requesterPersonId],
      foreignColumns: [person.organizationId, person.id],
      name: 'entitlement_requester_org_fk',
    }),
    foreignKey({ columns: [t.renewedFromEntitlementId], foreignColumns: [t.id], name: 'entitlement_request_renewed_from_fk' }),
    foreignKey({
      columns: [t.organizationId, t.requestedByPersonId],
      foreignColumns: [person.organizationId, person.id],
      name: 'entitlement_requested_by_org_fk',
    }),
    foreignKey({
      columns: [t.organizationId, t.assignedDriverPersonId],
      foreignColumns: [person.organizationId, person.id],
      name: 'entitlement_assigned_driver_org_fk',
    }),
    foreignKey({
      columns: [t.organizationId, t.locationNodeId],
      foreignColumns: [hierarchyNode.organizationId, hierarchyNode.id],
      name: 'entitlement_location_org_fk',
    }),
    foreignKey({
      columns: [t.organizationId, t.preferredVehicleId],
      foreignColumns: [vehicle.organizationId, vehicle.id],
      name: 'entitlement_preferred_vehicle_org_fk',
    }),
    check('entitlement_revision_positive', sql`${t.revision} > 0`),
    check('entitlement_preference_note_length', sql`${t.preferenceNote} IS NULL OR char_length(${t.preferenceNote}) <= 500`),
    check('entitlement_duration_window_valid', sql`${t.durationStart} IS NOT NULL AND ${t.durationEnd} IS NOT NULL AND ${t.durationEnd} >= ${t.durationStart}`),
    check('entitlement_driver_option_valid', sql`${t.driverOption} IS NULL OR ${t.driverOption} IN ('WithDriver', 'WithoutDriver')`),
    check('entitlement_with_driver_requires_driver', sql`${t.driverOption} <> 'WithDriver' OR ${t.assignedDriverPersonId} IS NOT NULL`),
  ],
);

/** Immutable Entitlement lifecycle chronology exposed through owner-safe projections. */
export const entitlementEvent = fleet.table(
  'entitlement_event',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    entitlementRequestId: uuid('entitlement_request_id').notNull().references(() => entitlementRequest.id),
    eventType: text('event_type').notNull(),
    actorPersonId: uuid('actor_person_id'),
    reason: text('reason'),
    detail: jsonb('detail'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('entitlement_event_request_time_idx').on(t.entitlementRequestId, t.atUtc),
    foreignKey({ columns: [t.organizationId, t.actorPersonId], foreignColumns: [person.organizationId, person.id], name: 'entitlement_event_actor_org_fk' }),
  ],
);

/** Durable retry ledger for requester-owned Dedicated Vehicle commands. */
export const entitlementCommandLedger = fleet.table(
  'entitlement_command_ledger',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    actorPersonId: uuid('actor_person_id').notNull(),
    commandType: text('command_type').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadSha256: text('payload_sha256').notNull(),
    resultEntitlementId: uuid('result_entitlement_id').references(() => entitlementRequest.id),
    resultBody: jsonb('result_body'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('entitlement_command_key_uq').on(
      t.organizationId,
      t.actorPersonId,
      t.commandType,
      t.idempotencyKey,
    ),
    index('entitlement_command_result_idx').on(t.resultEntitlementId),
    foreignKey({
      columns: [t.organizationId, t.actorPersonId],
      foreignColumns: [person.organizationId, person.id],
      name: 'entitlement_command_actor_org_fk',
    }),
    check('entitlement_command_payload_sha256_valid', sql`${t.payloadSha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** Immutable effective-range Dedicated Vehicle allocation and qualification evidence. */
export const entitlementAllocation = fleet.table(
  'entitlement_allocation',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    entitlementRequestId: uuid('entitlement_request_id').notNull().references(() => entitlementRequest.id),
    vehicleId: uuid('vehicle_id').notNull(),
    allocatedByPersonId: uuid('allocated_by_person_id').notNull(),
    effectiveStart: date('effective_start').notNull(),
    effectiveEnd: date('effective_end').notNull(),
    status: text('status').notNull().default('Active'),
    preferredVehicleId: uuid('preferred_vehicle_id'),
    preferenceHonoured: boolean('preference_honoured').notNull(),
    varianceReasonCode: text('variance_reason_code'),
    qualificationSnapshot: jsonb('qualification_snapshot').notNull(),
    allocatedAtUtc: timestamp('allocated_at_utc', { withTimezone: true }).notNull().defaultNow(),
    endedAtUtc: timestamp('ended_at_utc', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('entitlement_allocation_active_request_uq').on(t.entitlementRequestId).where(sql`${t.status} = 'Active'`),
    index('entitlement_allocation_vehicle_status_idx').on(t.organizationId, t.vehicleId, t.status),
    foreignKey({ columns: [t.organizationId, t.vehicleId], foreignColumns: [vehicle.organizationId, vehicle.id], name: 'entitlement_allocation_vehicle_org_fk' }),
    foreignKey({ columns: [t.organizationId, t.allocatedByPersonId], foreignColumns: [person.organizationId, person.id], name: 'entitlement_allocation_allocator_org_fk' }),
    foreignKey({ columns: [t.organizationId, t.preferredVehicleId], foreignColumns: [vehicle.organizationId, vehicle.id], name: 'entitlement_allocation_preference_org_fk' }),
    check('entitlement_allocation_window_valid', sql`${t.effectiveEnd} >= ${t.effectiveStart}`),
    check('entitlement_allocation_status_valid', sql`${t.status} IN ('Active', 'Returned', 'Cancelled', 'Expired')`),
  ],
);

/** BSD (leave) window during which a dedicated vehicle returns to the pool (auto-revert). */
export const bsdReturnWindow = fleet.table(
  'bsd_return_window',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    entitlementRequestId: uuid('entitlement_request_id').notNull().references(() => entitlementRequest.id),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    reason: text('reason'),
    status: text('status').notNull().default('Proposed'),
    confirmedByPersonId: uuid('confirmed_by_person_id'),
    confirmedAtUtc: timestamp('confirmed_at_utc', { withTimezone: true }),
    activatedAtUtc: timestamp('activated_at_utc', { withTimezone: true }),
    completedAtUtc: timestamp('completed_at_utc', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('bsd_window_entitlement_idx').on(t.entitlementRequestId),
    foreignKey({ columns: [t.organizationId, t.confirmedByPersonId], foreignColumns: [person.organizationId, person.id], name: 'bsd_window_confirmer_org_fk' }),
  ],
);
