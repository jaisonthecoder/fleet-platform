import { type EligibilityInputs, hardBlockCheck } from './eligibility-rules';

const base = (over: Partial<EligibilityInputs> = {}): EligibilityInputs => ({
  today: new Date('2026-07-18T00:00:00Z'),
  licenceExpiry: '2030-01-01',
  employmentStatus: 'Active',
  mulkiyaExpiry: '2030-01-01',
  insuranceExpiry: '2030-01-01',
  vehicleLifecycle: 'Active',
  bookingPoolFlag: true,
  hasActiveBlock: false,
  ...over,
});

describe('hardBlockCheck', () => {
  it('passes a fully-compliant driver + vehicle', () => {
    expect(hardBlockCheck(base())).toEqual({ blocked: false, reasons: [] });
  });

  it('hard-blocks an expired Mulkiya (no override)', () => {
    expect(hardBlockCheck(base({ mulkiyaExpiry: '2020-01-01' }))).toMatchObject({
      blocked: true,
      reasons: ['hard-block-registration-expired'],
    });
  });

  it('hard-blocks an expired insurance', () => {
    expect(hardBlockCheck(base({ insuranceExpiry: '2020-01-01' })).reasons).toContain('hard-block-insurance-expired');
  });

  it('blocks an active platform access block', () => {
    expect(hardBlockCheck(base({ hasActiveBlock: true, blockReason: 'black-point-overdue' })).reasons).toContain(
      'access-blocked:black-point-overdue',
    );
  });

  it('blocks an expired licence and an inactive employee', () => {
    expect(hardBlockCheck(base({ licenceExpiry: '2020-01-01' })).reasons).toContain('licence-expired');
    expect(hardBlockCheck(base({ employmentStatus: 'Suspended' })).reasons).toContain('employment-inactive');
  });

  it('blocks a non-bookable vehicle', () => {
    expect(hardBlockCheck(base({ vehicleLifecycle: 'UnderMaintenance' })).reasons).toContain('vehicle-not-bookable');
    expect(hardBlockCheck(base({ bookingPoolFlag: false })).reasons).toContain('vehicle-not-bookable');
  });

  it('treats an expiry exactly today as not-yet-expired', () => {
    expect(hardBlockCheck(base({ mulkiyaExpiry: '2026-07-18' })).blocked).toBe(false);
  });
});
