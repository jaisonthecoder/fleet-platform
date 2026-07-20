import { z } from 'zod';

/** Dedicated-vehicle entitlement lifecycle (C3 / FR-DVR). */
export const entitlementStatusSchema = z.enum([
  'Draft',
  'PendingApproval',
  'Approved',
  'Allocated',
  'Declined',
  'Cancelled',
  'Expired',
]);
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

/** Request types along the duration × driver axes (FR-DVR-01). */
export const entitlementRequestTypeSchema = z.enum([
  'LongTerm',
  'Temporary',
  'WithDriver',
  'WithoutDriver',
]);
export type EntitlementRequestType = z.infer<typeof entitlementRequestTypeSchema>;

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
} as const;

/** Create a dedicated-vehicle entitlement request (Draft). */
export const createEntitlementSchema = z.object({
  requestType: entitlementRequestTypeSchema,
  requesterPersonId: z.string().uuid(),
  justificationCategory: z.string().min(1).max(120),
  justificationText: z.string().min(1).max(2000),
  vehicleCategoryCode: z.string().max(60).optional(),
  durationStart: z.string().date(),
  durationEnd: z.string().date(),
  locationNodeId: z.string().uuid().optional(),
  businessUnit: z.string().max(120).optional(),
  costCentre: z.string().max(60).optional(),
});
export type CreateEntitlement = z.infer<typeof createEntitlementSchema>;

/** Approver decision on an entitlement step (routed via the workflow engine). */
export const decideEntitlementSchema = z.object({
  actorPersonId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
});
export type DecideEntitlement = z.infer<typeof decideEntitlementSchema>;

/** Public approver body; the acting person is derived from authentication. */
export const entitlementActionSchema = z.object({
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
}).strict();
export type EntitlementAction = z.infer<typeof entitlementActionSchema>;

/** Driver consent before allocation (the non-negotiable gate). */
export const entitlementConsentSchema = z.object({
  driverPersonId: z.string().uuid(),
  consentDocumentVersion: z.string().min(1),
  signatureRef: z.string().min(1).optional(),
});
export type EntitlementConsent = z.infer<typeof entitlementConsentSchema>;

/** Allocate an approved + consented entitlement to a specific vehicle. */
export const allocateEntitlementSchema = z.object({
  vehicleId: z.string().uuid(),
});
export type AllocateEntitlement = z.infer<typeof allocateEntitlementSchema>;

/** Record a BSD (leave) return window during which the vehicle returns to the pool. */
export const bsdWindowSchema = z.object({
  vehicleId: z.string().uuid(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  reason: z.string().max(500).optional(),
});
export type BsdWindow = z.infer<typeof bsdWindowSchema>;

export interface EntitlementDto {
  id: string;
  requestType: EntitlementRequestType;
  requesterPersonId: string;
  justificationCategory: string;
  justificationText: string;
  vehicleCategoryCode: string | null;
  vehicleId: string | null;
  durationStart: string;
  durationEnd: string;
  status: EntitlementStatus;
  workflowInstanceId: string | null;
  policyVersion: string | null;
  consentSignedAtUtc: string | null;
  allocatedAtUtc: string | null;
  createdAtUtc: string;
}

export interface BsdWindowDto {
  id: string;
  entitlementRequestId: string;
  vehicleId: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  reason: string | null;
}
