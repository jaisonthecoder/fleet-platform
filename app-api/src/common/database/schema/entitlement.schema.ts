import { sql } from 'drizzle-orm';
import { date, index, jsonb, pgEnum, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { hierarchyNode, person } from './platform.schema';
import { vehicle } from './vehicle.schema';

/** Dedicated-vehicle entitlement lifecycle. */
export const entitlementStatusEnum = pgEnum('fleet_entitlement_status', [
  'Draft',
  'PendingApproval',
  'Approved',
  'Allocated',
  'Declined',
  'Cancelled',
  'Expired',
]);

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
    requesterPersonId: uuid('requester_person_id').notNull().references(() => person.id),
    justificationCategory: text('justification_category').notNull(),
    justificationText: text('justification_text').notNull(),
    vehicleCategoryCode: text('vehicle_category_code'),
    vehicleId: uuid('vehicle_id').references(() => vehicle.id),
    durationStart: date('duration_start'),
    durationEnd: date('duration_end'),
    locationNodeId: uuid('location_node_id').references(() => hierarchyNode.id),
    businessUnit: text('business_unit'),
    costCentre: text('cost_centre'),
    status: entitlementStatusEnum('status').notNull().default('Draft'),
    workflowInstanceId: uuid('workflow_instance_id'),
    policyVersion: text('policy_version'),
    eligibilityResult: jsonb('eligibility_result'),
    consentSignedAtUtc: timestamp('consent_signed_at_utc', { withTimezone: true }),
    consentDocumentVersion: text('consent_document_version'),
    consentSignatureRef: text('consent_signature_ref'),
    allocatedAtUtc: timestamp('allocated_at_utc', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('entitlement_requester_idx').on(t.requesterPersonId),
    index('entitlement_status_idx').on(t.status),
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
    ...timestamps(),
  },
  (t) => [index('bsd_window_entitlement_idx').on(t.entitlementRequestId)],
);
