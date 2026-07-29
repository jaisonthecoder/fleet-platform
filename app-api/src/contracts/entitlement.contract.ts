import { z } from 'zod';

/** Dedicated-vehicle entitlement lifecycle (C3 / FR-DVR). */
export const entitlementStatusSchema = z.enum([
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
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

/**
 * Duration axis of a dedicated-vehicle request (FR-DVR-01). The driver axis is
 * captured separately in {@link entitlementDriverOptionSchema} so the UI's
 * duration × driver matrix maps 1:1 onto storage.
 */
export const entitlementRequestTypeSchema = z.enum(['LongTerm', 'Temporary']);
export type EntitlementRequestType = z.infer<typeof entitlementRequestTypeSchema>;

/** Driver axis of a dedicated-vehicle request (orthogonal to duration). */
export const entitlementDriverOptionSchema = z.enum([
  'WithDriver',
  'WithoutDriver',
]);
export type EntitlementDriverOption = z.infer<
  typeof entitlementDriverOptionSchema
>;

/** Stable machine reason codes (localised EN + AR on the client). */
export const ENTITLEMENT_REASON = {
  notDraft: 'entitlement-not-draft',
  notPendingApproval: 'entitlement-not-pending-approval',
  notApproved: 'entitlement-not-approved',
  consentRequired: 'entitlement-consent-required-before-allocation',
  eligibilityDenied: 'entitlement-eligibility-denied',
  sodSelfApproval: 'sod-02-self-approval',
  noApprover: 'entitlement-no-approver-resolvable',
  alreadySubmitted: 'entitlement-already-submitted',
  terminal: 'entitlement-already-terminal',
  windowInvalid: 'entitlement-window-invalid',
  principalRequired: 'entitlement-authenticated-principal-required',
  requesterMismatch: 'entitlement-requester-mismatch',
  organizationMismatch: 'entitlement-organization-not-authorized',
  scopeNotAuthorized: 'entitlement-scope-not-authorized',
  withDriverDisabled: 'entitlement-with-driver-not-approved',
  preferredVehicleInvalid: 'entitlement-preferred-vehicle-not-eligible',
  idempotencyRequired: 'entitlement-idempotency-key-required',
  idempotencyReused: 'entitlement-idempotency-key-reused',
  commandInProgress: 'entitlement-command-in-progress',
  revisionConflict: 'entitlement-revision-conflict',
  eligibilityPolicyPending: 'entitlement-eligibility-policy-pending',
  consentTemplatePending: 'entitlement-consent-template-pending',
  allocationExclusivityPending: 'entitlement-allocation-exclusivity-pending',
  approvalWorkflowPending: 'entitlement-approval-workflow-pending',
  lifecycleCommandsPending: 'entitlement-lifecycle-commands-pending',
  eligibilityPreviewRequired: 'entitlement-eligibility-preview-required',
  eligibilityPreviewInvalid: 'entitlement-eligibility-preview-invalid',
  eligibilityPreviewExpired: 'entitlement-eligibility-preview-expired',
  eligibilityPreviewMismatch: 'entitlement-eligibility-preview-mismatch',
  stateConflict: 'entitlement-state-conflict',
  workflowVersionConflict: 'entitlement-workflow-version-conflict',
  systemAdminOperationalDenied: 'entitlement-system-admin-operational-denied',
  consentActorMismatch: 'entitlement-consent-actor-mismatch',
  consentVersionStale: 'entitlement-consent-version-stale',
  vehicleNotQualified: 'entitlement-vehicle-not-qualified',
  allocationVarianceRequired: 'entitlement-allocation-variance-required',
  actionNotAllowed: 'entitlement-action-not-allowed',
  returnRequired: 'entitlement-return-required',
  fleetAllocationOnly: 'entitlement-fleet-allocation-only',
} as const;

/** Create a dedicated-vehicle entitlement request (Draft). */
export const createEntitlementSchema = z.object({
  requestType: entitlementRequestTypeSchema,
  driverOption: entitlementDriverOptionSchema.optional(),
  requesterPersonId: z.string().uuid(),
  assignedDriverPersonId: z.string().uuid().optional(),
  justificationCategory: z.string().min(1).max(120),
  justificationText: z.string().min(1).max(2000),
  vehicleCategoryCode: z.string().max(60).optional(),
  preferredVehicleId: z.string().uuid().optional(),
  preferenceNote: z.string().trim().max(500).optional(),
  eligibilityPreviewId: z.string().uuid().optional(),
  durationStart: z.string().date(),
  durationEnd: z.string().date(),
  locationNodeId: z.string().uuid().optional(),
  businessUnit: z.string().max(120).optional(),
  costCentre: z.string().max(60).optional(),
}).strict();
export type CreateEntitlement = z.infer<typeof createEntitlementSchema>;

/** Public self-request body; requester identity is bound from the Principal. */
export const createSelfEntitlementSchema = createEntitlementSchema.omit({
  requesterPersonId: true,
});
export type CreateSelfEntitlement = z.infer<typeof createSelfEntitlementSchema>;

/** Owner edit of a Draft; authority and organization remain server-bound. */
export const updateEntitlementDraftSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    requestType: entitlementRequestTypeSchema.optional(),
    driverOption: entitlementDriverOptionSchema.optional(),
    assignedDriverPersonId: z.string().uuid().nullable().optional(),
    justificationCategory: z.string().min(1).max(120).optional(),
    justificationText: z.string().min(1).max(2000).optional(),
    vehicleCategoryCode: z.string().max(60).nullable().optional(),
    preferredVehicleId: z.string().uuid().nullable().optional(),
    preferenceNote: z.string().trim().max(500).nullable().optional(),
    eligibilityPreviewId: z.string().uuid().nullable().optional(),
    durationStart: z.string().date().optional(),
    durationEnd: z.string().date().optional(),
    locationNodeId: z.string().uuid().optional(),
    businessUnit: z.string().max(120).nullable().optional(),
    costCentre: z.string().max(60).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'expectedRevision'), {
    message: 'at least one Draft field is required',
  });
export type UpdateEntitlementDraft = z.infer<typeof updateEntitlementDraftSchema>;

/** Side-effect-free eligibility request; employee facts and organization are server-derived. */
export const entitlementEligibilityPreviewSchema = z
  .object({
    requestType: entitlementRequestTypeSchema,
    driverOption: entitlementDriverOptionSchema.default('WithoutDriver'),
    justificationCategory: z.string().min(1).max(120),
    durationStart: z.string().date(),
    durationEnd: z.string().date(),
    locationNodeId: z.string().uuid(),
    assignedDriverPersonId: z.string().uuid().optional(),
    requestedVehicleClass: z.string().max(60).optional(),
  })
  .strict();
export type EntitlementEligibilityPreview = z.infer<
  typeof entitlementEligibilityPreviewSchema
>;

/** Revision-bound submission of one eligibility-evidenced owner Draft. */
export const submitEntitlementSchema = z.object({
  expectedRevision: z.number().int().positive(),
}).strict();
export type SubmitEntitlement = z.infer<typeof submitEntitlementSchema>;

export interface EntitlementEligibleVehicleOptionDto {
  vehicleId: string;
  plate: string;
  makeCode: string | null;
  modelCode: string | null;
  vehicleClass: string;
  fuelTypeCode: string | null;
  locationName: string;
}

export interface EntitlementProfessionalDriverDto {
  personId: string;
  fullName: string;
  employeeId: string;
  scopeName: string;
}

export interface EntitlementEligibilityPreviewDto {
  previewId: string | null;
  decision: 'ALLOW' | 'DENY';
  reasons: string[];
  policyVersion: string;
  policyRuleId: string | null;
  policyVersionId: string | null;
  requestedScopeNodeId: string;
  resolvedScopeNodeId: string | null;
  factFingerprint: string;
  evaluatedAtUtc: string;
  permittedVehicleClasses: string[];
  eligibleVehicleOptions: EntitlementEligibleVehicleOptionDto[];
}

/** Approver decision on an entitlement step (routed via the workflow engine). */
export const decideEntitlementSchema = z.object({
  actorPersonId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  expectedStepVersion: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
});
export type DecideEntitlement = z.infer<typeof decideEntitlementSchema>;

/** Public approver body; the acting person is derived from authentication. */
export const entitlementActionSchema = z.object({
  expectedRevision: z.number().int().positive(),
  expectedStepVersion: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
}).strict();
export type EntitlementAction = z.infer<typeof entitlementActionSchema>;

/** Minimized assigned/delegated Dedicated approval item. */
export interface EntitlementApprovalWorkItemDto {
  entitlementId: string;
  revision: number;
  workflowInstanceId: string;
  workflowStepId: string;
  workflowStepVersion: number;
  delegated: boolean;
  actingForPersonId: string | null;
  requesterName: string;
  requestType: EntitlementRequestType;
  driverOption: EntitlementDriverOption | null;
  justificationCategory: string;
  justificationText: string;
  vehicleCategoryCode: string | null;
  preferredVehicleId: string | null;
  preferenceNote: string | null;
  durationStart: string;
  durationEnd: string;
  locationName: string | null;
  eligibilityResult: Record<string, unknown> | null;
  dueAtUtc: string | null;
}

/** Driver consent before allocation (the non-negotiable gate). */
export const entitlementConsentSchema = z.object({
  expectedRevision: z.number().int().positive(),
  consentDocumentVersion: z.string().min(1),
  signatureRef: z.string().min(1).optional(),
}).strict();
export type EntitlementConsent = z.infer<typeof entitlementConsentSchema>;

/** Allocate an approved + consented entitlement to a specific vehicle. */
export const allocateEntitlementSchema = z.object({
  vehicleId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  varianceReasonCode: z.string().min(1).max(120).optional(),
}).strict();
export type AllocateEntitlement = z.infer<typeof allocateEntitlementSchema>;

export interface EntitlementConsentContextDto {
  available: boolean;
  blockingReasons: string[];
  version: string | null;
  effectiveAtUtc: string | null;
  content: { en: string; ar: string } | null;
}

export interface EntitlementAllocationOptionDto extends EntitlementEligibleVehicleOptionDto {}

export interface EntitlementAllocationWorkItemDto {
  entitlement: EntitlementDto;
  requesterName: string;
  preferredVehiclePlate: string | null;
  options: EntitlementAllocationOptionDto[];
}

export const entitlementLifecycleCommandSchema = z.object({
  expectedRevision: z.number().int().positive(),
  reason: z.string().min(1).max(500),
}).strict();
export type EntitlementLifecycleCommand = z.infer<typeof entitlementLifecycleCommandSchema>;

export const renewEntitlementSchema = z.object({
  expectedRevision: z.number().int().positive(),
  durationStart: z.string().date(),
  durationEnd: z.string().date(),
}).strict();
export type RenewEntitlement = z.infer<typeof renewEntitlementSchema>;

export interface EntitlementCapabilitiesDto {
  edit: boolean;
  submit: boolean;
  consent: boolean;
  cancel: boolean;
  renew: boolean;
  returnVehicle: boolean;
  blockingReasons: string[];
}

export interface EntitlementEventDto {
  id: string;
  eventType: string;
  reason: string | null;
  detail: Record<string, unknown> | null;
  atUtc: string;
}

export const entitlementReconciliationReasonSchema = z.enum([
  'terminal-entitlement-active-allocation',
  'allocated-entitlement-missing-active-allocation',
  'dedicated-vehicle-pool-outside-active-bsd',
  'open-bsd-window-missing-active-allocation',
  'renewal-predecessor-invalid',
  'referenced-eligibility-preview-missing',
]);
export type EntitlementReconciliationReason = z.infer<typeof entitlementReconciliationReasonSchema>;

export interface EntitlementReconciliationFindingDto {
  reasonCode: EntitlementReconciliationReason;
  entitlementRef: string;
  vehicleRef: string | null;
  relatedRef: string | null;
  detectedAtUtc: string;
  recommendedOwner: 'FleetOperations' | 'PlatformSupport';
}

export interface EntitlementReconciliationReportDto {
  detectedAtUtc: string;
  findingCount: number;
  findings: EntitlementReconciliationFindingDto[];
  metrics: Record<string, number>;
  unavailableMetrics: string[];
}

/** Record a BSD (leave) return window during which the vehicle returns to the pool. */
export const bsdWindowSchema = z.object({
  vehicleId: z.string().uuid(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  reason: z.string().max(500).optional(),
});
export type BsdWindow = z.infer<typeof bsdWindowSchema>;

export const confirmBsdWindowSchema = z.object({ reason: z.string().min(1).max(500) }).strict();
export const cancelBsdWindowSchema = confirmBsdWindowSchema;

export interface EntitlementDto {
  id: string;
  requestType: EntitlementRequestType;
  driverOption: EntitlementDriverOption | null;
  requesterPersonId: string;
  requestedByPersonId: string;
  assignedDriverPersonId: string | null;
  justificationCategory: string;
  justificationText: string;
  vehicleCategoryCode: string | null;
  preferredVehicleId: string | null;
  /** Untrusted requester text. Clients must render it as plain text, never HTML. */
  preferenceNote: string | null;
  vehicleId: string | null;
  durationStart: string;
  durationEnd: string;
  locationNodeId: string | null;
  businessUnit: string | null;
  costCentre: string | null;
  status: EntitlementStatus;
  revision: number;
  workflowInstanceId: string | null;
  policyVersion: string | null;
  eligibilityResult: Record<string, unknown> | null;
  approvalRouteProvenance: Record<string, unknown> | null;
  eligibilityPreviewId: string | null;
  consentSignedAtUtc: string | null;
  allocatedAtUtc: string | null;
  renewedFromEntitlementId: string | null;
  capabilities: EntitlementCapabilitiesDto;
  createdAtUtc: string;
}

/** Server-owned entry context; unresolved policy gates are explicit capabilities. */
export interface EntitlementContextDto {
  actor: { personId: string; fullName: string; grade: string | null };
  defaults: {
    requesterPersonId: string;
    requestedByPersonId: string;
    locationNodeId: string | null;
    locationName: string | null;
  };
  capabilities: {
    createDraft: { enabled: boolean; blockingReasons: string[] };
    eligibilityPreview: { enabled: boolean; blockingReasons: string[] };
    submit: { enabled: boolean; blockingReasons: string[] };
    withDriver: { enabled: boolean; blockingReasons: string[] };
    allocation: { enabled: false; blockingReasons: string[] };
  };
  dependencies: Array<{
    key: 'eligibilityPolicy' | 'justificationCategories' | 'consentTemplate' | 'allocationExclusivity';
    status: 'AVAILABLE' | 'PENDING_APPROVAL' | 'UNAVAILABLE';
  }>;
}

export interface BsdWindowDto {
  id: string;
  entitlementRequestId: string;
  vehicleId: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  reason: string | null;
  confirmedAtUtc?: string | null;
  activatedAtUtc?: string | null;
  completedAtUtc?: string | null;
}
