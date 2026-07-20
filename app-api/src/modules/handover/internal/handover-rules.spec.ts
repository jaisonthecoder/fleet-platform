import {
  isLateReturn,
  isOdometerConflict,
  ODOMETER_CONFLICT_TOLERANCE_KM,
  reconcileFuel,
  toNumberOrNull,
} from './handover-rules';

describe('handover-rules', () => {
  describe('reconcileFuel', () => {
    it('flags a deviation beyond the threshold', () => {
      // 200 km at 10 km/L ⇒ expected 20 L; observed 30 L ⇒ 50% deviation.
      const r = reconcileFuel({
        startOdometer: 1000,
        endOdometer: 1200,
        efficiencyKmpl: 10,
        observedLitres: 30,
        thresholdPercent: 12,
      });
      expect(r.distanceKm).toBe(200);
      expect(r.expectedLitres).toBe(20);
      expect(r.deviationPercent).toBeCloseTo(50);
      expect(r.flagged).toBe(true);
    });

    it('does not flag a deviation within the threshold', () => {
      const r = reconcileFuel({
        startOdometer: 1000,
        endOdometer: 1200,
        efficiencyKmpl: 10,
        observedLitres: 21,
        thresholdPercent: 12,
      });
      expect(r.deviationPercent).toBeCloseTo(5);
      expect(r.flagged).toBe(false);
    });

    it('stays advisory (no deviation) when efficiency or observed litres are unknown', () => {
      expect(
        reconcileFuel({ startOdometer: 1000, endOdometer: 1200, efficiencyKmpl: null, observedLitres: 30, thresholdPercent: 12 }).flagged,
      ).toBe(false);
      expect(
        reconcileFuel({ startOdometer: 1000, endOdometer: 1200, efficiencyKmpl: 10, observedLitres: null, thresholdPercent: 12 }).deviationPercent,
      ).toBeNull();
    });

    it('never produces a negative distance', () => {
      expect(
        reconcileFuel({ startOdometer: 1200, endOdometer: 1000, efficiencyKmpl: 10, observedLitres: 5, thresholdPercent: 12 }).distanceKm,
      ).toBe(0);
    });
  });

  describe('isOdometerConflict', () => {
    it('flags a disagreement beyond tolerance', () => {
      expect(isOdometerConflict(1000, 1100)).toBe(true);
    });

    it('accepts a reading within tolerance', () => {
      expect(isOdometerConflict(1000, 1000 + ODOMETER_CONFLICT_TOLERANCE_KM)).toBe(false);
    });

    it('is not a conflict when telematics has no reading', () => {
      expect(isOdometerConflict(1000, null)).toBe(false);
    });
  });

  describe('isLateReturn', () => {
    it('is late when returned after the booked window', () => {
      expect(isLateReturn(new Date('2026-07-19T11:00:00Z'), new Date('2026-07-19T10:00:00Z'))).toBe(true);
    });

    it('is on time when returned within the window', () => {
      expect(isLateReturn(new Date('2026-07-19T09:59:00Z'), new Date('2026-07-19T10:00:00Z'))).toBe(false);
    });
  });

  describe('toNumberOrNull', () => {
    it('parses numeric strings and passes through numbers', () => {
      expect(toNumberOrNull('1200.5')).toBe(1200.5);
      expect(toNumberOrNull(42)).toBe(42);
    });

    it('returns null for null/undefined/invalid', () => {
      expect(toNumberOrNull(null)).toBeNull();
      expect(toNumberOrNull(undefined)).toBeNull();
      expect(toNumberOrNull('abc')).toBeNull();
    });
  });
});
