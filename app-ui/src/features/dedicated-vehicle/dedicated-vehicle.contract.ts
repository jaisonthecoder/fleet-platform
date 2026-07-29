import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

const capabilitySchema = z.object({
  enabled: z.boolean(),
  blockingReasons: z.array(z.string()),
})

export const dedicatedVehicleContextSchema = z.object({
  actor: z.object({
    personId: z.string().uuid(),
    fullName: z.string(),
    grade: z.string().nullable(),
  }),
  defaults: z.object({
    requesterPersonId: z.string().uuid(),
    requestedByPersonId: z.string().uuid(),
    locationNodeId: z.string().uuid().nullable(),
    locationName: z.string().nullable(),
  }),
  capabilities: z.object({
    createDraft: capabilitySchema,
    eligibilityPreview: capabilitySchema,
    submit: capabilitySchema,
    withDriver: capabilitySchema,
    allocation: capabilitySchema.extend({ enabled: z.literal(false) }),
  }),
  dependencies: z.array(z.object({
    key: z.enum(['eligibilityPolicy', 'justificationCategories', 'consentTemplate', 'allocationExclusivity']),
    status: z.enum(['AVAILABLE', 'PENDING_APPROVAL', 'UNAVAILABLE']),
  })),
})
export type DedicatedVehicleContext = z.infer<typeof dedicatedVehicleContextSchema>

export const entitlementSchema = z.object({
  id: z.string().uuid(),
  requestType: z.enum(['LongTerm', 'Temporary']),
  driverOption: z.enum(['WithDriver', 'WithoutDriver']).nullable(),
  requesterPersonId: z.string().uuid(),
  requestedByPersonId: z.string().uuid(),
  assignedDriverPersonId: z.string().uuid().nullable(),
  justificationCategory: z.string(),
  justificationText: z.string(),
  vehicleCategoryCode: z.string().nullable(),
  preferredVehicleId: z.string().uuid().nullable(),
  preferenceNote: z.string().nullable(),
  vehicleId: z.string().uuid().nullable(),
  durationStart: z.string(),
  durationEnd: z.string(),
  locationNodeId: z.string().uuid().nullable(),
  businessUnit: z.string().nullable(),
  costCentre: z.string().nullable(),
  status: z.string(),
  revision: z.number().int().positive(),
  workflowInstanceId: z.string().uuid().nullable(),
  policyVersion: z.string().nullable(),
  eligibilityResult: z.record(z.string(), z.unknown()).nullable(),
  approvalRouteProvenance: z.record(z.string(), z.unknown()).nullable(),
  eligibilityPreviewId: z.string().uuid().nullable(),
  consentSignedAtUtc: z.string().nullable(),
  allocatedAtUtc: z.string().nullable(),
  renewedFromEntitlementId: z.string().uuid().nullable(),
  capabilities: z.object({
    edit: z.boolean(), submit: z.boolean(), consent: z.boolean(), cancel: z.boolean(), renew: z.boolean(), returnVehicle: z.boolean(), blockingReasons: z.array(z.string()),
  }),
  createdAtUtc: z.string(),
})
export type Entitlement = z.infer<typeof entitlementSchema>

export interface CreateDedicatedVehicleDraft {
  requestType: 'LongTerm' | 'Temporary'
  driverOption: 'WithDriver' | 'WithoutDriver'
  assignedDriverPersonId?: string
  justificationCategory: string
  justificationText: string
  vehicleCategoryCode?: string
  preferredVehicleId?: string
  preferenceNote?: string
  eligibilityPreviewId: string
  durationStart: string
  durationEnd: string
  locationNodeId: string
  businessUnit?: string
  costCentre?: string
}

export async function getDedicatedVehicleContext(): Promise<DedicatedVehicleContext> {
  return dedicatedVehicleContextSchema.parse(await apiClient.get('/v1/entitlements/context'))
}

export async function getMyEntitlements(): Promise<Entitlement[]> {
  return z.array(entitlementSchema).parse(await apiClient.get('/v1/entitlements'))
}

export async function createDedicatedVehicleDraft(
  input: CreateDedicatedVehicleDraft,
  idempotencyKey: string,
): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.post('/v1/entitlements', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }))
}

export interface UpdateDedicatedVehicleDraft extends CreateDedicatedVehicleDraft {
  expectedRevision: number
}

export async function updateDedicatedVehicleDraft(
  entitlementId: string,
  input: UpdateDedicatedVehicleDraft,
  idempotencyKey: string,
): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.patch(`/v1/entitlements/${entitlementId}`, input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }))
}

export const dedicatedLookupValueSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string().nullable(),
  descriptionAr: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
})
export type DedicatedLookupValue = z.infer<typeof dedicatedLookupValueSchema>

export interface EligibilityPreviewInput {
  requestType: 'LongTerm' | 'Temporary'
  driverOption: 'WithDriver' | 'WithoutDriver'
  assignedDriverPersonId?: string
  justificationCategory: string
  durationStart: string
  durationEnd: string
  locationNodeId: string
  requestedVehicleClass: string
}

export const eligibilityPreviewSchema = z.object({
  previewId: z.string().uuid().nullable(),
  decision: z.enum(['ALLOW', 'DENY']),
  reasons: z.array(z.string()),
  policyVersion: z.string(),
  policyRuleId: z.string().uuid().nullable(),
  policyVersionId: z.string().uuid().nullable(),
  requestedScopeNodeId: z.string().uuid(),
  resolvedScopeNodeId: z.string().uuid().nullable(),
  factFingerprint: z.string(),
  evaluatedAtUtc: z.string(),
  permittedVehicleClasses: z.array(z.string()),
  eligibleVehicleOptions: z.array(z.object({
    vehicleId: z.string().uuid(),
    plate: z.string(),
    makeCode: z.string().nullable(),
    modelCode: z.string().nullable(),
    vehicleClass: z.string(),
    fuelTypeCode: z.string().nullable(),
    locationName: z.string(),
  })),
})
export type EligibilityPreview = z.infer<typeof eligibilityPreviewSchema>

export async function getDedicatedJustificationCategories(): Promise<DedicatedLookupValue[]> {
  return z.array(dedicatedLookupValueSchema).parse(
    await apiClient.get('/v1/entitlements/justification-categories'),
  )
}

export async function getDedicatedVehicleClasses(): Promise<DedicatedLookupValue[]> {
  return z.array(dedicatedLookupValueSchema).parse(
    await apiClient.get('/v1/entitlements/vehicle-classes'),
  )
}

export async function previewDedicatedEligibility(
  input: EligibilityPreviewInput,
): Promise<EligibilityPreview> {
  return eligibilityPreviewSchema.parse(
    await apiClient.post('/v1/entitlements/eligibility-preview', input),
  )
}

/** Submits one owner Draft with stable revision and idempotency evidence. */
export async function submitDedicatedVehicleRequest(
  entitlementId: string,
  expectedRevision: number,
  idempotencyKey: string,
): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.post(
    `/v1/entitlements/${entitlementId}/submit`,
    { expectedRevision },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  ))
}

export const entitlementConsentContextSchema = z.object({
  available: z.boolean(),
  blockingReasons: z.array(z.string()),
  version: z.string().nullable(),
  effectiveAtUtc: z.string().nullable(),
  content: z.object({ en: z.string(), ar: z.string() }).nullable(),
})
export type EntitlementConsentContext = z.infer<typeof entitlementConsentContextSchema>

export const entitlementAllocationOptionSchema = eligibilityPreviewSchema.shape.eligibleVehicleOptions.element
export const entitlementAllocationWorkItemSchema = z.object({
  entitlement: entitlementSchema,
  requesterName: z.string(),
  preferredVehiclePlate: z.string().nullable(),
  options: z.array(entitlementAllocationOptionSchema),
})
export type EntitlementAllocationWorkItem = z.infer<typeof entitlementAllocationWorkItemSchema>

/** Loads the current governed Dedicated consent template. */
export async function getEntitlementConsentContext(): Promise<EntitlementConsentContext> {
  return entitlementConsentContextSchema.parse(await apiClient.get('/v1/entitlements/consent-context'))
}

/** Records assigned-driver consent with revision and stable command evidence. */
export async function consentDedicatedVehicleRequest(input: {
  entitlementId: string
  expectedRevision: number
  consentDocumentVersion: string
  signatureRef?: string
  idempotencyKey: string
}): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.post(`/v1/entitlements/${input.entitlementId}/consent`, {
    expectedRevision: input.expectedRevision,
    consentDocumentVersion: input.consentDocumentVersion,
    ...(input.signatureRef ? { signatureRef: input.signatureRef } : {}),
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Loads consented requests and current final-qualified options in Fleet scope. */
export async function getEntitlementAllocationWorklist(): Promise<EntitlementAllocationWorkItem[]> {
  return z.array(entitlementAllocationWorkItemSchema).parse(await apiClient.get('/v1/entitlements/allocation-worklist'))
}

/** Allocates one final-qualified Vehicle with optional governed preference variance. */
export async function allocateDedicatedVehicle(input: {
  item: EntitlementAllocationWorkItem
  vehicleId: string
  varianceReasonCode?: string
  idempotencyKey: string
}): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.post(`/v1/entitlements/${input.item.entitlement.id}/allocate`, {
    vehicleId: input.vehicleId,
    expectedRevision: input.item.entitlement.revision,
    ...(input.varianceReasonCode ? { varianceReasonCode: input.varianceReasonCode } : {}),
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

export const entitlementEventSchema = z.object({
  id: z.string().uuid(), eventType: z.string(), reason: z.string().nullable(), detail: z.record(z.string(), z.unknown()).nullable(), atUtc: z.string(),
})
export type EntitlementEvent = z.infer<typeof entitlementEventSchema>

/** Cancels one owner request in a server-permitted state. */
export async function cancelEntitlement(input: { request: Entitlement; reason: string; idempotencyKey: string }): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.post(`/v1/entitlements/${input.request.id}/cancel`, { expectedRevision: input.request.revision, reason: input.reason }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Creates a linked renewal Draft with a fresh effective period. */
export async function renewEntitlement(input: { request: Entitlement; durationStart: string; durationEnd: string; idempotencyKey: string }): Promise<Entitlement> {
  return entitlementSchema.parse(await apiClient.post(`/v1/entitlements/${input.request.id}/renew`, { expectedRevision: input.request.revision, durationStart: input.durationStart, durationEnd: input.durationEnd }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Loads owner-safe immutable lifecycle chronology. */
export async function getEntitlementEvents(id: string): Promise<EntitlementEvent[]> {
  return z.array(entitlementEventSchema).parse(await apiClient.get(`/v1/entitlements/${id}/events`))
}

export const bsdWindowSchema = z.object({
  id: z.string().uuid(), entitlementRequestId: z.string().uuid(), vehicleId: z.string().uuid(), windowStart: z.string(), windowEnd: z.string(), status: z.enum(['Proposed', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'Conflict']), reason: z.string().nullable(), confirmedAtUtc: z.string().nullable().optional(), activatedAtUtc: z.string().nullable().optional(), completedAtUtc: z.string().nullable().optional(),
})
export type BsdWindow = z.infer<typeof bsdWindowSchema>

/** Proposes a manual minimized BSD Pool window for Fleet confirmation. */
export async function proposeBsdWindow(input: { entitlementId: string; vehicleId: string; windowStart: string; windowEnd: string; reason: string }): Promise<BsdWindow> {
  return bsdWindowSchema.parse(await apiClient.post(`/v1/entitlements/${input.entitlementId}/bsd-windows`, { vehicleId: input.vehicleId, windowStart: input.windowStart, windowEnd: input.windowEnd, reason: input.reason }))
}

/** Confirms a proposed BSD window before scheduler activation. */
export async function confirmBsdWindow(input: { windowId: string; reason: string }): Promise<BsdWindow> {
  return bsdWindowSchema.parse(await apiClient.post(`/v1/entitlements/bsd-windows/${input.windowId}/confirm`, { reason: input.reason }))
}

/** Cancels a future Proposed/Confirmed BSD window under Fleet authority. */
export async function cancelBsdWindow(input: { windowId: string; reason: string }): Promise<BsdWindow> {
  return bsdWindowSchema.parse(await apiClient.post(`/v1/entitlements/bsd-windows/${input.windowId}/cancel`, { reason: input.reason }))
}

/** Loads the persisted privacy-safe BSD schedule for one request. */
export async function getBsdWindows(entitlementId: string): Promise<BsdWindow[]> {
  return z.array(bsdWindowSchema).parse(await apiClient.get(`/v1/entitlements/${entitlementId}/bsd-windows`))
}

export const professionalDriverSchema = z.object({
  personId: z.string().uuid(),
  fullName: z.string(),
  employeeId: z.string(),
  scopeName: z.string(),
})
export type ProfessionalDriver = z.infer<typeof professionalDriverSchema>

export async function getProfessionalDrivers(locationNodeId: string): Promise<ProfessionalDriver[]> {
  const query = new URLSearchParams({ locationNodeId })
  return z.array(professionalDriverSchema).parse(
    await apiClient.get(`/v1/entitlements/professional-drivers?${query}`),
  )
}