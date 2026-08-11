import { LegacyEntitlementApprovalRouteAdapter } from './legacy-entitlement-decision.adapters';

describe('LegacyEntitlementApprovalRouteAdapter', () => {
  const adapter = new LegacyEntitlementApprovalRouteAdapter();
  it('freezes LongTerm and Temporary route semantics', () => {
    expect(adapter.evaluate('LongTerm', 'scope').route).toEqual(['LineManager', 'FleetManager', 'ClusterFleetLead', 'ClusterCEO']);
    expect(adapter.evaluate('Temporary', 'scope').route).toEqual(['LineManager', 'FleetManager', 'ClusterCEO']);
  });
});