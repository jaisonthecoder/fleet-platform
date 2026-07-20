import { attributeFine, type SubstitutionWindowFact, transferDeadline } from './fines-attribution';

const win = (substitutePersonId: string, start: string, end: string): SubstitutionWindowFact => ({
  substitutePersonId,
  start: new Date(start),
  end: new Date(end),
});

describe('fines-attribution', () => {
  describe('attributeFine — precedence', () => {
    it('attributes to the substitute when the event falls in a window', () => {
      const r = attributeFine({
        eventTime: new Date('2026-07-10T12:00:00Z'),
        substitutionWindows: [win('sub', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z')],
        activeBookingDriverPersonId: 'booking-driver',
        assignedDriverPersonId: 'assigned-driver',
      });
      expect(r).toEqual({ personId: 'sub', basis: 'substitution-window' });
    });

    it('falls back to the booking-active driver when no window covers the event', () => {
      const r = attributeFine({
        eventTime: new Date('2026-07-20T12:00:00Z'),
        substitutionWindows: [win('sub', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z')],
        activeBookingDriverPersonId: 'booking-driver',
        assignedDriverPersonId: 'assigned-driver',
      });
      expect(r).toEqual({ personId: 'booking-driver', basis: 'booking-active-driver' });
    });

    it('falls back to the assigned driver when there is no active booking', () => {
      const r = attributeFine({
        eventTime: new Date('2026-07-20T12:00:00Z'),
        substitutionWindows: [],
        activeBookingDriverPersonId: null,
        assignedDriverPersonId: 'assigned-driver',
      });
      expect(r).toEqual({ personId: 'assigned-driver', basis: 'assigned-driver' });
    });

    it('is unattributed when nothing matches', () => {
      const r = attributeFine({ eventTime: new Date('2026-07-20T12:00:00Z'), substitutionWindows: [], activeBookingDriverPersonId: null, assignedDriverPersonId: null });
      expect(r).toEqual({ personId: null, basis: 'unattributed' });
    });
  });

  describe('attributeFine — boundary [start, end) (P1B-R2-7)', () => {
    const windows = [win('sub', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z')];
    it('includes the exact start instant', () => {
      expect(attributeFine({ eventTime: new Date('2026-07-10T00:00:00Z'), substitutionWindows: windows, activeBookingDriverPersonId: 'b', assignedDriverPersonId: 'a' }).basis).toBe('substitution-window');
    });
    it('excludes the exact end instant (belongs to what follows)', () => {
      const r = attributeFine({ eventTime: new Date('2026-07-11T00:00:00Z'), substitutionWindows: windows, activeBookingDriverPersonId: 'b', assignedDriverPersonId: 'a' });
      expect(r).toEqual({ personId: 'b', basis: 'booking-active-driver' });
    });
  });

  describe('attributeFine — overlapping windows (latest start wins)', () => {
    it('chooses the most recently started window', () => {
      const r = attributeFine({
        eventTime: new Date('2026-07-10T12:00:00Z'),
        substitutionWindows: [
          win('early', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z'),
          win('late', '2026-07-10T06:00:00Z', '2026-07-10T18:00:00Z'),
        ],
        activeBookingDriverPersonId: null,
        assignedDriverPersonId: null,
      });
      expect(r).toEqual({ personId: 'late', basis: 'substitution-window' });
    });
  });

  describe('transferDeadline', () => {
    it('adds the configured days to the event time', () => {
      expect(transferDeadline(new Date('2026-07-10T00:00:00Z'), 14).toISOString()).toBe('2026-07-24T00:00:00.000Z');
    });
  });
});
