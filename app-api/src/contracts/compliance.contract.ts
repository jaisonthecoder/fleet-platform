import { z } from 'zod';

/** Request an eligibility decision: can this driver take this vehicle now? */
export const eligibilityRequestSchema = z.object({
  driverPersonId: z.string().uuid(),
  vehicleId: z.string().uuid(),
});
export type EligibilityRequest = z.infer<typeof eligibilityRequestSchema>;

/** The single "can this driver take this vehicle now?" verdict (FR-COMP-10). */
export interface EligibilityResult {
  decision: 'ALLOW' | 'DENY';
  reasons: string[];
  /** "data as of" — the freshness of the underlying HCM-synced person data. */
  dataAsOf: string | null;
  policyVersion: string | null;
}

/** Raise a platform-wide access block on a person. */
export const raiseBlockSchema = z.object({
  personId: z.string().uuid(),
  reason: z.string().min(1),
});
export type RaiseBlock = z.infer<typeof raiseBlockSchema>;

export interface ComplianceItemDto {
  id: string;
  subjectType: string;
  subjectRef: string;
  itemType: string;
  status: string;
  expiryDate: string | null;
}

export interface AccessBlockDto {
  id: string;
  personId: string;
  reason: string;
  active: boolean;
}
