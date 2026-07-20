import { POLICY_RULE_TYPES } from '../../../contracts/policy-rules.contract';
import { evaluateTable } from './decision-table';
import { PolicyRegistryService } from './policy-registry';

/**
 * Decision-table tests for all 12 governed rule types (+ the advisory fuel
 * rule). Each asserts a representative matched row, the mandatory safe default,
 * and — for gated fixtures — that the seed is clearly marked `fixture-`.
 */
describe('Phase-1 PDP rule tables', () => {
  const registry = new PolicyRegistryService();
  const evalRule = (ruleType: string, context: Record<string, unknown>) =>
    evaluateTable(registry.getActive(ruleType)!, context);

  it('registers every declared rule type', () => {
    for (const ruleType of POLICY_RULE_TYPES) {
      expect(registry.getActive(ruleType)).toBeDefined();
    }
  });

  it('booking-buffer: executive row vs default', () => {
    expect(evalRule('booking-buffer', { vehicleClass: 'executive' }).value).toBe(30);
    expect(evalRule('booking-buffer', {}).value).toBe(15);
  });

  it('max-booking-duration: class rows + restrictive default (D3 fixture)', () => {
    expect(evalRule('max-booking-duration', { vehicleClass: 'executive' }).value).toBe(168);
    expect(evalRule('max-booking-duration', { vehicleClass: 'pool' }).value).toBe(24);
    expect(evalRule('max-booking-duration', {}).value).toBe(24);
    expect(registry.getActive('max-booking-duration')!.version).toMatch(/^fixture-/);
  });

  it('booking-approval-chain: first-match by duration, default routes to line manager (D6 fixture)', () => {
    expect(evalRule('booking-approval-chain', { durationHours: 2 }).route).toEqual(['LineManager']);
    expect(evalRule('booking-approval-chain', { durationHours: 48 }).route).toEqual([
      'LineManager',
      'FleetManager',
    ]);
    expect(evalRule('booking-approval-chain', { durationHours: 10 }).route).toEqual(['LineManager']);
  });

  it('entitlement-approval-chain: routes up to Cluster CEO', () => {
    const result = evalRule('entitlement-approval-chain', { requestType: 'permanent' });
    expect(result.decision).toBe('ROUTE_TO');
    expect(result.route).toContain('ClusterCEO');
  });

  it('dedicated-vehicle-eligibility: ALLOW when grade-eligible else DENY (D8 fixture)', () => {
    expect(evalRule('dedicated-vehicle-eligibility', { gradeEligible: true }).decision).toBe('ALLOW');
    expect(evalRule('dedicated-vehicle-eligibility', {}).decision).toBe('DENY');
  });

  it('driver-eligibility-gate: composite ALLOW only when all true', () => {
    expect(
      evalRule('driver-eligibility-gate', {
        licenceValid: true,
        notBlocked: true,
        vehicleDocsValid: true,
      }).decision,
    ).toBe('ALLOW');
    expect(evalRule('driver-eligibility-gate', { licenceValid: true, notBlocked: false, vehicleDocsValid: true }).decision).toBe('DENY');
  });

  it('compliance-alert-ladders: item-specific offsets + default (D9 fixture)', () => {
    expect(evalRule('compliance-alert-ladders', { itemType: 'insurance' }).value).toEqual([60, 30, 14, 7, 1]);
    expect(evalRule('compliance-alert-ladders', { itemType: 'licence' }).value).toEqual([30, 14, 7, 1]);
    expect(evalRule('compliance-alert-ladders', {}).value).toEqual([30, 14, 7, 1]);
  });

  it('hard-block-conditions: DENY on expiry, ALLOW when none', () => {
    expect(evalRule('hard-block-conditions', { registrationExpired: true }).decision).toBe('DENY');
    expect(evalRule('hard-block-conditions', { insuranceExpired: true }).decision).toBe('DENY');
    expect(evalRule('hard-block-conditions', {}).decision).toBe('ALLOW');
  });

  it('fines-hr-threshold: default count/window (D12 fixture)', () => {
    expect(evalRule('fines-hr-threshold', {}).value).toEqual({ count: 3, months: 12 });
  });

  it('black-point-timeframe: default deadline (D14 fixture)', () => {
    expect(evalRule('black-point-timeframe', {}).value).toEqual({ transferDeadlineDays: 14 });
  });

  it('consent-re-consent-tolerance: default zero tolerance (any change re-consents)', () => {
    expect(evalRule('consent-re-consent-tolerance', {}).value).toEqual({ toleranceMinutes: 0 });
  });

  it('fuel-deviation-threshold: advisory default percent', () => {
    expect(evalRule('fuel-deviation-threshold', {}).value).toEqual({ percent: 12 });
  });

  it('marks all six governance-gated rule tables as fixtures', () => {
    for (const gated of [
      'max-booking-duration',
      'booking-approval-chain',
      'dedicated-vehicle-eligibility',
      'compliance-alert-ladders',
      'fines-hr-threshold',
      'black-point-timeframe',
    ]) {
      expect(registry.getActive(gated)!.version).toMatch(/^fixture-/);
    }
  });
});
