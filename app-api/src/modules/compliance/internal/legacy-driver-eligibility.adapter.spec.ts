import { LegacyDriverEligibilityAdapter } from './legacy-driver-eligibility.adapter';

describe('LegacyDriverEligibilityAdapter', () => {
  const adapter = new LegacyDriverEligibilityAdapter();
  const scope = '10000000-0000-4000-8000-000000000001';

  it.each([
    [true, true, true, 'ALLOW'],
    [false, true, true, 'DENY'],
    [true, false, true, 'DENY'],
    [true, true, false, 'DENY'],
    [false, false, false, 'DENY'],
  ])('evaluates licence=%s block=%s docs=%s as %s', (licenceValid, notBlocked, vehicleDocsValid, decision) => {
    expect(adapter.evaluate({ licenceValid, notBlocked, vehicleDocsValid, requestedScopeNodeId: scope })).toMatchObject({
      decision,
      reasons: [decision === 'ALLOW' ? 'eligibility-gate-pass' : 'eligibility-gate-fail'],
      policyVersion: 'legacy-driver-eligibility-gate-v1',
      requestedScopeNodeId: scope,
      resolvedScopeNodeId: null,
    });
  });
});