import { z } from 'zod';

/** Handover lifecycle phase. A single record moves Handover → Returned. */
export const handoverPhaseSchema = z.enum(['Handover', 'Returned']);
export type HandoverPhase = z.infer<typeof handoverPhaseSchema>;

/** Stable machine reason codes (localised EN + AR on the client). */
export const HANDOVER_REASON = {
  bookingNotApproved: 'handover-booking-not-approved',
  bookingNotActive: 'handover-booking-not-active',
  employeeMismatch: 'handover-employee-mismatch',
  alreadyOpen: 'handover-already-open',
  alreadyReturned: 'handover-already-returned',
  odometerBackwards: 'handover-odometer-before-start',
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
});
export type DamagePinInput = z.infer<typeof damagePinInputSchema>;

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
