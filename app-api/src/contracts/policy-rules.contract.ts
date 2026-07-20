import { z } from 'zod';

/**
 * The complete Phase-1 PDP rule-type registry (12 governed rule types + the
 * advisory fuel-deviation rule). Each rule type declares a Zod **input schema**
 * (the shape a PEP must supply as `context`), the outcome kind it returns, and
 * whether its production values depend on a governance decision (D-list). The
 * decision tables themselves live as data in `policy_version` / the seed
 * registry — never as hard-coded `if`s (FR-ARC-03).
 */
export const POLICY_RULE_TYPES = [
  'booking-buffer',
  'driver-eligibility',
  'max-booking-duration',
  'booking-approval-chain',
  'entitlement-approval-chain',
  'dedicated-vehicle-eligibility',
  'driver-eligibility-gate',
  'compliance-alert-ladders',
  'hard-block-conditions',
  'fines-hr-threshold',
  'black-point-timeframe',
  'consent-re-consent-tolerance',
  'fuel-deviation-threshold',
] as const;

export type PolicyRuleType = (typeof POLICY_RULE_TYPES)[number];
export const policyRuleTypeSchema = z.enum(POLICY_RULE_TYPES);

/** Rule types whose production values are gated by a governance decision (D-list). */
export const DECISION_GATED_RULE_TYPES: Partial<Record<PolicyRuleType, string>> = {
  'max-booking-duration': 'D3',
  'booking-approval-chain': 'D6',
  'dedicated-vehicle-eligibility': 'D8',
  'compliance-alert-ladders': 'D9',
  'fines-hr-threshold': 'D12',
  'black-point-timeframe': 'D14',
};

// --- Per-rule input (context) schemas ---------------------------------------

export const bookingBufferInput = z.object({
  vehicleClass: z.string().optional(),
  poolNodeId: z.string().optional(),
});

export const driverEligibilityInput = z.object({
  eligible: z.boolean().optional(),
});

export const maxBookingDurationInput = z.object({
  vehicleClass: z.string().optional(),
  grade: z.string().optional(),
});

export const bookingApprovalChainInput = z.object({
  durationHours: z.number().optional(),
  estimatedCost: z.number().optional(),
});

export const entitlementApprovalChainInput = z.object({
  requestType: z.string().optional(),
  grade: z.string().optional(),
});

export const dedicatedVehicleEligibilityInput = z.object({
  gradeEligible: z.boolean().optional(),
  grade: z.string().optional(),
});

export const driverEligibilityGateInput = z.object({
  licenceValid: z.boolean().optional(),
  notBlocked: z.boolean().optional(),
  vehicleDocsValid: z.boolean().optional(),
});

export const complianceAlertLaddersInput = z.object({
  itemType: z.string().optional(),
});

export const hardBlockConditionsInput = z.object({
  registrationExpired: z.boolean().optional(),
  insuranceExpired: z.boolean().optional(),
});

export const finesHrThresholdInput = z.object({
  finesInWindow: z.number().optional(),
});

export const blackPointTimeframeInput = z.object({
  jurisdiction: z.string().optional(),
});

export const consentReConsentToleranceInput = z.object({
  changeType: z.string().optional(),
});

export const fuelDeviationThresholdInput = z.object({
  deviationPercent: z.number().optional(),
});

/** Input schema per rule type (used by PEPs to validate context before evaluate). */
export const POLICY_RULE_INPUT_SCHEMAS: Record<PolicyRuleType, z.ZodTypeAny> = {
  'booking-buffer': bookingBufferInput,
  'driver-eligibility': driverEligibilityInput,
  'max-booking-duration': maxBookingDurationInput,
  'booking-approval-chain': bookingApprovalChainInput,
  'entitlement-approval-chain': entitlementApprovalChainInput,
  'dedicated-vehicle-eligibility': dedicatedVehicleEligibilityInput,
  'driver-eligibility-gate': driverEligibilityGateInput,
  'compliance-alert-ladders': complianceAlertLaddersInput,
  'hard-block-conditions': hardBlockConditionsInput,
  'fines-hr-threshold': finesHrThresholdInput,
  'black-point-timeframe': blackPointTimeframeInput,
  'consent-re-consent-tolerance': consentReConsentToleranceInput,
  'fuel-deviation-threshold': fuelDeviationThresholdInput,
};
