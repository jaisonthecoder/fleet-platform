import { ENTITLEMENT_REASON } from '../../../contracts/entitlement.contract';
import { gradeEligibleFact, resolveApprovers, validateDateWindow } from './entitlement-rules';

describe('entitlement-rules', () => {
  describe('validateDateWindow', () => {
    it('accepts an end on/after the start', () => {
      expect(validateDateWindow('2026-08-01', '2026-08-31')).toEqual([]);
      expect(validateDateWindow('2026-08-01', '2026-08-01')).toEqual([]);
    });
    it('rejects an end before the start or invalid dates', () => {
      expect(validateDateWindow('2026-08-31', '2026-08-01')).toContain(ENTITLEMENT_REASON.windowInvalid);
      expect(validateDateWindow('nope', '2026-08-01')).toContain(ENTITLEMENT_REASON.windowInvalid);
    });
  });

  describe('resolveApprovers', () => {
    const resolve = (role: string): string | null =>
      ({ LineManager: 'p-lm', FleetManager: 'p-fm', ClusterCEO: 'p-ceo', Self: 'p-self' })[role] ?? null;

    it('resolves a chain up to Cluster CEO, excluding the requester (SoD-02)', () => {
      expect(resolveApprovers(['LineManager', 'FleetManager', 'ClusterCEO'], 'p-self', resolve)).toEqual([
        'p-lm',
        'p-fm',
        'p-ceo',
      ]);
    });
    it('drops the requester and unresolved roles, and dedupes', () => {
      expect(resolveApprovers(['Self', 'LineManager', 'LineManager', 'Unknown'], 'p-self', resolve)).toEqual(['p-lm']);
    });
  });

  describe('gradeEligibleFact', () => {
    it('is true only when a non-empty grade is present', () => {
      expect(gradeEligibleFact('Director')).toBe(true);
      expect(gradeEligibleFact('')).toBe(false);
      expect(gradeEligibleFact(null)).toBe(false);
      expect(gradeEligibleFact(undefined)).toBe(false);
    });
  });
});
