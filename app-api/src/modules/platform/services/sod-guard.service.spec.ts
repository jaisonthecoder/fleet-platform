import { ForbiddenException } from '@nestjs/common';
import { SodGuardService } from './sod-guard.service';

describe('SodGuardService', () => {
  const guard = new SodGuardService();

  it('SoD-01: blocks approving a booking you raised', () => {
    const violation = guard.check({
      actionType: 'approve-booking',
      actorPersonId: 'p1',
      raisedByPersonId: 'p1',
    });
    expect(violation?.rule).toBe('SoD-01');
  });

  it('SoD-01: allows approving someone else\'s booking', () => {
    const violation = guard.check({
      actionType: 'approve-booking',
      actorPersonId: 'p2',
      raisedByPersonId: 'p1',
    });
    expect(violation).toBeNull();
  });

  it('SoD-02: blocks approving an entitlement you raised', () => {
    const violation = guard.check({
      actionType: 'approve-entitlement',
      actorPersonId: 'p1',
      raisedByPersonId: 'p1',
    });
    expect(violation?.rule).toBe('SoD-02');
  });

  it('SoD-04: blocks Finance + FleetManager co-held on a scope', () => {
    const violation = guard.check({
      actionType: 'approve-booking',
      actorPersonId: 'p2',
      raisedByPersonId: 'p1',
      actorRolesOnScope: ['Finance', 'FleetManager'],
    });
    expect(violation?.rule).toBe('SoD-04');
  });

  it('SoD-05: blocks System Admin approving operations', () => {
    const violation = guard.check({
      actionType: 'approve-operational',
      actorPersonId: 'p2',
      actorRolesOnScope: ['SystemAdmin'],
    });
    expect(violation?.rule).toBe('SoD-05');
  });

  it('assert() throws ForbiddenException on violation', () => {
    expect(() =>
      guard.assert({
        actionType: 'approve-booking',
        actorPersonId: 'p1',
        raisedByPersonId: 'p1',
      }),
    ).toThrow(ForbiddenException);
  });
});
