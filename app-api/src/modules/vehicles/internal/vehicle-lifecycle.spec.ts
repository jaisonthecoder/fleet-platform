import { assertTransition, canTransition } from './vehicle-lifecycle';

describe('vehicle-lifecycle transitions', () => {
  it('allows valid transitions from Active', () => {
    expect(canTransition('Active', 'InUse')).toBe(true);
    expect(canTransition('Active', 'UnderMaintenance')).toBe(true);
    expect(canTransition('Active', 'OffHirePending')).toBe(true);
    expect(canTransition('Active', 'Decommissioned')).toBe(true);
    expect(canTransition('Active', 'Sold')).toBe(true);
  });

  it('allows return paths back to Active', () => {
    expect(canTransition('InUse', 'Active')).toBe(true);
    expect(canTransition('UnderMaintenance', 'Active')).toBe(true);
  });

  it('rejects transitions out of terminal states', () => {
    expect(canTransition('Sold', 'Active')).toBe(false);
    expect(canTransition('Decommissioned', 'Active')).toBe(false);
    expect(canTransition('Transferred', 'Active')).toBe(false);
  });

  it('rejects a no-op transition', () => {
    expect(canTransition('Active', 'Active')).toBe(false);
  });

  it('rejects an illegal jump (InUse -> Sold)', () => {
    expect(canTransition('InUse', 'Sold')).toBe(false);
  });

  it('assertTransition throws a machine-readable reason on an invalid move', () => {
    expect(() => assertTransition('Sold', 'Active')).toThrow('vehicle-transition-invalid:Sold->Active');
  });
});
