import { z } from 'zod';

/** How the driver of a fine was determined (auditable attribution basis). */
export const attributionBasisSchema = z.enum([
  'substitution-window',
  'booking-active-driver',
  'assigned-driver',
  'unattributed',
]);
export type AttributionBasis = z.infer<typeof attributionBasisSchema>;

export const fineStatusSchema = z.enum(['Recorded', 'Attributed', 'Disputed', 'Recovered', 'Closed']);
export type FineStatus = z.infer<typeof fineStatusSchema>;

export const FINE_REASON = {
  windowInvalid: 'substitution-window-invalid',
  alreadyRecovered: 'fine-already-recovered',
} as const;

/** Record a traffic fine (auto-attributed to the responsible driver). */
export const recordFineSchema = z.object({
  vehicleId: z.string().uuid(),
  eventTimeUtc: z.string().datetime(),
  amount: z.number().min(0),
  currency: z.string().length(3).optional(),
  authority: z.string().min(1).max(120),
  externalRef: z.string().max(120).optional(),
  points: z.number().int().min(0).max(24).optional(),
});
export type RecordFine = z.infer<typeof recordFineSchema>;

/** Record an accident against a vehicle (auto-attributed). */
export const recordAccidentSchema = z.object({
  vehicleId: z.string().uuid(),
  occurredAtUtc: z.string().datetime(),
  description: z.string().min(1).max(2000),
  severity: z.string().max(40).optional(),
});
export type RecordAccident = z.infer<typeof recordAccidentSchema>;

/** Record a minimal recovery instruction for a fine (payroll export is Phase 2 / D13). */
export const recordRecoverySchema = z.object({
  amount: z.number().min(0),
  currency: z.string().length(3).optional(),
  note: z.string().max(500).optional(),
});
export type RecordRecovery = z.infer<typeof recordRecoverySchema>;

/** Record a substitution window (the minimal admin/API entry, P1B-R2-4). */
export const substitutionWindowSchema = z.object({
  substitutePersonId: z.string().uuid(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  reason: z.string().max(500).optional(),
});
export type SubstitutionWindow = z.infer<typeof substitutionWindowSchema>;

export interface FineDto {
  id: string;
  vehicleId: string;
  bookingId: string | null;
  attributedPersonId: string | null;
  attributionBasis: AttributionBasis;
  eventTimeUtc: string;
  amount: string;
  currency: string;
  authority: string;
  status: FineStatus;
  points: number;
  createdAtUtc: string;
}

export interface AccidentDto {
  id: string;
  vehicleId: string;
  attributedPersonId: string | null;
  attributionBasis: AttributionBasis;
  occurredAtUtc: string;
  description: string;
  severity: string | null;
  status: string;
}

export interface SubstitutionWindowDto {
  id: string;
  vehicleId: string;
  substitutePersonId: string;
  windowStart: string;
  windowEnd: string;
  reason: string | null;
}
