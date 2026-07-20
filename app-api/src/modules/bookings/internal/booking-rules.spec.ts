import { BOOKING_REASON } from '../../../contracts/booking.contract';
import {
  applyBuffer,
  durationHours,
  generateBookingNumber,
  isActiveStatus,
  resolveApprovers,
  validateWindow,
  vehicleClassOf,
  withinReConsentTolerance,
} from './booking-rules';

describe('booking-rules', () => {
  const now = new Date('2026-07-18T08:00:00Z');

  describe('validateWindow', () => {
    it('accepts a valid future window', () => {
      expect(
        validateWindow(new Date('2026-07-19T08:00:00Z'), new Date('2026-07-19T10:00:00Z'), now),
      ).toEqual([]);
    });

    it('rejects a return not after pickup', () => {
      expect(
        validateWindow(new Date('2026-07-19T10:00:00Z'), new Date('2026-07-19T08:00:00Z'), now),
      ).toContain(BOOKING_REASON.windowInvalid);
    });

    it('rejects a pickup in the past', () => {
      expect(
        validateWindow(new Date('2026-07-17T08:00:00Z'), new Date('2026-07-19T10:00:00Z'), now),
      ).toContain(BOOKING_REASON.windowInPast);
    });

    it('rejects invalid dates', () => {
      expect(validateWindow(new Date('nope'), new Date('2026-07-19T10:00:00Z'), now)).toEqual([
        BOOKING_REASON.windowInvalid,
      ]);
    });
  });

  describe('applyBuffer', () => {
    it('extends only the trailing edge by the buffer', () => {
      const w = applyBuffer(new Date('2026-07-19T08:00:00Z'), new Date('2026-07-19T10:00:00Z'), 15);
      expect(w.start.toISOString()).toBe('2026-07-19T08:00:00.000Z');
      expect(w.end.toISOString()).toBe('2026-07-19T10:15:00.000Z');
    });

    it('never shrinks the window on a negative buffer', () => {
      const w = applyBuffer(new Date('2026-07-19T08:00:00Z'), new Date('2026-07-19T10:00:00Z'), -30);
      expect(w.end.toISOString()).toBe('2026-07-19T10:00:00.000Z');
    });
  });

  describe('durationHours', () => {
    it('computes whole hours between pickup and return', () => {
      expect(durationHours(new Date('2026-07-19T08:00:00Z'), new Date('2026-07-19T12:00:00Z'))).toBe(4);
    });
  });

  describe('isActiveStatus', () => {
    it('active statuses reserve the vehicle', () => {
      expect(isActiveStatus('PendingApproval')).toBe(true);
      expect(isActiveStatus('Approved')).toBe(true);
      expect(isActiveStatus('Active')).toBe(true);
    });

    it('non-active statuses release the vehicle', () => {
      for (const s of ['Draft', 'Declined', 'Cancelled', 'Completed', 'Expired', 'NoShow']) {
        expect(isActiveStatus(s)).toBe(false);
      }
    });
  });

  describe('vehicleClassOf', () => {
    it('maps executive/VIP categories to the executive class', () => {
      expect(vehicleClassOf('EXECUTIVE')).toBe('executive');
      expect(vehicleClassOf('VIP')).toBe('executive');
    });

    it('maps everything else (incl. null) to pool', () => {
      expect(vehicleClassOf('POOL')).toBe('pool');
      expect(vehicleClassOf(null)).toBe('pool');
      expect(vehicleClassOf(undefined)).toBe('pool');
    });
  });

  describe('withinReConsentTolerance', () => {
    const base = {
      vehicleId: 'v1',
      pickup: new Date('2026-07-19T08:00:00Z'),
      ret: new Date('2026-07-19T10:00:00Z'),
    };

    it('a vehicle change always requires re-consent', () => {
      expect(withinReConsentTolerance(base, { ...base, vehicleId: 'v2' }, 60)).toBe(false);
    });

    it('a window change within tolerance keeps consent', () => {
      expect(
        withinReConsentTolerance(base, { ...base, ret: new Date('2026-07-19T10:20:00Z') }, 30),
      ).toBe(true);
    });

    it('a window change beyond tolerance requires re-consent', () => {
      expect(
        withinReConsentTolerance(base, { ...base, ret: new Date('2026-07-19T11:00:00Z') }, 30),
      ).toBe(false);
    });

    it('zero tolerance re-consents on any change', () => {
      expect(
        withinReConsentTolerance(base, { ...base, ret: new Date('2026-07-19T10:01:00Z') }, 0),
      ).toBe(false);
    });
  });

  describe('resolveApprovers', () => {
    const resolve = (role: string): string | null =>
      ({ LineManager: 'p-mgr', FleetManager: 'p-fm', Self: 'p-self' })[role] ?? null;

    it('excludes the requester (SoD-01) and preserves order', () => {
      expect(resolveApprovers(['LineManager', 'FleetManager'], 'p-self', resolve)).toEqual([
        'p-mgr',
        'p-fm',
      ]);
    });

    it('dedupes repeated approvers', () => {
      expect(resolveApprovers(['LineManager', 'LineManager'], 'x', resolve)).toEqual(['p-mgr']);
    });

    it('drops a role that resolves to the requester', () => {
      expect(resolveApprovers(['Self'], 'p-self', resolve)).toEqual([]);
    });

    it('drops unresolved roles', () => {
      expect(resolveApprovers(['Unknown', 'LineManager'], 'x', resolve)).toEqual(['p-mgr']);
    });
  });

  describe('generateBookingNumber', () => {
    it('formats BK-<year>-<six digits>', () => {
      expect(generateBookingNumber(new Date('2026-07-18T00:00:00Z'), () => 0.123456)).toBe('BK-2026-123456');
    });
  });
});
