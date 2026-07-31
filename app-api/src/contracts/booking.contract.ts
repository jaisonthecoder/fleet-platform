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
  vehicleCapacityInsufficient: 'booking-vehicle-capacity-insufficient',
  sodSelfApproval: 'sod-01-self-approval',
  noApprover: 'booking-no-approver-resolvable',
  reConsentRequired: 'booking-re-consent-required',
  consentTemplateUnavailable: 'booking-consent-template-unavailable',
  consentVersionChanged: 'booking-consent-version-changed',
  terminal: 'booking-already-terminal',
  activeRequiresReturn: 'booking-active-requires-return',
  extendNotLater: 'booking-extend-must-be-later',
  onBehalfNotAllowed: 'booking-on-behalf-not-allowed',
  onBehalfContractPending: 'booking-on-behalf-scope-contract-pending',
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
  expectedBookingVersion: z.number().int().positive(),
  expectedStepVersion: z.number().int().positive(),
  decision: z.enum(['APPROVED', 'REJECTED', 'MODIFICATION_REQUESTED']),
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
});
export type DecideBooking = z.infer<typeof decideBookingSchema>;

/** Approver action body (the decision is set by the route: approve/decline/request-changes). */
export const approverActionSchema = z.object({
  expectedBookingVersion: z.number().int().positive(),
  expectedStepVersion: z.number().int().positive(),
  reason: z.string().max(500).optional(),
  onBehalfOfPersonId: z.string().uuid().optional(),
}).strict();
export type ApproverAction = z.infer<typeof approverActionSchema>;

/** Requester modification of vehicle/window (may void consent → re-consent). */
export const modifyBookingSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    vehicleId: z.string().uuid().optional(),
    pickupAtUtc: z.string().datetime().optional(),
    returnAtUtc: z.string().datetime().optional(),
  })
  .strict()
  .refine((d) => d.vehicleId ?? d.pickupAtUtc ?? d.returnAtUtc, {
    message: 'at least one of vehicleId/pickupAtUtc/returnAtUtc is required',
  });
export type ModifyBooking = z.infer<typeof modifyBookingSchema>;

/** Mid-trip extension of an active booking (FR-BOOK-18). */
export const extendBookingSchema = z.object({
  expectedRevision: z.number().int().positive(),
  newReturnAtUtc: z.string().datetime(),
}).strict();
export type ExtendBooking = z.infer<typeof extendBookingSchema>;

/** Cancel a booking (releases the reservation). */
export const cancelBookingSchema = z.object({
  expectedRevision: z.number().int().positive(),
  reason: z.string().max(500).optional(),
}).strict();
export type CancelBooking = z.infer<typeof cancelBookingSchema>;

/** Availability query — computed from the same persisted reservation ranges. */
export const availabilityQuerySchema = z.object({
  pickupAtUtc: z.string().datetime(),
  returnAtUtc: z.string().datetime(),
  seatingCapacity: z.coerce.number().int().min(0).optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/** Bounded timeline query used by the Employee Booking page. */
export const availabilityTimelineQuerySchema = z
  .object({
    startAtUtc: z.string().datetime(),
    endAtUtc: z.string().datetime(),
  })
  .superRefine((value, context) => {
    const start = new Date(value.startAtUtc).getTime();
    const end = new Date(value.endAtUtc).getTime();
    if (end <= start) {
      context.addIssue({ code: 'custom', message: 'timeline end must be after start' });
    } else if (end - start > 24 * 60 * 60 * 1000) {
      context.addIssue({ code: 'custom', message: 'timeline window cannot exceed 24 hours' });
    }
  });
export type AvailabilityTimelineQuery = z.infer<typeof availabilityTimelineQuerySchema>;

/** A booking projection returned to callers/tests. */
export interface BookingDto {
  id: string;
  bookingNumber: string | null;
  vehicleId: string;
  driverPersonId: string;
  requestedByPersonId: string;
  beneficiaryPersonId: string | null;
  bookingScopeNodeId: string | null;
  revision: number;
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
  makeCode: string | null;
  modelCode: string | null;
  bodyTypeCode: string;
  useCategoryCode: string | null;
  seatingCapacity: number | null;
  fuelTypeCode: string | null;
  locationName: string | null;
}

/** Privacy-safe occupancy state; no other Booking facts are exposed. */
export interface AvailabilityTimelineDto {
  startAtUtc: string;
  endAtUtc: string;
  rows: Array<{
    vehicleId: string;
    plate: string;
    makeCode: string | null;
    modelCode: string | null;
    bodyTypeCode: string;
    seatingCapacity: number | null;
    fuelTypeCode: string | null;
    locationName: string;
    segments: Array<{
      startAtUtc: string;
      endAtUtc: string;
      state: 'OPEN' | 'OWN' | 'UNAVAILABLE';
    }>;
  }>;
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

/** Server-derived Booking entry context; gated modes never rely on client role inference. */
export interface BookingContextDto {
  actor: {
    personId: string;
    fullName: string;
    email: string | null;
    roles: string[];
  };
  modes: {
    self: { enabled: boolean; blockingReasons: string[] };
    onBehalf: { enabled: boolean; blockingReasons: string[] };
    emergency: { enabled: false; blockingReasons: string[] };
  };
  defaults: {
    requestedByPersonId: string;
    driverPersonId: string;
    scopeNodeId: string | null;
    scopeName: string | null;
  };
  consent: {
    status: 'PENDING_APPROVAL' | 'AVAILABLE' | 'UNAVAILABLE';
    version: string | null;
    contentHash: string | null;
    effectiveAtUtc: string | null;
    content: { en: string; ar: string } | null;
  };
  dependencies: Array<{
    key: 'vehicleAvailability' | 'eligibility' | 'consentTemplate';
    status: 'AVAILABLE' | 'PENDING_APPROVAL' | 'UNAVAILABLE';
  }>;
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

/** Actor-relative requester relationship; never hardcode "reports to you". */
export const bookingApprovalRelationshipSchema = z.enum([
  'DIRECT_MANAGER',
  'DELEGATE',
  'WORKFLOW_ASSIGNEE',
  'FLEET_AUTHORITY',
]);
export type BookingApprovalRelationship = z.infer<typeof bookingApprovalRelationshipSchema>;

/** Safe evidence categories rendered as the screen-25 verdict stack. */
export const bookingApprovalEvidenceKindSchema = z.enum([
  'Eligibility',
  'Consent',
  'Reservation',
  'Forecast',
]);
export type BookingApprovalEvidenceKind = z.infer<typeof bookingApprovalEvidenceKindSchema>;

/** Stable evidence state without raw HR, signature, device or policy internals. */
export const bookingApprovalEvidenceStatusSchema = z.enum([
  'VERIFIED',
  'SIGNED',
  'HELD',
  'AVAILABLE',
  'NOT_CONFIGURED',
  'UNAVAILABLE',
]);
export type BookingApprovalEvidenceStatus = z.infer<typeof bookingApprovalEvidenceStatusSchema>;

/** Availability of optional governed cost/forecast providers. */
export const bookingApprovalProviderStatusSchema = z.enum([
  'AVAILABLE',
  'NOT_CONFIGURED',
  'UNAVAILABLE',
]);
export type BookingApprovalProviderStatus = z.infer<typeof bookingApprovalProviderStatusSchema>;

export const bookingApprovalEvidenceItemSchema = z.object({
  kind: bookingApprovalEvidenceKindSchema,
  status: bookingApprovalEvidenceStatusSchema,
  reasonCodes: z.array(z.string().min(1).max(120)).max(20),
  occurredAtUtc: z.string().datetime().nullable(),
  version: z.string().min(1).max(120).nullable(),
}).strict();
export type BookingApprovalEvidenceItemDto = z.infer<typeof bookingApprovalEvidenceItemSchema>;

export const bookingApprovalRequesterSchema = z.object({
  fullName: z.string().min(1).max(200),
  employeeId: z.string().min(1).max(120),
  relationshipCode: bookingApprovalRelationshipSchema,
  behavior: z.object({
    year: z.number().int().min(2000).max(9999),
    bookingCount: z.number().int().min(0),
    noShowCount: z.number().int().min(0),
    lateReturnCount: z.number().int().min(0),
  }).strict(),
}).strict();
export type BookingApprovalRequesterDto = z.infer<typeof bookingApprovalRequesterSchema>;

export const bookingApprovalOptionalProviderSchema = z.object({
  status: bookingApprovalProviderStatusSchema,
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/).nullable(),
  currency: z.string().length(3).nullable(),
  utilizationPercent: z.number().min(0).max(100).nullable(),
  suggestedStartAtUtc: z.string().datetime().nullable(),
  reasonCodes: z.array(z.string().min(1).max(120)).max(20),
}).strict().superRefine((value, context) => {
  if (value.status !== 'AVAILABLE' && [value.amount, value.currency, value.utilizationPercent, value.suggestedStartAtUtc].some((field) => field !== null)) {
    context.addIssue({ code: 'custom', message: 'unavailable provider cannot expose values' });
  }
});
export type BookingApprovalOptionalProviderDto = z.infer<typeof bookingApprovalOptionalProviderSchema>;

export interface BookingApprovalWorkItemDto {
  bookingId: string;
  bookingNumber: string;
  requesterName: string;
  vehicle: { plate: string; makeCode: string | null; modelCode: string | null };
  pickupAtUtc: string;
  returnAtUtc: string;
  purpose: string | null;
  passengerCount: number | null;
  consentVersion: string;
  workflowStepId: string;
  expectedBookingVersion: number;
  expectedStepVersion: number;
  dueAtUtc: string | null;
  delegated: boolean;
  evidence: {
    eligibility: 'VERIFIED_AT_CONSENT';
    consent: 'SIGNED';
    reservation: 'HELD';
    forecast: 'NOT_AVAILABLE';
  };
  /** HAPR additive projection retained as optional until the frontend cutover. */
  requester?: BookingApprovalRequesterDto;
  destination?: string | null;
  durationMinutes?: number;
  justification?: string | null;
  evidenceItems?: BookingApprovalEvidenceItemDto[];
  cost?: BookingApprovalOptionalProviderDto;
  forecast?: BookingApprovalOptionalProviderDto;
}

export interface BookingPreparationItemDto {
  bookingId: string;
  bookingNumber: string;
  vehiclePlate: string;
  pickupAtUtc: string;
  returnAtUtc: string;
  scopeName: string | null;
  readiness: 'AWAITING_HANDOVER';
}

export interface MyBookingDto extends BookingDto {
  vehicle: {
    plate: string;
    makeCode: string | null;
    modelCode: string | null;
    bodyTypeCode: string;
    fuelTypeCode: string | null;
    seatingCapacity: number | null;
  };
  scopeName: string | null;
  capabilities: {
    consent: boolean;
    modify: boolean;
    extend: boolean;
    cancel: boolean;
    returnVehicle: boolean;
  };
}
