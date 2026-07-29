import { z } from 'zod';

/** How a vendor record is mastered (plug-and-play seam, S1). */
export const vendorSourceModeSchema = z.enum(['Manual', 'Integrated']);
export type VendorSourceMode = z.infer<typeof vendorSourceModeSchema>;

/** Vendor lifecycle (S1). */
export const vendorStatusSchema = z.enum([
  'Draft',
  'PendingApproval',
  'Active',
  'Suspended',
  'Retired',
]);
export type VendorStatus = z.infer<typeof vendorStatusSchema>;

/** Lease-contract lifecycle (S2). */
export const leaseContractStatusSchema = z.enum([
  'Active',
  'ExpiringSoon',
  'Suspended',
  'Expired',
  'Renewed',
  'Terminated',
]);
export type LeaseContractStatus = z.infer<typeof leaseContractStatusSchema>;

/** Vendor document version lifecycle (VENDOR-1). */
export const vendorDocumentStatusSchema = z.enum([
  'Uploaded',
  'PendingConfirmation',
  'Confirmed',
  'Superseded',
  'Rejected',
]);
export type VendorDocumentStatus = z.infer<typeof vendorDocumentStatusSchema>;

/** Machine-readable domain reasons surfaced in problem-detail responses. */
export const VENDOR_REASON = {
  notFound: 'vendor-not-found',
  leaseNotFound: 'lease-contract-not-found',
  notDraft: 'vendor-not-draft',
  notPendingApproval: 'vendor-not-pending-approval',
  terminal: 'vendor-already-terminal',
  integratedReadOnly: 'vendor-integrated-record-read-only',
  integrationFutureScope: 'vendor-integration-future-scope',
  categoryInvalid: 'vendor-category-invalid',
  leaseVendorNotActive: 'lease-contract-vendor-not-active',
  leaseNotUsable: 'lease-contract-not-usable',
  leaseVendorMismatch: 'lease-contract-vendor-mismatch',
  selfApproval: 'vendor-self-approval-forbidden',
  documentNotFound: 'vendor-document-not-found',
  documentTypeInvalid: 'vendor-document-type-invalid',
  documentVersionConflict: 'vendor-document-version-conflict',
  documentInvalidDateRange: 'vendor-document-invalid-date-range',
  documentInvalidTransition: 'vendor-document-invalid-transition',
  documentStorageRefInvalid: 'vendor-document-storage-ref-invalid',
  activationEvidenceIncomplete: 'vendor-activation-evidence-incomplete',
} as const;

/** Money as a string to avoid float drift (numeric(14,2) in the DB). */
const money = z.union([z.number(), z.string()]).transform((v) => String(v));

/**
 * Create a vendor. Defaults to `Manual` source (app-owned entry). An
 * `Integrated` record carries `externalRef` and is flagged for steward
 * verification until confirmed; external sync itself is future scope.
 */
export const createVendorSchema = z
  .object({
    legalName: z.string().min(1),
    tradeName: z.string().optional(),
    tradeLicenceNumber: z.string().optional(),
    tradeLicenceEmirate: z.string().optional(),
    taxRegistrationNumber: z.string().optional(),
    categoryCode: z.string().min(1),
    primaryContactName: z.string().optional(),
    primaryContactRole: z.string().optional(),
    primaryContactEmail: z.string().email().optional(),
    primaryContactPhone: z.string().optional(),
    paymentTerms: z.string().optional(),
    currency: z.string().length(3).optional(),
    bankIban: z.string().optional(),
    sourceMode: vendorSourceModeSchema.optional(),
    sourceSystem: z.string().optional(),
    externalRef: z.string().optional(),
    vendorPortalEnabled: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.sourceMode !== 'Integrated' || Boolean(v.externalRef), {
    message: 'externalRef is required when sourceMode is Integrated',
    path: ['externalRef'],
  });
export type CreateVendor = z.infer<typeof createVendorSchema>;

/** Patch a vendor's mutable attributes (Manual records only). */
export const updateVendorSchema = z.object({
  legalName: z.string().min(1).optional(),
  tradeName: z.string().optional(),
  tradeLicenceNumber: z.string().optional(),
  tradeLicenceEmirate: z.string().optional(),
  taxRegistrationNumber: z.string().optional(),
  categoryCode: z.string().min(1).optional(),
  primaryContactName: z.string().optional(),
  primaryContactRole: z.string().optional(),
  primaryContactEmail: z.string().email().optional(),
  primaryContactPhone: z.string().optional(),
  paymentTerms: z.string().optional(),
  currency: z.string().length(3).optional(),
  bankIban: z.string().optional(),
  vendorPortalEnabled: z.boolean().optional(),
  notes: z.string().optional(),
});
export type UpdateVendor = z.infer<typeof updateVendorSchema>;

/** Persists reusable default terms and the currently supported internal access mode. */
export const updateVendorOnboardingProfileSchema = z
  .object({
    standardOffHireNoticeDays: z.number().int().nonnegative().nullable().optional(),
    earlyTerminationPenalty: z.string().max(500).nullable().optional(),
    renewalOptions: z.string().max(500).nullable().optional(),
    escalationClause: z.string().max(500).nullable().optional(),
    replacementClause: z.string().max(500).nullable().optional(),
    alertLadder: z.string().max(100).nullable().optional(),
    accessMode: z.literal('ManualInternal').optional(),
  })
  .strict();
export type UpdateVendorOnboardingProfile = z.infer<
  typeof updateVendorOnboardingProfileSchema
>;

/** Lifecycle action body (submit/approve/reject/suspend/reactivate/retire). */
export const vendorActionSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type VendorAction = z.infer<typeof vendorActionSchema>;

/** A request-change decision must carry an actionable reason for the maker. */
export const vendorRequestChangeSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type VendorRequestChange = z.infer<typeof vendorRequestChangeSchema>;

const documentMetadataSchema = z.record(z.string(), z.unknown());
const vendorDocumentBlobRefSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(
    /^vendor-documents\/[A-Za-z0-9][A-Za-z0-9._/-]*$/,
    'blobRef must be an approved vendor-documents object key',
  )
  .refine((value) => !value.includes('..') && !value.includes('//'), {
    message: 'blobRef must not contain traversal or empty path segments',
  });

/** Captures one new immutable Vendor document version. */
export const createVendorDocumentSchema = z
  .object({
    documentTypeCode: z.string().min(1),
    documentReference: z.string().optional(),
    blobRef: vendorDocumentBlobRefSchema,
    issueDate: z.string().optional(),
    expiryDate: z.string().optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.issueDate ||
      !value.expiryDate ||
      value.expiryDate >= value.issueDate,
    {
      message: VENDOR_REASON.documentInvalidDateRange,
      path: ['expiryDate'],
    },
  );
export type CreateVendorDocument = z.infer<typeof createVendorDocumentSchema>;

/** Human-confirmed metadata and optional corrections for a pending version. */
export const confirmVendorDocumentSchema = z
  .object({
    documentReference: z.string().optional(),
    issueDate: z.string().nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    confirmedMetadata: documentMetadataSchema.optional(),
  })
  .refine(
    (value) =>
      !value.issueDate ||
      !value.expiryDate ||
      value.expiryDate >= value.issueDate,
    {
      message: VENDOR_REASON.documentInvalidDateRange,
      path: ['expiryDate'],
    },
  );
export type ConfirmVendorDocument = z.infer<typeof confirmVendorDocumentSchema>;

/** Reason required when rejecting a pending document version. */
export const rejectVendorDocumentSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RejectVendorDocument = z.infer<typeof rejectVendorDocumentSchema>;

/** Create a lease contract for a vendor (S2). */
export const createLeaseContractSchema = z.object({
  vendorId: z.string().uuid(),
  contractRef: z.string().min(1),
  scopeNodeId: z.string().uuid().optional(),
  monthlyAmount: money.optional(),
  currency: z.string().length(3).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  offHireNoticeDays: z.number().int().nonnegative().optional(),
  earlyTerminationPenalty: z.string().optional(),
  renewalOptions: z.string().optional(),
  escalationClause: z.string().optional(),
  replacementClause: z.string().optional(),
  alertLadder: z.string().optional(),
});
export type CreateLeaseContract = z.infer<typeof createLeaseContractSchema>;

/** Patch a lease contract's mutable attributes. */
export const updateLeaseContractSchema = z.object({
  scopeNodeId: z.string().uuid().nullable().optional(),
  monthlyAmount: money.optional(),
  currency: z.string().length(3).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  offHireNoticeDays: z.number().int().nonnegative().optional(),
  earlyTerminationPenalty: z.string().optional(),
  renewalOptions: z.string().optional(),
  escalationClause: z.string().optional(),
  replacementClause: z.string().optional(),
  alertLadder: z.string().optional(),
  status: leaseContractStatusSchema.optional(),
  renewedIntoContractRef: z.string().optional(),
});
export type UpdateLeaseContract = z.infer<typeof updateLeaseContractSchema>;

/** Vendor response projection. Banking data is returned masked only. */
export interface VendorDto {
  id: string;
  legalName: string;
  tradeName: string | null;
  tradeLicenceNumber: string | null;
  tradeLicenceEmirate: string | null;
  taxRegistrationNumber: string | null;
  categoryCode: string;
  primaryContactName: string | null;
  primaryContactRole: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  paymentTerms: string | null;
  currency: string;
  bankIbanMasked: string | null;
  sourceMode: string;
  sourceSystem: string | null;
  externalRef: string | null;
  dataQualityFlag: boolean;
  vendorPortalEnabled: boolean;
  status: string;
  notes: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Reusable Vendor defaults captured before individual lease contracts exist. */
export interface VendorOnboardingProfileDto {
  vendorId: string;
  standardOffHireNoticeDays: number | null;
  earlyTerminationPenalty: string | null;
  renewalOptions: string | null;
  escalationClause: string | null;
  replacementClause: string | null;
  alertLadder: string | null;
  accessMode: 'ManualInternal';
  updatedAtUtc: string;
}

export type VendorDocumentRequirementState =
  | 'Missing'
  | 'PendingConfirmation'
  | 'Confirmed'
  | 'Expired';

/** Server-owned onboarding state used for draft recovery and final review. */
export interface VendorOnboardingDto {
  vendor: VendorDto;
  profile: VendorOnboardingProfileDto | null;
  documentRequirements: Array<{
    code: string;
    required: boolean;
    tracksExpiry: boolean;
    state: VendorDocumentRequirementState;
  }>;
  completeness: {
    completed: number;
    required: number;
    missing: string[];
    canSubmit: boolean;
    canActivate: boolean;
  };
}

/** Governance-only Pending Approval work item with maker and completeness evidence. */
export interface VendorApprovalWorkItemDto {
  vendorId: string;
  legalName: string;
  categoryCode: string;
  sourceMode: VendorSourceMode;
  makerActorRef: string;
  submitterActorRef: string;
  submittedAtUtc: string | null;
  assignedAuthorityRole: 'Procurement';
  updatedAtUtc: string;
  completeness: VendorOnboardingDto['completeness'];
  documentRequirements: VendorOnboardingDto['documentRequirements'];
  changeSummary: {
    identityUpdated: boolean;
    termsCaptured: boolean;
    confirmedDocuments: number;
    pendingDocuments: number;
  };
}

/** Lease-contract response projection. */
export interface LeaseContractDto {
  id: string;
  vendorId: string;
  contractRef: string;
  scopeNodeId: string | null;
  monthlyAmount: string | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  offHireNoticeDays: string | null;
  earlyTerminationPenalty: string | null;
  renewalOptions: string | null;
  escalationClause: string | null;
  replacementClause: string | null;
  alertLadder: string;
  status: string;
  renewedIntoContractRef: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/** Versioned Vendor document response; OCR fields are proposal-only. */
export interface VendorDocumentDto {
  id: string;
  vendorId: string;
  documentTypeCode: string;
  version: number;
  documentReference: string | null;
  blobRef: string;
  issueDate: string | null;
  expiryDate: string | null;
  status: VendorDocumentStatus;
  extractedMetadata: Record<string, unknown> | null;
  confirmedMetadata: Record<string, unknown> | null;
  confirmedByActorRef: string | null;
  confirmedAtUtc: string | null;
  supersededById: string | null;
  createdByActorRef: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}
