import { describe, expect, it } from 'vitest';

import { dateParts } from './dateParts';

// Local midnight, which is how a screen builds "today".
const TODAY = new Date(2026, 8, 20);

describe('dateParts', () => {
  it('returns null for an absent or unparseable date', () => {
    expect(dateParts(null)).toBeNull();
    expect(dateParts(undefined)).toBeNull();
    expect(dateParts('')).toBeNull();
    expect(dateParts('not a date')).toBeNull();
  });

  it('splits an ISO date into the parts DT-01 draws', () => {
    const parts = dateParts('2026-09-25');

    expect(parts).toMatchObject({
      dayNumber: '25',
      monthShort: 'SEP',
      year: '2026',
      weekday: 'Fri',
      iso: '2026-09-25',
      full: 'Fri 25 SEP 2026',
    });
  });

  it('formats the numeric form as the brand DD.MM.YYYY', () => {
    expect(dateParts('2026-09-25')?.numeric).toBe('25.09.2026');
  });

  it('holds the month abbreviation to three letters', () => {
    // en-GB says "Sept", which overflows the fixed-width stamp tile and would
    // make September the one month that sits differently from the other eleven.
    expect(dateParts('2026-09-25')?.monthShort).toBe('SEP');
    expect(dateParts('2026-09-25', { locale: 'es-ES' })?.monthShort).toBe('SEP');
    expect(dateParts('2026-05-04')?.monthShort).toBe('MAY');
  });

  it('carries the ISO week, which is how carriers talk about a sailing', () => {
    expect(dateParts('2026-09-25')?.weekNumber).toBe('W39');
    // 1 January 2026 is a Thursday, so it belongs to week 1.
    expect(dateParts('2026-01-01')?.weekNumber).toBe('W01');
    // 1 January 2027 is a Friday, so it still belongs to week 53 of 2026.
    expect(dateParts('2027-01-01')?.weekNumber).toBe('W53');
  });

  it('pins a date-only value to UTC so it cannot slip a day across the date line', () => {
    // Parsed in a negative-offset local zone, a bare date would read as the 24th.
    expect(dateParts('2026-09-25')?.dayNumber).toBe('25');
  });

  it('omits the relative line when no formatter is supplied', () => {
    // An untranslatable English string is worse than a missing one.
    expect(dateParts('2026-09-25', { today: TODAY })?.relative).toBeUndefined();
  });

  it('measures the relative line in whole days from the given today', () => {
    const seen: number[] = [];
    const format = (days: number) => {
      seen.push(days);
      return `${days}`;
    };

    dateParts('2026-09-25', { today: TODAY, formatRelative: format });
    dateParts('2026-09-20', { today: TODAY, formatRelative: format });
    dateParts('2026-09-18', { today: TODAY, formatRelative: format });

    expect(seen).toEqual([5, 0, -2]);
  });

  it('tones a past date attention, because it contradicts a forward-looking field', () => {
    expect(dateParts('2026-09-18', { today: TODAY })?.relativeTone).toBe('attention');
    expect(dateParts('2026-09-25', { today: TODAY })?.relativeTone).toBe('action');
    // With no today there is nothing to measure against, so nothing is toned.
    expect(dateParts('2026-09-25')?.relativeTone).toBeUndefined();
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(dateParts(new Date('2026-09-25T00:00:00Z'))?.numeric).toBe('25.09.2026');
  });
});
