import { LegacyBookingApprovalRouteAdapter } from './legacy-booking-approval-route.adapter';

describe('LegacyBookingApprovalRouteAdapter', () => {
  const adapter = new LegacyBookingApprovalRouteAdapter();
  const scope = '10000000-0000-4000-8000-000000000001';

  it.each([
    [0.25, ['LineManager'], 'chain-line-manager'],
    [4, ['LineManager'], 'chain-line-manager'],
    [4.01, ['LineManager'], 'chain-default-line-manager'],
    [23.99, ['LineManager'], 'chain-default-line-manager'],
    [24, ['LineManager', 'FleetManager'], 'chain-fleet-manager'],
    [168, ['LineManager', 'FleetManager'], 'chain-fleet-manager'],
  ])('reproduces the frozen route at %s hours', (durationHours, route, reason) => {
    expect(adapter.evaluate({ durationHours: durationHours as number, requestedScopeNodeId: scope })).toMatchObject({
      decision: 'ROUTE_TO',
      route,
      reasons: [reason],
      policyVersion: 'legacy-booking-approval-v1',
      requestedScopeNodeId: scope,
      resolvedScopeNodeId: null,
    });
  });
});