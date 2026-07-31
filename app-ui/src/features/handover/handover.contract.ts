import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const handoverRegisterFilterSchema = z.enum(['All', 'OnTrip', 'ChargesDamage', 'OnTime'])
export const handoverRegisterSignalSchema = z.enum(['ON_TRIP', 'ON_TIME', 'LATE', 'DAMAGE_REVIEW', 'KEY_REVIEW', 'FINE_ATTACHED', 'RECONCILIATION_REVIEW'])
export const handoverProviderStatusSchema = z.enum(['AVAILABLE', 'NOT_CONFIGURED', 'UNAVAILABLE'])
export const handoverChecklistCodeSchema = z.enum(['body', 'tyres', 'lights', 'assets', 'cabin'])
export const handoverInspectionVerdictSchema = z.enum(['Pass', 'Fail'])
export const handoverReturnConditionSchema = z.enum(['Good', 'MinorWear', 'DamageNoted'])
export const handoverKeyOutcomeSchema = z.enum(['Returned', 'Lost'])

export const handoverInspectionSchema = z.object({
  code: handoverChecklistCodeSchema,
  verdict: handoverInspectionVerdictSchema,
  note: z.string().nullable(),
  evidenceRefs: z.array(z.string()),
})

export const handoverRegisterRowSchema = z.object({
  handoverId: z.string().uuid().nullable(),
  bookingId: z.string().uuid(),
  bookingNumber: z.string(),
  driverName: z.string(),
  vehicle: z.object({
    id: z.string().uuid(),
    plate: z.string(),
    makeCode: z.string().nullable(),
    modelCode: z.string().nullable(),
  }),
  issuedAtUtc: z.string().nullable(),
  returnedAtUtc: z.string().nullable(),
  distanceKm: z.string().nullable(),
  chargeSummary: z.object({
    status: handoverProviderStatusSchema,
    amount: z.string().nullable(),
    currency: z.string().nullable(),
    labels: z.array(z.string()),
  }),
  primaryStatus: handoverRegisterSignalSchema,
  signals: z.array(handoverRegisterSignalSchema),
  capabilities: z.object({ view: z.boolean(), editOpenCustody: z.boolean(), returnVehicle: z.boolean() }),
  activityAtUtc: z.string(),
})

export const handoverRegisterSchema = z.object({
  items: z.array(handoverRegisterRowSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(50),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})
export type HandoverRegister = z.infer<typeof handoverRegisterSchema>
export type HandoverRegisterFilter = z.infer<typeof handoverRegisterFilterSchema>
export type HandoverRegisterRow = z.infer<typeof handoverRegisterRowSchema>

export interface HandoverRegisterInput {
  filter: HandoverRegisterFilter
  page: number
  pageSize: number
}

export const handoverCaptureContextSchema = z.object({
  schemaVersion: z.literal(2),
  booking: z.object({ id: z.string().uuid(), number: z.string(), revision: z.number().int().positive(), status: z.string(), pickupAtUtc: z.string(), returnAtUtc: z.string() }),
  vehicle: z.object({ id: z.string().uuid(), plate: z.string(), makeCode: z.string().nullable(), modelCode: z.string().nullable() }),
  driver: z.object({ personId: z.string().uuid(), fullName: z.string() }),
  scope: z.object({ nodeId: z.string().uuid(), name: z.string() }),
  consent: z.object({ version: z.string(), signedAtUtc: z.string() }),
  eligibility: z.object({ status: z.enum(['VERIFIED', 'UNAVAILABLE']), reasonCodes: z.array(z.string()), evaluatedAtUtc: z.string().nullable() }),
  telematics: z.object({ status: z.enum(['MATCHED', 'STALE', 'UNAVAILABLE']), odometer: z.string().nullable(), observedAtUtc: z.string().nullable() }),
  handover: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), phase: z.enum(['Handover', 'Returned']),
    issuedAtUtc: z.string(), startOdometer: z.string(), startFuelEighths: z.number().int().min(0).max(8), keyIssueRef: z.string().nullable(),
    releaseLocation: z.object({ nodeId: z.string().uuid().nullable(), code: z.string().nullable(), name: z.string().nullable() }),
  }).nullable(),
  carriedDamage: z.array(z.object({
    id: z.string().uuid(), x: z.number().min(0).max(1), y: z.number().min(0).max(1), region: z.string(), templateVersion: z.number().int(), photoRef: z.string().nullable(), note: z.string().nullable(), state: z.string(), atUtc: z.string(),
  })),
  capabilities: z.object({ handover: z.boolean(), return: z.boolean(), amendOpenCustody: z.boolean() }),
})
export type HandoverCaptureContext = z.infer<typeof handoverCaptureContextSchema>

export const stagedHandoverEvidenceSchema = z.object({
  id: z.string().uuid(),
  evidenceRef: z.string(),
  evidenceType: z.enum(['VehiclePhoto', 'DamagePhoto', 'Signature']),
  status: z.literal('Staged'),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  mimeType: z.enum(['image/jpeg', 'image/png']),
  sizeBytes: z.number().int().positive(),
  expiresAtUtc: z.string().datetime(),
})
export type StagedHandoverEvidence = z.infer<typeof stagedHandoverEvidenceSchema>

export const handoverWorkItemSchema = z.object({
  bookingId: z.string().uuid(),
  bookingNumber: z.string(),
  handoverId: z.string().uuid().nullable(),
  phase: z.enum(['AwaitingHandover', 'ActiveCustody']),
  vehicleId: z.string().uuid(),
  vehiclePlate: z.string(),
  driverPersonId: z.string().uuid(),
  driverName: z.string(),
  pickupAtUtc: z.string(),
  returnAtUtc: z.string(),
  scopeName: z.string().nullable(),
})
export type HandoverWorkItem = z.infer<typeof handoverWorkItemSchema>

const damageSchema = z.object({
  id: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  region: z.string(),
  templateVersion: z.number().int(),
  photoRef: z.string().nullable(),
  note: z.string().nullable(),
  state: z.string(),
  atUtc: z.string(),
})

export const handoverSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  driverPersonId: z.string().uuid(),
  phase: z.enum(['Handover', 'Returned']),
  handoverAtUtc: z.string(),
  startOdometer: z.string(),
  startFuelEighths: z.number().int(),
  gpsStatus: z.string().nullable(),
  keyIssueRef: z.string().nullable(),
  offlineCaptured: z.boolean(),
  returnAtUtc: z.string().nullable(),
  endOdometer: z.string().nullable(),
  endFuelEighths: z.number().int().nullable(),
  returnCondition: z.string().nullable(),
  keyReturnRef: z.string().nullable(),
  expectedFuelConsumedLitres: z.string().nullable(),
  actualFuelConsumedLitres: z.string().nullable(),
  fuelDeviationPercent: z.string().nullable(),
  fuelDeviationFlagged: z.boolean(),
  odometerConflict: z.boolean(),
  lateReturn: z.boolean(),
  damage: z.array(damageSchema),
})
export type Handover = z.infer<typeof handoverSchema>

export const handoverChainSchema = z.object({
  schemaVersion: z.literal(2),
  handover: handoverSchema,
  inspections: z.array(z.object({ capturePhase: z.enum(['Handover', 'Return']), definitionVersion: z.number().int().positive(), code: handoverChecklistCodeSchema, verdict: handoverInspectionVerdictSchema, note: z.string().nullable(), evidenceRefs: z.array(z.string()) })),
  evidenceRefs: z.array(z.string()),
  keys: z.array(z.object({ id: z.string().uuid(), vehicleId: z.string().uuid(), handoverId: z.string().uuid().nullable(), custodyState: z.string(), keyRef: z.string().nullable(), personId: z.string().uuid().nullable(), atUtc: z.string() })),
  amendments: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().positive(), reason: z.string(), actorPersonId: z.string().uuid(), atUtc: z.string() })),
  chainRevision: z.number().int().positive(),
  evidenceCompleteness: z.enum(['Complete', 'LegacyPartial']),
})
export type HandoverChain = z.infer<typeof handoverChainSchema>

export const handoverReceiptSchema = z.object({
  schemaVersion: z.literal(2), handoverId: z.string().uuid(), bookingId: z.string().uuid(), bookingNumber: z.string(), bookingStatus: z.literal('Completed'), returnedAtUtc: z.string(),
  releaseLocation: z.object({ nodeId: z.string().uuid().nullable(), code: z.string().nullable(), name: z.string().nullable() }),
  returnLocation: z.object({ nodeId: z.string().uuid().nullable(), code: z.string().nullable(), name: z.string().nullable() }),
  odometer: z.object({ start: z.string(), end: z.string(), distanceKm: z.string(), verdict: z.enum(['MATCHED', 'ADVISORY', 'CONFLICT']) }),
  fuel: z.object({ startEighths: z.number().int(), endEighths: z.number().int(), deviationPercent: z.string().nullable(), verdict: z.enum(['MATCHED', 'ADVISORY', 'UNAVAILABLE']) }),
  key: z.object({ outcome: z.enum(['Returned', 'LostReviewRequired', 'Unknown']), reviewReference: z.string().nullable() }),
  damage: z.object({ carriedCount: z.number().int().nonnegative(), newCount: z.number().int().nonnegative(), reviewRequired: z.boolean() }),
  timing: z.object({ late: z.boolean() }), evidenceRefs: z.array(z.string()), evidenceCompleteness: z.enum(['Complete', 'LegacyPartial']),
})
export type HandoverReceipt = z.infer<typeof handoverReceiptSchema>

export const handoverAmendmentSchema = z.object({ schemaVersion: z.literal(2), id: z.string().uuid(), handoverId: z.string().uuid(), revision: z.number().int().positive(), reason: z.string(), evidenceRefs: z.array(z.string()), actorPersonId: z.string().uuid(), atUtc: z.string() })

export interface HandoverCaptureInput {
  odometer: number
  fuelEighths: number
  keyRef?: string
  signatureRef: string
  checklist: Array<{ item: string; pass: boolean }>
  condition?: string
  damageRegion?: string
  damageNote?: string
}

export interface HandoverV2Inspection {
  code: z.infer<typeof handoverChecklistCodeSchema>
  verdict: z.infer<typeof handoverInspectionVerdictSchema>
  note?: string
  evidenceRefs: string[]
}

export interface OpenHandoverV2Input {
  context: HandoverCaptureContext
  odometer: number
  fuelEighths: number
  keyRef: string
  inspection: HandoverV2Inspection[]
  vehiclePhotoRefs: string[]
  signatureEvidenceRef: string
  existingDamage: Array<{ x: number; y: number; region: string; templateVersion: number; photoRef?: string; note?: string; state: 'existing'; carriedFromDamagePinId?: string }>
}

export interface ReturnHandoverV2Input {
  context: HandoverCaptureContext
  odometer: number
  fuelEighths: number
  keyRef?: string
  keyOutcome: 'Returned' | 'Lost'
  keyLostReason?: string
  condition: z.infer<typeof handoverReturnConditionSchema>
  inspection: HandoverV2Inspection[]
  vehiclePhotoRefs: string[]
  signatureEvidenceRef: string
  newDamage: Array<{ x: number; y: number; region: string; templateVersion: number; photoRef?: string; note?: string; state: 'new' }>
}

/** Converts a diagram percentage to the API's normalized physical coordinate. */
export function normalizeDamageCoordinate(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100))
}

/** Loads the Fleet-scoped release and active-custody register. */
export async function getHandoverWorklist(): Promise<HandoverWorkItem[]> {
  return z.array(handoverWorkItemSchema).parse(await apiClient.get('/v1/handovers'))
}

/** Loads the explicit Approved/Active work items used to launch capture flows. */
export async function getHandoverWorkItems(): Promise<HandoverWorkItem[]> {
  return z.array(handoverWorkItemSchema).parse(await apiClient.get('/v1/handovers/work-items'))
}

/** Loads one bounded page of the historical custody register. */
export async function getHandoverRegister(input: HandoverRegisterInput): Promise<HandoverRegister> {
  const query = new URLSearchParams({
    filter: input.filter,
    page: String(input.page),
    pageSize: String(input.pageSize),
    sort: 'ActivityDesc',
  })
  return handoverRegisterSchema.parse(await apiClient.get(`/v1/handovers/register?${query}`))
}

/** Loads the server-authoritative facts and capabilities for one capture route. */
export async function getHandoverCaptureContext(bookingId: string): Promise<HandoverCaptureContext> {
  const query = new URLSearchParams({ bookingId })
  return handoverCaptureContextSchema.parse(await apiClient.get(`/v1/handovers/capture-context?${query}`))
}

/** Stages one private image/signature Blob and returns its opaque evidence ID. */
export async function stageHandoverEvidence(input: {
  file: Blob
  evidenceType: 'VehiclePhoto' | 'DamagePhoto' | 'Signature'
  signerPersonId?: string
  deviceRef?: string
}): Promise<StagedHandoverEvidence> {
  const query = new URLSearchParams({ evidenceType: input.evidenceType })
  if (input.signerPersonId) query.set('signerPersonId', input.signerPersonId)
  if (input.deviceRef) query.set('deviceRef', input.deviceRef)
  return stagedHandoverEvidenceSchema.parse(await apiClient.postRaw(`/v1/handover-evidence/uploads?${query}`, input.file, {
    headers: { 'Content-Type': input.file.type },
  }))
}

/** Opens custody with complete versioned Handover evidence. */
export async function openHandoverV2(input: OpenHandoverV2Input, idempotencyKey: string): Promise<Handover> {
  return handoverSchema.parse(await apiClient.post('/v1/handovers', {
    schemaVersion: 2,
    bookingId: input.context.booking.id,
    employeePersonId: input.context.driver.personId,
    expectedBookingRevision: input.context.booking.revision,
    startOdometer: input.odometer,
    startFuelEighths: input.fuelEighths,
    gpsStatus: input.context.telematics.status,
    keyIssueRef: input.keyRef,
    signatureRef: input.signatureEvidenceRef,
    checklist: [],
    offlineCaptured: false,
    existingDamage: input.existingDamage,
    checklistDefinitionVersion: 1,
    inspection: input.inspection,
    vehiclePhotoRefs: input.vehiclePhotoRefs,
    signatureEvidenceRef: input.signatureEvidenceRef,
    releaseLocationNodeId: input.context.scope.nodeId,
  }, { headers: { 'Idempotency-Key': idempotencyKey } }))
}

/** Completes custody with comparison evidence and an explicit key outcome. */
export async function returnHandoverV2(input: ReturnHandoverV2Input, idempotencyKey: string): Promise<Handover> {
  if (!input.context.handover) throw new Error('active handover context is required')
  return handoverSchema.parse(await apiClient.post(`/v1/handovers/${input.context.handover.id}/return`, {
    schemaVersion: 2,
    expectedHandoverRevision: input.context.handover.revision,
    endOdometer: input.odometer,
    endFuelEighths: input.fuelEighths,
    returnCondition: input.condition,
    keyReturnRef: input.keyOutcome === 'Returned' ? input.keyRef : undefined,
    signatureRef: input.signatureEvidenceRef,
    offlineCaptured: false,
    newDamage: input.newDamage,
    checklistDefinitionVersion: 1,
    inspection: input.inspection,
    returnConditionCode: input.condition,
    keyOutcome: input.keyOutcome,
    keyLostReason: input.keyLostReason,
    vehiclePhotoRefs: input.vehiclePhotoRefs,
    signatureEvidenceRef: input.signatureEvidenceRef,
    returnLocationNodeId: input.context.scope.nodeId,
  }, { headers: { 'Idempotency-Key': idempotencyKey } }))
}

/** Loads the immutable issue-to-return chain and ordered amendments. */
export async function getHandoverChain(handoverId: string): Promise<HandoverChain> {
  return handoverChainSchema.parse(await apiClient.get(`/v1/handovers/${handoverId}/chain`))
}

/** Loads the locked completion receipt for a Returned Handover. */
export async function getHandoverReceipt(handoverId: string): Promise<HandoverReceipt> {
  return handoverReceiptSchema.parse(await apiClient.get(`/v1/handovers/${handoverId}/receipt`))
}

/** Appends one optimistic correction without changing original evidence. */
export async function appendHandoverAmendment(input: { handoverId: string; expectedChainRevision: number; reason: string; evidenceRefs?: string[]; idempotencyKey: string }) {
  return handoverAmendmentSchema.parse(await apiClient.post(`/v1/handovers/${input.handoverId}/amendments`, { expectedChainRevision: input.expectedChainRevision, reason: input.reason, evidenceRefs: input.evidenceRefs ?? [] }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Opens physical custody for an Approved Booking. */
export async function openHandover(item: HandoverWorkItem, input: HandoverCaptureInput, idempotencyKey: string): Promise<Handover> {
  return handoverSchema.parse(await apiClient.post('/v1/handovers', {
    bookingId: item.bookingId,
    employeePersonId: item.driverPersonId,
    startOdometer: input.odometer,
    startFuelEighths: input.fuelEighths,
    keyIssueRef: input.keyRef || undefined,
    signatureRef: input.signatureRef,
    checklist: input.checklist,
    offlineCaptured: false,
    existingDamage: input.damageRegion ? [{
      x: 0.5,
      y: 0.5,
      region: input.damageRegion,
      templateVersion: 1,
      note: input.damageNote || undefined,
      state: 'existing',
    }] : [],
  }, { headers: { 'Idempotency-Key': idempotencyKey } }))
}

/** Records physical return and closes the Active Booking atomically. */
export async function returnHandover(item: HandoverWorkItem, input: HandoverCaptureInput, idempotencyKey: string): Promise<Handover> {
  if (!item.handoverId) throw new Error('active handover id is required')
  return handoverSchema.parse(await apiClient.post(`/v1/handovers/${item.handoverId}/return`, {
    endOdometer: input.odometer,
    endFuelEighths: input.fuelEighths,
    returnCondition: input.condition || undefined,
    keyReturnRef: input.keyRef || undefined,
    signatureRef: input.signatureRef,
    offlineCaptured: false,
    newDamage: input.damageRegion ? [{
      x: 0.5,
      y: 0.5,
      region: input.damageRegion,
      templateVersion: 1,
      note: input.damageNote || undefined,
      state: 'new',
    }] : [],
  }, { headers: { 'Idempotency-Key': idempotencyKey } }))
}
