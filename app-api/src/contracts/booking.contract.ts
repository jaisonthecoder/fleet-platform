import { z } from 'zod';

/**
 * Booking lifecycle states (C2 / FR-BOOK). The **active** subset
 * (`PendingApproval`, `Approved`, `Active`) reserves the vehicle: the
 * `booking_no_double_book` `btree_gist` exclusion constraint applies only to
 * those, so a Draft holds nothing and a Declined/Cancelled/Completed booking
 * releases the slot (P1B-R2-1).
 */
export const bookingStatusSchema = z.enum([
  'Draft',
  'PendingApproval',
  'Approved',
  'Active',
  'Completed',
  'Declined',
  'Cancelled',
  'Expired',
  'NoShow',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

/** Stable machine reason codes (localised EN + AR on the client). */
export const BOOKING_REASON = {
  windowInvalid: 'booking-window-invalid',
  windowInPast: 'booking-window-in-past',
  vehicleNotBookable: 'booking-vehicle-not-bookable',
  durationExceedsMax: 'booking-duration-exceeds-max',
  eligibilityDenied: 'booking-eligibility-denied',
  consentRequired: 'booking-consent-required',
  notDraft: 'booking-not-draft',
  notReserved: 'booking-not-reserved',
  driverMismatch: 'booking-consent-driver-mismatch',
  vehicleUnavailable: 'booking-vehicle-unavailable',
  sodSelfApproval: 'sod-01-self-approval',
  noApprover: 'booking-no-approver-resolvable',
  reConsentRequired: 'booking-re-consent-required',
  terminal: 'booking-already-terminal',
  extendNotLater: 'booking-extend-must-be-later',
  onBehalfNotAllowed: 'booking-on-behalf-not-allowed',
  driverNotAllowed: 'booking-driver-not-allowed',
  personInactive: 'booking-person-inactive',
  personScopeMissing: 'booking-person-scope-missing',
} as const;

/** Create a draft booking (FR-BOOK-01). Times are ISO-8601 UTC instants. */
export const createBookingSchema = z.object({
  vehicleId: z.string().uuid(),
  driverPersonId: z.string().uuid(),
  requestedByPersonId: z.string().uuid(),
  pickupAtUtc: z.string().datetime(),
  returnAtUtc: z.string().datetime(),
  destination: z.string().min(1).max(200).optional(),
  purpose: z.string().max(500).optional(),
  passengerCount: z.number().int().min(0).max(100).optional(),
});
export type CreateBooking = z.infer<typeof createBookingSchema>;

/** Sign the mandatory, immutable digital consent (FR-BOOK-07, the hard gate). */
export const signConsentSchema = z.object({
  driverPersonId: z.string().uuid(),
  consentDocumentVersion: z.string().min(1),
  signatureRef: z.string().min(1).optional(),
  ip: z.string().max(64).optional(),
  device: z.string().max(200).optional(),
});
export type SignConsent = z.infer<typeof signConsentSchema>;

/** Approver decision on a submitted booking (routed via the workflow engine). */
export const decideBookingSchema = z.object({
  actorPersonId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED', 'MODIFICATION_REQUESTED']),
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
});
export type DecideBooking = z.infer<typeof decideBookingSchema>;

/** Approver action body (the decision is set by the route: approve/decline/request-changes). */
export const approverActionSchema = z.object({
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
}).strict();
export type ApproverAction = z.infer<typeof approverActionSchema>;

/** Requester modification of vehicle/window (may void consent → re-consent). */
export const modifyBookingSchema = z
  .object({
    actorPersonId: z.string().uuid(),
    vehicleId: z.string().uuid().optional(),
    pickupAtUtc: z.string().datetime().optional(),
    returnAtUtc: z.string().datetime().optional(),
  })
  .refine((d) => d.vehicleId ?? d.pickupAtUtc ?? d.returnAtUtc, {
    message: 'at least one of vehicleId/pickupAtUtc/returnAtUtc is required',
  });
export type ModifyBooking = z.infer<typeof modifyBookingSchema>;

/** Mid-trip extension of an active booking (FR-BOOK-18). */
export const extendBookingSchema = z.object({
  actorPersonId: z.string().uuid(),
  newReturnAtUtc: z.string().datetime(),
});
export type ExtendBooking = z.infer<typeof extendBookingSchema>;

/** Cancel a booking (releases the reservation). */
export const cancelBookingSchema = z.object({
  actorPersonId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type CancelBooking = z.infer<typeof cancelBookingSchema>;

/** Availability query — computed from the same persisted reservation ranges. */
export const availabilityQuerySchema = z.object({
  pickupAtUtc: z.string().datetime(),
  returnAtUtc: z.string().datetime(),
  seatingCapacity: z.coerce.number().int().min(0).optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/** A booking projection returned to callers/tests. */
export interface BookingDto {
  id: string;
  bookingNumber: string | null;
  vehicleId: string;
  driverPersonId: string;
  requestedByPersonId: string;
  status: BookingStatus;
  pickupAtUtc: string;
  returnAtUtc: string;
  reservationStartUtc: string;
  reservationEndUtc: string;
  bufferMinutes: number;
  destination: string | null;
  purpose: string | null;
  passengerCount: number | null;
  consentRecordId: string | null;
  workflowInstanceId: string | null;
  policyVersion: string | null;
  createdAtUtc: string;
}

/** A vehicle offered as available for a requested window. */
export interface AvailableVehicleDto {
  vehicleId: string;
  plate: string;
  bodyTypeCode: string;
  useCategoryCode: string | null;
  seatingCapacity: number | null;
  fuelTypeCode: string | null;
}

/** Lightweight active-person option for self/on-behalf booking. */
export interface BookingPersonDto {
  personId: string;
  fullName: string;
  employeeId: string;
  grade: string | null;
  homeScopeNodeId: string;
  homeScopeName: string;
  isProfessionalDriver: boolean;
  isSelf: boolean;
}

/** A committed consent record pointer. */
export interface ConsentDto {
  id: string;
  bookingId: string;
  driverPersonId: string;
  vehicleId: string;
  consentDocumentVersion: string;
  windowStartUtc: string;
  windowEndUtc: string;
  signedAtUtc: string;
}
