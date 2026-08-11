import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const approvalRelationshipSchema = z.enum(['DIRECT_MANAGER', 'DELEGATE', 'WORKFLOW_ASSIGNEE', 'FLEET_AUTHORITY'])
export const approvalEvidenceKindSchema = z.enum(['Eligibility', 'Consent', 'Reservation', 'Forecast'])
export const approvalEvidenceStatusSchema = z.enum(['VERIFIED', 'SIGNED', 'HELD', 'AVAILABLE', 'NOT_CONFIGURED', 'UNAVAILABLE'])
export const approvalProviderStatusSchema = z.enum(['AVAILABLE', 'NOT_CONFIGURED', 'UNAVAILABLE'])

export const approvalRequesterSchema = z.object({
  fullName: z.string(),
  employeeId: z.string(),
  relationshipCode: approvalRelationshipSchema,
  behavior: z.object({
    year: z.number().int(),
    bookingCount: z.number().int().nonnegative(),
    noShowCount: z.number().int().nonnegative(),
    lateReturnCount: z.number().int().nonnegative(),
  }),
}).strict()

export const approvalEvidenceItemSchema = z.object({
  kind: approvalEvidenceKindSchema,
  status: approvalEvidenceStatusSchema,
  reasonCodes: z.array(z.string()),
  occurredAtUtc: z.string().nullable(),
  version: z.string().nullable(),
}).strict()

export const approvalOptionalProviderSchema = z.object({
  status: approvalProviderStatusSchema,
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  utilizationPercent: z.number().min(0).max(100).nullable(),
  suggestedStartAtUtc: z.string().nullable(),
  reasonCodes: z.array(z.string()),
}).strict()

export const approvalWorkItemSchema = z.object({
  bookingId: z.string().uuid(),
  bookingNumber: z.string(),
  requesterName: z.string(),
  vehicle: z.object({ plate: z.string(), makeCode: z.string().nullable(), modelCode: z.string().nullable() }),
  pickupAtUtc: z.string(),
  returnAtUtc: z.string(),
  purpose: z.string().nullable(),
  passengerCount: z.number().nullable(),
  consentVersion: z.string(),
  workflowStepId: z.string().uuid(),
  expectedBookingVersion: z.number().int().positive(),
  expectedStepVersion: z.number().int().positive(),
  dueAtUtc: z.string().nullable(),
  delegated: z.boolean(),
  evidence: z.object({
    eligibility: z.literal('VERIFIED_AT_CONSENT'),
    consent: z.literal('SIGNED'),
    reservation: z.literal('HELD'),
    forecast: z.literal('NOT_AVAILABLE'),
  }),
  requester: approvalRequesterSchema.optional(),
  destination: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  justification: z.string().nullable().optional(),
  evidenceItems: z.array(approvalEvidenceItemSchema).optional(),
  cost: approvalOptionalProviderSchema.optional(),
  forecast: approvalOptionalProviderSchema.optional(),
})
export type ApprovalWorkItem = z.infer<typeof approvalWorkItemSchema>
export type ApprovalAction = 'approve' | 'decline' | 'request-changes'

export const preparationItemSchema = z.object({
  bookingId: z.string().uuid(),
  bookingNumber: z.string(),
  vehiclePlate: z.string(),
  pickupAtUtc: z.string(),
  returnAtUtc: z.string(),
  scopeName: z.string().nullable(),
  readiness: z.literal('AWAITING_HANDOVER'),
})
export type PreparationItem = z.infer<typeof preparationItemSchema>

export const entitlementApprovalWorkItemSchema = z.object({
  entitlementId: z.string().uuid(),
  revision: z.number().int().positive(),
  workflowInstanceId: z.string().uuid(),
  workflowStepId: z.string().uuid(),
  workflowStepVersion: z.number().int().positive(),
  delegated: z.boolean(),
  actingForPersonId: z.string().uuid().nullable(),
  requesterName: z.string(),
  requestType: z.enum(['LongTerm', 'Temporary']),
  driverOption: z.enum(['WithDriver', 'WithoutDriver']).nullable(),
  justificationCategory: z.string(),
  justificationText: z.string(),
  vehicleCategoryCode: z.string().nullable(),
  preferredVehicleId: z.string().uuid().nullable(),
  preferenceNote: z.string().nullable(),
  durationStart: z.string(),
  durationEnd: z.string(),
  locationName: z.string().nullable(),
  eligibilityResult: z.record(z.string(), z.unknown()).nullable(),
  dueAtUtc: z.string().nullable(),
})
export type EntitlementApprovalWorkItem = z.infer<typeof entitlementApprovalWorkItemSchema>
export type EntitlementApprovalAction = 'approve' | 'decline' | 'request-modification'

export const approvalInterventionActionSchema = z.enum(['SUSPEND', 'RESUME', 'REVOKE'])
export type ApprovalInterventionAction = z.infer<typeof approvalInterventionActionSchema>

export const approvalHistoryItemSchema = z.object({
  domain: z.enum(['PoolBooking', 'DedicatedVehicle']),
  subjectId: z.string().uuid(),
  reference: z.string(),
  requesterName: z.string(),
  summary: z.string(),
  status: z.string(),
  revision: z.number().int().positive(),
  decision: z.string(),
  decisionReason: z.string().nullable(),
  decidedAtUtc: z.string().datetime(),
  suspended: z.boolean(),
  suspensionReason: z.string().nullable(),
  suspendedAtUtc: z.string().datetime().nullable(),
  capabilities: z.object({ suspend: z.boolean(), resume: z.boolean(), revoke: z.boolean() }),
  interventions: z.array(z.object({ action: approvalInterventionActionSchema, reason: z.string().nullable(), occurredAtUtc: z.string().datetime() })),
})
export type ApprovalHistoryItem = z.infer<typeof approvalHistoryItemSchema>

/** Loads only approval tasks assigned or actively delegated to the caller. */
export async function getBookingApprovals(): Promise<ApprovalWorkItem[]> {
  return z.array(approvalWorkItemSchema).parse(await apiClient.get('/v1/booking-approvals'))
}

/** Applies one versioned, retry-safe approval action. */
export async function decideBooking(input: {
  item: ApprovalWorkItem
  action: ApprovalAction
  reason?: string
  idempotencyKey: string
}) {
  return apiClient.post(`/v1/bookings/${input.item.bookingId}/${input.action}`, {
    expectedBookingVersion: input.item.expectedBookingVersion,
    expectedStepVersion: input.item.expectedStepVersion,
    ...(input.reason ? { reason: input.reason } : {}),
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } })
}

/** Loads Approved upcoming Bookings in the caller's Fleet scope. */
export async function getBookingPreparation(): Promise<PreparationItem[]> {
  return z.array(preparationItemSchema).parse(await apiClient.get('/v1/booking-preparation'))
}

/** Loads only current Dedicated tasks assigned or delegated to the caller. */
export async function getEntitlementApprovals(): Promise<EntitlementApprovalWorkItem[]> {
  return z.array(entitlementApprovalWorkItemSchema).parse(await apiClient.get('/v1/entitlements/approvals'))
}

/** Applies one versioned, retry-safe Dedicated approval action. */
export async function decideEntitlement(input: {
  item: EntitlementApprovalWorkItem
  action: EntitlementApprovalAction
  reason?: string
  idempotencyKey: string
}) {
  return apiClient.post(`/v1/entitlements/${input.item.entitlementId}/${input.action}`, {
    expectedRevision: input.item.revision,
    expectedStepVersion: input.item.workflowStepVersion,
    ...(input.item.actingForPersonId ? { onBehalfOfPersonId: input.item.actingForPersonId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } })
}

/** Loads the caller's immutable Pool and Dedicated decision history. */
export async function getApprovalHistory(): Promise<ApprovalHistoryItem[]> {
  const [pool, dedicated] = await Promise.all([
    apiClient.get('/v1/booking-approvals/history'),
    apiClient.get('/v1/entitlements/approvals/history'),
  ])
  return z.array(approvalHistoryItemSchema).parse([...z.array(approvalHistoryItemSchema).parse(pool), ...z.array(approvalHistoryItemSchema).parse(dedicated)])
    .sort((left, right) => Date.parse(right.decidedAtUtc) - Date.parse(left.decidedAtUtc))
}

/** Applies one versioned pre-custody/pre-allocation approval intervention. */
export async function interveneApproval(input: { item: ApprovalHistoryItem; action: ApprovalInterventionAction; reason: string; idempotencyKey: string }) {
  const path = input.item.domain === 'PoolBooking'
    ? `/v1/bookings/${input.item.subjectId}/approval-intervention`
    : `/v1/entitlements/${input.item.subjectId}/approval-intervention`
  return apiClient.post(path, {
    action: input.action,
    expectedRevision: input.item.revision,
    reason: input.reason,
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } })
}