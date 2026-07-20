import { assessFreshness, DEFAULT_HCM_FRESHNESS_SLA_MINUTES } from './hcm';

describe('assessFreshness (HCM freshness policy — fail-safe = block)', () => {
  const now = new Date('2026-07-18T12:00:00Z');

  it('treats never-synced data as NOT fresh (never fail-open)', () => {
    expect(assessFreshness(null, DEFAULT_HCM_FRESHNESS_SLA_MINUTES, now)).toEqual({
      fresh: false,
      ageMinutes: null,
    });
    expect(assessFreshness(undefined, 60, now).fresh).toBe(false);
  });

  it('is fresh within the SLA window', () => {
    const tenMinAgo = new Date(now.getTime() - 10 * 60_000);
    const result = assessFreshness(tenMinAgo, 60, now);
    expect(result.fresh).toBe(true);
    expect(result.ageMinutes).toBeCloseTo(10);
  });

  it('is NOT fresh past the SLA window (blocks + escalates)', () => {
    const twoHoursAgo = new Date(now.getTime() - 120 * 60_000);
    expect(assessFreshness(twoHoursAgo, 60, now).fresh).toBe(false);
  });

  it('defaults the SLA to 24h', () => {
    expect(DEFAULT_HCM_FRESHNESS_SLA_MINUTES).toBe(1440);
  });
});
