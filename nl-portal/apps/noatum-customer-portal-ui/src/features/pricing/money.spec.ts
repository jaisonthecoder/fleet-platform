import { describe, expect, it } from 'vitest';

import { formatMoney, fromMinorUnits, parseQuantity, toMinorUnits } from './money';

/**
 * Money in the browser.
 *
 * These matter more than they look. A quote total reaches a customer as a PDF they
 * keep, so a figure that shifts by a cent between the screen and the server is a
 * commercial argument, not a rounding curiosity.
 */
describe('toMinorUnits', () => {
  it('reads ordinary amounts', () => {
    expect(toMinorUnits('8980.00')).toBe(898_000);
    expect(toMinorUnits('0.01')).toBe(1);
    expect(toMinorUnits('1')).toBe(100);
    expect(toMinorUnits('1.5')).toBe(150);
  });

  it('accepts a comma, because European keyboards produce one', () => {
    expect(toMinorUnits('1234,56')).toBe(123_456);
  });

  it('never silently truncates a third decimal', () => {
    // 0.005 is not a representable amount. Refusing is right; rounding it to 0 or 1
    // would be the API and the screen disagreeing about a cent.
    expect(toMinorUnits('0.005')).toBeNull();
  });

  it('refuses anything that is not an amount', () => {
    expect(toMinorUnits('')).toBeNull();
    expect(toMinorUnits('abc')).toBeNull();
    expect(toMinorUnits('1.2.3')).toBeNull();
    expect(toMinorUnits('1e5')).toBeNull();
  });

  it('handles a negative, because a credit is a real charge line', () => {
    expect(toMinorUnits('-50.00')).toBe(-5_000);
  });

  it('refuses a figure too large to stay exact', () => {
    expect(toMinorUnits('999999999999999999')).toBeNull();
  });
});

describe('fromMinorUnits', () => {
  it('round-trips', () => {
    for (const value of ['0.00', '0.01', '1.00', '8980.00', '1234.56']) {
      expect(fromMinorUnits(toMinorUnits(value))).toBe(value);
    }
  });

  it('pads a sub-unit amount rather than showing .1', () => {
    expect(fromMinorUnits(1)).toBe('0.01');
    expect(fromMinorUnits(10)).toBe('0.10');
  });

  it('keeps the sign', () => {
    expect(fromMinorUnits(-5_000)).toBe('-50.00');
  });
});

describe('formatMoney', () => {
  it('always names the currency, never a bare symbol', () => {
    expect(formatMoney(898_000, 'EUR')).toBe('EUR 8,980.00');
    expect(formatMoney(898_000, 'USD')).toBe('USD 8,980.00');
  });

  it('shows an em dash when there is nothing to show', () => {
    expect(formatMoney(null, 'EUR')).toBe('—');
    expect(formatMoney(100, null)).toBe('—');
  });

  it('places the sign before the amount, not the currency', () => {
    expect(formatMoney(-5_000, 'EUR')).toBe('EUR -50.00');
  });
});

describe('parseQuantity', () => {
  it('takes three decimals, because CBM needs them', () => {
    expect(parseQuantity('2')).toBe(2);
    expect(parseQuantity('2.5')).toBe(2.5);
    expect(parseQuantity('12.345')).toBe(12.345);
  });

  it('refuses zero and negatives: a charge line for none of something is a mistake', () => {
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
  });

  it('refuses a fourth decimal rather than rounding it away', () => {
    expect(parseQuantity('1.2345')).toBeNull();
  });
});

describe('line arithmetic matches the server', () => {
  // The API computes (round(qty * 1000) * rate) / 1000 in BigInt. The screen shows a
  // preview with the same expression. These cases are the ones where a naive
  // qty * rate in floating point drifts.
  const serverEquivalent = (quantity: number, rate: number) =>
    Math.trunc((Math.round(quantity * 1000) * rate) / 1000);

  it('agrees on a whole quantity', () => {
    expect(serverEquivalent(2, 400_000)).toBe(800_000);
  });

  it('agrees on a fractional quantity, truncating rather than rounding up', () => {
    // 2.5 x 333 = 832.5 minor units. Both sides truncate to 832.
    expect(serverEquivalent(2.5, 333)).toBe(832);
  });

  it('stays exact where a plain float would not', () => {
    expect(serverEquivalent(1.1, 100)).toBe(110);
    expect(serverEquivalent(0.07, 100)).toBe(7);
  });
});
