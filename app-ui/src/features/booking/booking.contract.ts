import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const availableVehicleSchema = z.object({
  vehicleId: z.string().uuid(),
  plate: z.string(),
  makeCode: z.string().nullable(),
  modelCode: z.string().nullable(),
  bodyTypeCode: z.string(),
  useCategoryCode: z.string().nullable(),
  seatingCapacity: z.number().int().nullable(),
  fuelTypeCode: z.string().nullable(),
  locationName: z.string().nullable(),
})
export type AvailableVehicle = z.infer<typeof availableVehicleSchema>

export const bookingContextSchema = z.object({
  actor: z.object({
    personId: z.string().uuid(),
    fullName: z.string(),
    email: z.string().nullable(),
    roles: z.array(z.string()),
  }),
  modes: z.object({
    self: z.object({ enabled: z.boolean(), blockingReasons: z.array(z.string()) }),
    onBehalf: z.object({ enabled: z.boolean(), blockingReasons: z.array(z.string()) }),
    emergency: z.object({ enabled: z.literal(false), blockingReasons: z.array(z.string()) }),
  }),
  defaults: z.object({
    requestedByPersonId: z.string().uuid(),
    driverPersonId: z.string().uuid(),
    scopeNodeId: z.string().uuid().nullable(),
    scopeName: z.string().nullable(),
  }),
  consent: z.object({
    status: z.enum(['PENDING_APPROVAL', 'AVAILABLE', 'UNAVAILABLE']),
    version: z.string().nullable(),
    contentHash: z.string().nullable(),
    effectiveAtUtc: z.string().nullable(),
    content: z.object({ en: z.string(), ar: z.string() }).nullable().optional().default(null),
  }),
  dependencies: z.array(z.object({
    key: z.enum(['vehicleAvailability', 'eligibility', 'consentTemplate']),
    status: z.enum(['AVAILABLE', 'PENDING_APPROVAL', 'UNAVAILABLE']),
  })),
})
export type BookingContext = z.infer<typeof bookingContextSchema>

export const bookingPersonSchema = z.object({
  personId: z.string().uuid(),
  fullName: z.string(),
  employeeId: z.string(),
  grade: z.string().nullable(),
  homeScopeNodeId: z.string().uuid(),
  homeScopeName: z.string(),
  isProfessionalDriver: z.boolean(),
  isSelf: z.boolean(),
})
export type BookingPerson = z.infer<typeof bookingPersonSchema>

export const availabilityTimelineSchema = z.object({
  startAtUtc: z.string().datetime(),
  endAtUtc: z.string().datetime(),
  rows: z.array(z.object({
    vehicleId: z.string().uuid(),
    plate: z.string(),
    makeCode: z.string().nullable(),
    modelCode: z.string().nullable(),
    bodyTypeCode: z.string(),
    seatingCapacity: z.number().int().nullable(),
    fuelTypeCode: z.string().nullable(),
    locationName: z.string(),
    segments: z.array(z.object({
      startAtUtc: z.string().datetime(),
      endAtUtc: z.string().datetime(),
      state: z.enum(['OPEN', 'OWN', 'UNAVAILABLE']),
    })),
  })),
})
export type AvailabilityTimeline = z.infer<typeof availabilityTimelineSchema>

export const bookingSchema = z.object({
  id: z.string().uuid(),
  bookingNumber: z.string().nullable(),
  vehicleId: z.string().uuid(),
  driverPersonId: z.string(),
  requestedByPersonId: z.string(),
  status: z.enum(['Draft', 'PendingApproval', 'Approved', 'Active', 'Completed', 'Declined', 'Cancelled', 'Expired', 'NoShow']),
  pickupAtUtc: z.string(),
  returnAtUtc: z.string(),
  reservationStartUtc: z.string(),
  reservationEndUtc: z.string(),
  bufferMinutes: z.number(),
  destination: z.string().nullable(),
  purpose: z.string().nullable(),
  passengerCount: z.number().nullable(),
  consentRecordId: z.string().nullable(),
  workflowInstanceId: z.string().nullable(),
  policyVersion: z.string().nullable(),
  revision: z.number().int().positive().default(1),
  createdAtUtc: z.string(),
})
export type Booking = z.infer<typeof bookingSchema>

export const myBookingSchema = bookingSchema.extend({
  vehicle: z.object({
    plate: z.string(),
    makeCode: z.string().nullable(),
    modelCode: z.string().nullable(),
    bodyTypeCode: z.string(),
    fuelTypeCode: z.string().nullable(),
    seatingCapacity: z.number().int().nullable(),
  }),
  scopeName: z.string().nullable(),
  capabilities: z.object({
    consent: z.boolean(),
    modify: z.boolean(),
    extend: z.boolean(),
    cancel: z.boolean(),
    returnVehicle: z.boolean(),
  }),
})
export type MyBooking = z.infer<typeof myBookingSchema>

export const bookingEventSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  eventType: z.string(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  actorRef: z.string().nullable(),
  atUtc: z.string(),
})
export type BookingEvent = z.infer<typeof bookingEventSchema>

export interface BookingSearchInput {
  pickupAtUtc: string
  returnAtUtc: string
  seatingCapacity?: number
}

export interface AvailabilityTimelineInput {
  startAtUtc: string
  endAtUtc: string
}

export interface CreateBookingInput extends BookingSearchInput {
  vehicleId: string
  driverPersonId: string
  requestedByPersonId: string
  destination?: string
  passengerCount?: number
}

export async function searchAvailableVehicles(input: BookingSearchInput): Promise<AvailableVehicle[]> {
  const query = new URLSearchParams({ pickupAtUtc: input.pickupAtUtc, returnAtUtc: input.returnAtUtc })
  if (input.seatingCapacity !== undefined) query.set('seatingCapacity', String(input.seatingCapacity))
  return z.array(availableVehicleSchema).parse(await apiClient.get(`/v1/vehicles/available?${query}`))
}

/** Loads the authenticated Booking entry context. */
export async function getBookingContext(): Promise<BookingContext> {
  return bookingContextSchema.parse(await apiClient.get('/v1/bookings/context'))
}

/** Loads active people covered by the caller's persisted role and hierarchy assignments. */
export async function getBookablePeople(): Promise<BookingPerson[]> {
  return z.array(bookingPersonSchema).parse(await apiClient.get('/v1/bookings/people'))
}

/** Loads only the authenticated person's requested/driver Bookings. */
export async function getMyBookings(): Promise<MyBooking[]> {
  return z.array(myBookingSchema).parse(await apiClient.get('/v1/bookings'))
}

/** Loads privacy-safe scoped occupancy without other-user Booking facts. */
export async function getAvailabilityTimeline(input: AvailabilityTimelineInput): Promise<AvailabilityTimeline> {
  const query = new URLSearchParams({ startAtUtc: input.startAtUtc, endAtUtc: input.endAtUtc })
  return availabilityTimelineSchema.parse(
    await apiClient.get(`/v1/vehicles/availability-timeline?${query}`),
  )
}

export async function createBooking(input: CreateBookingInput, idempotencyKey: string): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post('/v1/bookings', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  }))
}

export async function getBooking(bookingId: string): Promise<Booking> {
  return bookingSchema.parse(await apiClient.get(`/v1/bookings/${bookingId}`))
}

/** Loads the owner-authorized append-only Booking chronology. */
export async function getBookingEvents(bookingId: string): Promise<BookingEvent[]> {
  return z.array(bookingEventSchema).parse(
    await apiClient.get(`/v1/bookings/${bookingId}/events`),
  )
}

/** Modifies an owner Booking using optimistic revision and durable replay evidence. */
export async function modifyBooking(input: {
  bookingId: string
  expectedRevision: number
  pickupAtUtc: string
  returnAtUtc: string
  idempotencyKey: string
}): Promise<Booking> {
  return bookingSchema.parse(await apiClient.patch(`/v1/bookings/${input.bookingId}`, {
    expectedRevision: input.expectedRevision,
    pickupAtUtc: input.pickupAtUtc,
    returnAtUtc: input.returnAtUtc,
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Extends an Approved/Active Booking using optimistic revision and replay evidence. */
export async function extendBooking(input: {
  bookingId: string
  expectedRevision: number
  newReturnAtUtc: string
  idempotencyKey: string
}): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post(`/v1/bookings/${input.bookingId}/extend`, {
    expectedRevision: input.expectedRevision,
    newReturnAtUtc: input.newReturnAtUtc,
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Cancels a pre-custody owner Booking with durable command evidence. */
export async function cancelBooking(input: {
  bookingId: string
  expectedRevision: number
  reason: string
  idempotencyKey: string
}): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post(`/v1/bookings/${input.bookingId}/cancel`, {
    expectedRevision: input.expectedRevision,
    reason: input.reason,
  }, { headers: { 'Idempotency-Key': input.idempotencyKey } }))
}

/** Signs the exact server-projected template using a stable retry key. */
export async function signBookingConsent(
  bookingId: string,
  driverPersonId: string,
  consentDocumentVersion: string,
  idempotencyKey: string,
): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post(`/v1/bookings/${bookingId}/consent`, {
    driverPersonId,
    consentDocumentVersion,
    signatureRef: 'ui-typed-name-agreement',
    device: navigator.userAgent.slice(0, 200),
  }, { headers: { 'Idempotency-Key': idempotencyKey } }))
}

/** Submits one reserved Booking using a stable retry key. */
export async function submitBooking(bookingId: string, idempotencyKey: string): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post(
    `/v1/bookings/${bookingId}/submit`,
    undefined,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  ))
}
