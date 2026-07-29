import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

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