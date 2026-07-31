import { z } from 'zod';

/** Handover lifecycle phase. A single record moves Handover → Returned. */
export const handoverPhaseSchema = z.enum(['Handover', 'Returned']);
export type HandoverPhase = z.infer<typeof handoverPhaseSchema>;

/** Stable capture phases used by inspection, evidence and signature records. */
export const handoverCapturePhaseSchema = z.enum(['Handover', 'Return']);
export type HandoverCapturePhase = z.infer<typeof handoverCapturePhaseSchema>;

/** Versioned fixed checklist codes from the approved walkaround mockup. */
export const handoverChecklistCodeSchema = z.enum([
  'body',
  'tyres',
  'lights',
  'assets',
  'cabin',
]);
export type HandoverChecklistCode = z.infer<typeof handoverChecklistCodeSchema>;

/** A decided checklist outcome; undecided items are omitted from commands. */
export const handoverInspectionVerdictSchema = z.enum(['Pass', 'Fail']);
export type HandoverInspectionVerdict = z.infer<typeof handoverInspectionVerdictSchema>;

/** Governed return-condition vocabulary rendered through EN/AR labels. */
export const handoverReturnConditionSchema = z.enum([
  'Good',
  'MinorWear',
  'DamageNoted',
]);
export type HandoverReturnCondition = z.infer<typeof handoverReturnConditionSchema>;

/** Key outcomes captured by Return; lost keys remain open for review. */
export const handoverKeyOutcomeSchema = z.enum(['Returned', 'Lost']);
export type HandoverKeyOutcome = z.infer<typeof handoverKeyOutcomeSchema>;

/** Evidence categories supported by the staged evidence store. */
export const handoverEvidenceTypeSchema = z.enum([
  'VehiclePhoto',
  'DamagePhoto',
  'Signature',
]);
export type HandoverEvidenceType = z.infer<typeof handoverEvidenceTypeSchema>;

/** Lifecycle of an uploaded object reference before and after command claim. */
export const handoverEvidenceStatusSchema = z.enum(['Staged', 'Claimed', 'Expired']);
export type HandoverEvidenceStatus = z.infer<typeof handoverEvidenceStatusSchema>;

/** Register filters shown by approved screen 26. */
export const handoverRegisterFilterSchema = z.enum([
  'All',
  'OnTrip',
  'ChargesDamage',
  'OnTime',
]);
export type HandoverRegisterFilter = z.infer<typeof handoverRegisterFilterSchema>;

/** Source-derived status signals; labels and priority remain client-localized. */
export const handoverRegisterSignalSchema = z.enum([
  'ON_TRIP',
  'ON_TIME',
  'LATE',
  'DAMAGE_REVIEW',
  'KEY_REVIEW',
  'FINE_ATTACHED',
  'RECONCILIATION_REVIEW',
]);
export type HandoverRegisterSignal = z.infer<typeof handoverRegisterSignalSchema>;

/** Availability state for optional charge/fine integrations. */
export const handoverProviderStatusSchema = z.enum([
  'AVAILABLE',
  'NOT_CONFIGURED',
  'UNAVAILABLE',
]);
export type HandoverProviderStatus = z.infer<typeof handoverProviderStatusSchema>;

/** Stable machine reason codes (localised EN + AR on the client). */
export const HANDOVER_REASON = {
  bookingNotApproved: 'handover-booking-not-approved',
  bookingNotActive: 'handover-booking-not-active',
  employeeMismatch: 'handover-employee-mismatch',
  alreadyOpen: 'handover-already-open',
  alreadyReturned: 'handover-already-returned',
  odometerBackwards: 'handover-odometer-before-start',
  idempotencyRequired: 'handover-idempotency-key-required',
  idempotencyReused: 'handover-idempotency-key-reused',
  commandInProgress: 'handover-command-in-progress',
  inspectionIncomplete: 'handover-inspection-incomplete',
  failedInspectionEvidenceRequired: 'handover-failed-inspection-evidence-required',
  evidenceNotOwned: 'handover-evidence-not-owned',
  evidenceExpired: 'handover-evidence-expired',
  evidenceAlreadyClaimed: 'handover-evidence-already-claimed',
  evidenceMissing: 'handover-evidence-missing',
  keyLostReasonRequired: 'handover-key-lost-reason-required',
  amendmentRevisionConflict: 'handover-amendment-revision-conflict',
} as const;

const fuelEighths = z.number().int().min(0).max(8);

/** A walkaround checklist line. */
export const checklistItemSchema = z.object({
  item: z.string().min(1).max(120),
  pass: z.boolean(),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

/** A damage pin (normalized coordinates 0..1 over a template-versioned diagram). */
export const damagePinInputSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  region: z.string().min(1).max(60),
  templateVersion: z.number().int().min(1).default(1),
  photoRef: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
  state: z.enum(['existing', 'new']).default('new'),
  carriedFromDamagePinId: z.string().uuid().optional(),
});
export type DamagePinInput = z.infer<typeof damagePinInputSchema>;

/** One versioned inspection result with evidence required for failed checks. */
export const handoverInspectionInputSchema = z.object({
  code: handoverChecklistCodeSchema,
  verdict: handoverInspectionVerdictSchema,
  note: z.string().trim().min(1).max(500).optional(),
  evidenceRefs: z.array(z.string().uuid()).max(10).default([]),
}).superRefine((value, context) => {
  if (value.verdict === 'Fail' && (!value.note || value.evidenceRefs.length === 0)) {
    context.addIssue({
      code: 'custom',
      message: HANDOVER_REASON.failedInspectionEvidenceRequired,
    });
  }
});
export type HandoverInspectionInput = z.infer<typeof handoverInspectionInputSchema>;

/** Metadata returned after a private evidence object is durably staged. */
export const stagedHandoverEvidenceSchema = z.object({
  id: z.string().uuid(),
  evidenceRef: z.string().min(1).max(512),
  evidenceType: handoverEvidenceTypeSchema,
  status: z.literal('Staged'),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  mimeType: z.enum(['image/jpeg', 'image/png']),
  sizeBytes: z.number().int().positive(),
  expiresAtUtc: z.string().datetime(),
});
export type StagedHandoverEvidence = z.infer<typeof stagedHandoverEvidenceSchema>;

/** Strict metadata query accompanying a raw JPEG/PNG evidence upload body. */
export const stageHandoverEvidenceQuerySchema = z.object({
  evidenceType: z.enum(['VehiclePhoto', 'DamagePhoto', 'Signature']),
  signerPersonId: z.string().uuid().optional(),
  deviceRef: z.string().trim().min(1).max(200).optional(),
}).strict();
export type StageHandoverEvidenceQuery = z.infer<typeof stageHandoverEvidenceQuerySchema>;

/** Open a handover for an approved booking (FR-HAND-01..03). */
export const openHandoverSchema = z.object({
  bookingId: z.string().uuid(),
  employeePersonId: z.string().uuid(),
  startOdometer: z.number().min(0),
  startFuelEighths: fuelEighths,
  gpsStatus: z.string().max(40).optional(),
  keyIssueRef: z.string().max(120).optional(),
  signatureRef: z.string().min(1),
  checklist: z.array(checklistItemSchema).default([]),
  offlineCaptured: z.boolean().default(false),
  existingDamage: z.array(damagePinInputSchema).default([]),
});
export type OpenHandover = z.infer<typeof openHandoverSchema>;

/** HAPR v2 Open command; legacy Open remains valid through the compatibility API. */
export const openHandoverV2Schema = openHandoverSchema.extend({
  schemaVersion: z.literal(2),
  expectedBookingRevision: z.number().int().positive(),
  checklistDefinitionVersion: z.number().int().positive(),
  inspection: z.array(handoverInspectionInputSchema).length(5),
  vehiclePhotoRefs: z.array(z.string().uuid()).max(12).default([]),
  signatureEvidenceRef: z.string().uuid(),
  releaseLocationNodeId: z.string().uuid(),
}).strict().superRefine((value, context) => {
  const codes = new Set(value.inspection.map(({ code }) => code));
  if (codes.size !== handoverChecklistCodeSchema.options.length) {
    context.addIssue({ code: 'custom', message: HANDOVER_REASON.inspectionIncomplete });
  }
});
export type OpenHandoverV2 = z.infer<typeof openHandoverV2Schema>;

/**
 * Record the return (FR-HAND-04..07, 11). Fuel deviation is advisory only.
 * `telematicsOdometer` is a fallback for offline capture — the authoritative
 * value is the vehicle's telematics-maintained last-confirmed odometer.
 */
export const recordReturnSchema = z.object({
  endOdometer: z.number().min(0),
  endFuelEighths: fuelEighths,
  returnCondition: z.string().max(500).optional(),
  keyReturnRef: z.string().max(120).optional(),
  signatureRef: z.string().min(1),
  observedFuelConsumedLitres: z.number().min(0).optional(),
  telematicsOdometer: z.number().min(0).optional(),
  offlineCaptured: z.boolean().default(false),
  newDamage: z.array(damagePinInputSchema).default([]),
});
export type RecordReturn = z.infer<typeof recordReturnSchema>;

/** HAPR v2 Return command with comparison evidence and explicit key outcome. */
export const recordReturnV2Schema = recordReturnSchema.extend({
  schemaVersion: z.literal(2),
  expectedHandoverRevision: z.number().int().positive(),
  checklistDefinitionVersion: z.number().int().positive(),
  inspection: z.array(handoverInspectionInputSchema).length(5),
  returnConditionCode: handoverReturnConditionSchema,
  keyOutcome: handoverKeyOutcomeSchema,
  keyLostReason: z.string().trim().min(1).max(500).optional(),
  vehiclePhotoRefs: z.array(z.string().uuid()).max(12).default([]),
  signatureEvidenceRef: z.string().uuid(),
  returnLocationNodeId: z.string().uuid(),
}).strict().superRefine((value, context) => {
  const codes = new Set(value.inspection.map(({ code }) => code));
  if (codes.size !== handoverChecklistCodeSchema.options.length) {
    context.addIssue({ code: 'custom', message: HANDOVER_REASON.inspectionIncomplete });
  }
  if (value.keyOutcome === 'Lost' && !value.keyLostReason) {
    context.addIssue({ code: 'custom', message: HANDOVER_REASON.keyLostReasonRequired });
  }
});
export type RecordReturnV2 = z.infer<typeof recordReturnV2Schema>;

/** Add a single damage pin to an existing handover. */
export const addDamageSchema = damagePinInputSchema;
export type AddDamage = z.infer<typeof addDamageSchema>;

export interface DamagePinDto {
  id: string;
  x: number;
  y: number;
  region: string;
  templateVersion: number;
  photoRef: string | null;
  note: string | null;
  state: string;
  atUtc: string;
}

export interface HandoverDto {
  schemaVersion?: 1 | 2;
  id: string;
  bookingId: string;
  vehicleId: string;
  driverPersonId: string;
  phase: HandoverPhase;
  handoverAtUtc: string;
  startOdometer: string;
  startFuelEighths: number;
  gpsStatus: string | null;
  keyIssueRef: string | null;
  offlineCaptured: boolean;
  returnAtUtc: string | null;
  endOdometer: string | null;
  endFuelEighths: number | null;
  returnCondition: string | null;
  keyReturnRef: string | null;
  expectedFuelConsumedLitres: string | null;
  actualFuelConsumedLitres: string | null;
  fuelDeviationPercent: string | null;
  fuelDeviationFlagged: boolean;
  odometerConflict: boolean;
  lateReturn: boolean;
  damage: DamagePinDto[];
}

export interface KeyLogDto {
  id: string;
  vehicleId: string;
  handoverId: string | null;
  custodyState: string;
  keyRef: string | null;
  personId: string | null;
  atUtc: string;
}

export interface HandoverWorkItemDto {
  bookingId: string;
  bookingNumber: string;
  handoverId: string | null;
  phase: 'AwaitingHandover' | 'ActiveCustody';
  vehicleId: string;
  vehiclePlate: string;
  driverPersonId: string;
  driverName: string;
  pickupAtUtc: string;
  returnAtUtc: string;
  scopeName: string | null;
}

/** Strict bounded query for the historical custody register. */
export const handoverRegisterQuerySchema = z.object({
  filter: handoverRegisterFilterSchema.default('All'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
  sort: z.enum(['ActivityDesc']).default('ActivityDesc'),
}).strict();
export type HandoverRegisterQuery = z.infer<typeof handoverRegisterQuerySchema>;

export interface HandoverRegisterRowDto {
  handoverId: string | null;
  bookingId: string;
  bookingNumber: string;
  driverName: string;
  vehicle: { id: string; plate: string; makeCode: string | null; modelCode: string | null };
  issuedAtUtc: string | null;
  returnedAtUtc: string | null;
  distanceKm: string | null;
  chargeSummary: {
    status: HandoverProviderStatus;
    amount: string | null;
    currency: string | null;
    labels: string[];
  };
  primaryStatus: HandoverRegisterSignal;
  signals: HandoverRegisterSignal[];
  capabilities: { view: boolean; editOpenCustody: boolean; returnVehicle: boolean };
  activityAtUtc: string;
}

export interface HandoverRegisterDto {
  items: HandoverRegisterRowDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface HandoverCaptureContextDto {
  schemaVersion: 2;
  booking: {
    id: string;
    number: string;
    revision: number;
    status: string;
    pickupAtUtc: string;
    returnAtUtc: string;
  };
  vehicle: {
    id: string;
    plate: string;
    makeCode: string | null;
    modelCode: string | null;
  };
  driver: { personId: string; fullName: string };
  scope: { nodeId: string; name: string };
  consent: { version: string; signedAtUtc: string };
  eligibility: { status: 'VERIFIED' | 'UNAVAILABLE'; reasonCodes: string[]; evaluatedAtUtc: string | null };
  telematics: {
    status: 'MATCHED' | 'STALE' | 'UNAVAILABLE';
    odometer: string | null;
    observedAtUtc: string | null;
  };
  handover: {
    id: string;
    revision: number;
    phase: HandoverPhase;
    issuedAtUtc: string;
    startOdometer: string;
    startFuelEighths: number;
    keyIssueRef: string | null;
    releaseLocation: { nodeId: string | null; code: string | null; name: string | null };
  } | null;
  carriedDamage: DamagePinDto[];
  capabilities: { handover: boolean; return: boolean; amendOpenCustody: boolean };
}

export interface HandoverChainDto {
  schemaVersion: 2;
  handover: HandoverDto;
  inspections: Array<{
    capturePhase: HandoverCapturePhase;
    definitionVersion: number;
    code: HandoverChecklistCode;
    verdict: HandoverInspectionVerdict;
    note: string | null;
    evidenceRefs: string[];
  }>;
  evidenceRefs: string[];
  keys: KeyLogDto[];
  amendments: Array<{
    id: string;
    revision: number;
    reason: string;
    actorPersonId: string;
    atUtc: string;
  }>;
  chainRevision: number;
  evidenceCompleteness: 'Complete' | 'LegacyPartial';
}

/** Append-only correction request for a completed or open custody chain. */
export const createHandoverAmendmentSchema = z.object({
  expectedChainRevision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  evidenceRefs: z.array(z.string().uuid()).max(20).default([]),
}).strict();
export type CreateHandoverAmendment = z.infer<typeof createHandoverAmendmentSchema>;

export interface HandoverAmendmentDto {
  schemaVersion: 2;
  id: string;
  handoverId: string;
  revision: number;
  reason: string;
  evidenceRefs: string[];
  actorPersonId: string;
  atUtc: string;
}

export interface HandoverReceiptDto {
  schemaVersion: 2;
  handoverId: string;
  bookingId: string;
  bookingNumber: string;
  bookingStatus: 'Completed';
  returnedAtUtc: string;
  releaseLocation: { nodeId: string | null; code: string | null; name: string | null };
  returnLocation: { nodeId: string | null; code: string | null; name: string | null };
  odometer: { start: string; end: string; distanceKm: string; verdict: 'MATCHED' | 'ADVISORY' | 'CONFLICT' };
  fuel: { startEighths: number; endEighths: number; deviationPercent: string | null; verdict: 'MATCHED' | 'ADVISORY' | 'UNAVAILABLE' };
  key: { outcome: 'Returned' | 'LostReviewRequired' | 'Unknown'; reviewReference: string | null };
  damage: { carriedCount: number; newCount: number; reviewRequired: boolean };
  timing: { late: boolean };
  evidenceRefs: string[];
  evidenceCompleteness: 'Complete' | 'LegacyPartial';
}
