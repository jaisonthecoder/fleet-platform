import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
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
import { hierarchyNode } from './platform.schema';

/**
 * How a vendor record is mastered (S1, plug-and-play). `Manual` = the record is
 * entered and owned in-app (the default; covers "app feature/module" and
 * "manual entry" adoption). `Integrated` = the record is mastered by an external
 * system (e.g. procurement/Fusion) and only mirrored here — writes are gated to
 * the sync provider. External integration itself is **future scope**; the enum
 * and gating exist now so integrated records can coexist without a schema change.
 */
export const vendorSourceModeEnum = pgEnum('fleet_vendor_source_mode', [
  'Manual',
  'Integrated',
]);

/**
 * Vendor lifecycle (S1). Admins configure the record (`Draft` → `PendingApproval`);
 * a separate authority (Procurement) approves it to `Active` (SoD). `Suspended`
 * is set automatically when a required document (trade licence / insurance)
 * expires; `Retired` ends the relationship.
 */
export const vendorStatusEnum = pgEnum('fleet_vendor_status', [
  'Draft',
  'PendingApproval',
  'Active',
  'Suspended',
  'Retired',
]);

/** Lease-contract lifecycle (S2), used to drive renewal alert ladders. */
export const leaseContractStatusEnum = pgEnum('fleet_lease_contract_status', [
  'Active',
  'ExpiringSoon',
  'Suspended',
  'Expired',
  'Renewed',
  'Terminated',
]);

/** Version lifecycle for manually captured Vendor compliance evidence. */
export const vendorDocumentStatusEnum = pgEnum('fleet_vendor_document_status', [
  'Uploaded',
  'PendingConfirmation',
  'Confirmed',
  'Superseded',
  'Rejected',
]);

/**
 * The governed vendor master (S1). Configurable classification (`categoryCode`)
 * is a lookup code (ADR-009), never an enum. Sensitive banking data is stored
 * masked; the source seam (`sourceMode`/`externalRef`) makes the module
 * plug-and-play across manual, native and (future) integrated organizations.
 */
export const vendor = fleet.table(
  'vendor',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    // Identity
    legalName: text('legal_name').notNull(),
    tradeName: text('trade_name'),
    tradeLicenceNumber: text('trade_licence_number'),
    tradeLicenceEmirate: text('trade_licence_emirate'),
    taxRegistrationNumber: text('tax_registration_number'),
    categoryCode: text('category_code').notNull(),
    // Contact
    primaryContactName: text('primary_contact_name'),
    primaryContactRole: text('primary_contact_role'),
    primaryContactEmail: text('primary_contact_email'),
    primaryContactPhone: text('primary_contact_phone'),
    // Commercial
    paymentTerms: text('payment_terms'),
    currency: text('currency').notNull().default('AED'),
    bankIbanMasked: text('bank_iban_masked'),
    // Source seam (plug-and-play)
    sourceMode: vendorSourceModeEnum('source_mode').notNull().default('Manual'),
    sourceSystem: text('source_system'),
    externalRef: text('external_ref'),
    dataQualityFlag: boolean('data_quality_flag').notNull().default(false),
    vendorPortalEnabled: boolean('vendor_portal_enabled')
      .notNull()
      .default(false),
    // Lifecycle
    status: vendorStatusEnum('status').notNull().default('Draft'),
    createdByActorRef: text('created_by_actor_ref').notNull(),
    submittedByActorRef: text('submitted_by_actor_ref'),
    submittedAtUtc: timestamp('submitted_at_utc', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vendor_trade_licence_uq')
      .on(t.organizationId, t.tradeLicenceNumber)
      .where(sql`${t.tradeLicenceNumber} IS NOT NULL`),
    uniqueIndex('vendor_external_ref_uq')
      .on(t.organizationId, t.sourceSystem, t.externalRef)
      .where(sql`${t.externalRef} IS NOT NULL`),
    uniqueIndex('vendor_organization_id_id_uq').on(t.organizationId, t.id),
    index('vendor_category_idx').on(t.categoryCode),
    index('vendor_status_idx').on(t.status),
    index('vendor_source_mode_idx').on(t.sourceMode),
  ],
);

/** Reusable Vendor defaults captured by the onboarding wizard, separate from lease instances. */
export const vendorOnboardingProfile = fleet.table(
  'vendor_onboarding_profile',
  {
    vendorId: uuid('vendor_id').primaryKey(),
    organizationId: orgId(),
    standardOffHireNoticeDays: integer('standard_off_hire_notice_days'),
    earlyTerminationPenalty: text('early_termination_penalty'),
    renewalOptions: text('renewal_options'),
    escalationClause: text('escalation_clause'),
    replacementClause: text('replacement_clause'),
    alertLadder: text('alert_ladder'),
    accessMode: text('access_mode').notNull().default('ManualInternal'),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.vendorId],
      foreignColumns: [vendor.organizationId, vendor.id],
      name: 'vendor_onboarding_profile_vendor_org_fk',
    }),
    uniqueIndex('vendor_onboarding_profile_org_vendor_uq').on(
      t.organizationId,
      t.vendorId,
    ),
    check(
      'vendor_onboarding_profile_notice_days_valid',
      sql`${t.standardOffHireNoticeDays} IS NULL OR ${t.standardOffHireNoticeDays} >= 0`,
    ),
    check(
      'vendor_onboarding_profile_access_mode_valid',
      sql`${t.accessMode} = 'ManualInternal'`,
    ),
  ],
);

/**
 * A lease contract held with a lessor vendor (S2). Monetary fields are
 * `numeric(14,2)` (returned as strings). `alertLadder` records the renewal
 * reminder cadence (e.g. `90/60/30`) for the expiry escalation job.
 */
export const leaseContract = fleet.table(
  'lease_contract',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vendorId: uuid('vendor_id').notNull(),
    contractRef: text('contract_ref').notNull(),
    scopeNodeId: uuid('scope_node_id').references(() => hierarchyNode.id),
    monthlyAmount: numeric('monthly_amount', { precision: 14, scale: 2 }),
    currency: text('currency').notNull().default('AED'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    offHireNoticeDays: numeric('off_hire_notice_days', {
      precision: 5,
      scale: 0,
    }),
    earlyTerminationPenalty: text('early_termination_penalty'),
    renewalOptions: text('renewal_options'),
    escalationClause: text('escalation_clause'),
    replacementClause: text('replacement_clause'),
    alertLadder: text('alert_ladder').notNull().default('90/60/30'),
    status: leaseContractStatusEnum('status').notNull().default('Active'),
    renewedIntoContractRef: text('renewed_into_contract_ref'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('lease_contract_ref_uq').on(t.organizationId, t.contractRef),
    uniqueIndex('lease_contract_organization_id_id_uq').on(
      t.organizationId,
      t.id,
    ),
    foreignKey({
      columns: [t.organizationId, t.vendorId],
      foreignColumns: [vendor.organizationId, vendor.id],
      name: 'lease_contract_vendor_org_fk',
    }),
    index('lease_contract_vendor_idx').on(t.vendorId),
    index('lease_contract_end_date_idx').on(t.endDate),
    index('lease_contract_status_idx').on(t.status),
  ],
);

/** Immutable, versioned Vendor evidence; confirmed versions are superseded, never overwritten. */
export const vendorDocument = fleet.table(
  'vendor_document',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vendorId: uuid('vendor_id').notNull(),
    documentTypeCode: text('document_type_code').notNull(),
    version: integer('version').notNull(),
    documentReference: text('document_reference'),
    blobRef: text('blob_ref').notNull(),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    status: vendorDocumentStatusEnum('status')
      .notNull()
      .default('PendingConfirmation'),
    extractedMetadata: jsonb('extracted_metadata'),
    confirmedMetadata: jsonb('confirmed_metadata'),
    confirmedByActorRef: text('confirmed_by_actor_ref'),
    confirmedAtUtc: timestamp('confirmed_at_utc', { withTimezone: true }),
    supersededById: uuid('superseded_by_id').references(
      (): AnyPgColumn => vendorDocument.id,
    ),
    createdByActorRef: text('created_by_actor_ref').notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      columns: [t.organizationId, t.vendorId],
      foreignColumns: [vendor.organizationId, vendor.id],
      name: 'vendor_document_vendor_org_fk',
    }),
    uniqueIndex('vendor_document_version_uq').on(
      t.organizationId,
      t.vendorId,
      t.documentTypeCode,
      t.version,
    ),
    uniqueIndex('vendor_document_current_confirmed_uq')
      .on(t.organizationId, t.vendorId, t.documentTypeCode)
      .where(sql`${t.status} = 'Confirmed'`),
    uniqueIndex('vendor_document_pending_uq')
      .on(t.organizationId, t.vendorId, t.documentTypeCode)
      .where(sql`${t.status} IN ('Uploaded', 'PendingConfirmation')`),
    index('vendor_document_vendor_idx').on(
      t.organizationId,
      t.vendorId,
      t.documentTypeCode,
      t.version,
    ),
    index('vendor_document_expiry_idx')
      .on(t.expiryDate)
      .where(sql`${t.status} = 'Confirmed'`),
    check(
      'vendor_document_issue_expiry_valid',
      sql`${t.issueDate} IS NULL OR ${t.expiryDate} IS NULL OR ${t.expiryDate} >= ${t.issueDate}`,
    ),
    check(
      'vendor_document_confirmation_complete',
      sql`${t.status} <> 'Confirmed' OR (${t.confirmedByActorRef} IS NOT NULL AND ${t.confirmedAtUtc} IS NOT NULL)`,
    ),
  ],
);
