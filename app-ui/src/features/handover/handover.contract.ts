import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

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

/** Loads the Fleet-scoped release and active-custody register. */
export async function getHandoverWorklist(): Promise<HandoverWorkItem[]> {
  return z.array(handoverWorkItemSchema).parse(await apiClient.get('/v1/handovers'))
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
