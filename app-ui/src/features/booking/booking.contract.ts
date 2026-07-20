import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const availableVehicleSchema = z.object({
  vehicleId: z.string().uuid(),
  plate: z.string(),
  bodyTypeCode: z.string(),
  useCategoryCode: z.string().nullable(),
  seatingCapacity: z.number().int().nullable(),
  fuelTypeCode: z.string().nullable(),
})
export type AvailableVehicle = z.infer<typeof availableVehicleSchema>

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
  createdAtUtc: z.string(),
})
export type Booking = z.infer<typeof bookingSchema>

export interface BookingSearchInput {
  pickupAtUtc: string
  returnAtUtc: string
  seatingCapacity?: number
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

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post('/v1/bookings', input))
}

export async function signBookingConsent(bookingId: string, driverPersonId: string): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post(`/v1/bookings/${bookingId}/consent`, {
    driverPersonId,
    consentDocumentVersion: 'booking-consent-v1',
    signatureRef: `ui-confirmed:${new Date().toISOString()}`,
    device: navigator.userAgent.slice(0, 200),
  }))
}

export async function submitBooking(bookingId: string): Promise<Booking> {
  return bookingSchema.parse(await apiClient.post(`/v1/bookings/${bookingId}/submit`))
}
