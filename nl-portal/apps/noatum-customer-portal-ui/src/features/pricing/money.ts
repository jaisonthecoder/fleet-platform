/**
 * Money in the pricing screens.
 *
 * Everything on the wire is MINOR UNITS as an integer. These helpers exist so no
 * component reaches for `* 100` on its own - a price that round-trips through a
 * float is a price that quietly changes, and this one ends up on a PDF the
 * customer keeps.
 *
 * The API owns every total. Nothing here adds two charge lines together for
 * display; where a total is shown it came from the server, so the number on the
 * screen and the number on the quote cannot disagree.
 */

/** "8980.00" -> 898000. Returns null for anything that is not a clean amount. */
export function toMinorUnits(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^-?\d*(\.\d{0,2})?$/.test(trimmed)) return null;

  const [whole = '0', fraction = ''] = trimmed.split('.');
  const negative = whole.startsWith('-');
  const digits = `${whole.replace('-', '') || '0'}${fraction.padEnd(2, '0')}`;
  const value = Number(digits);

  return Number.isSafeInteger(value) ? (negative ? -value : value) : null;
}

/** 898000 -> "8980.00". The editing representation, not the display one. */
export function fromMinorUnits(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '';
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(3, '0');
  const whole = digits.slice(0, -2);
  const fraction = digits.slice(-2);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * For reading, not for editing. Currency code and amount, never a symbol alone -
 * "€8,980.00" tells a customer with a USD quote nothing useful.
 */
export function formatMoney(minor: number | null | undefined, currency: string | null): string {
  if (minor === null || minor === undefined || !currency) return '—';

  const amount = (Math.abs(minor) / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${currency} ${minor < 0 ? '-' : ''}${amount}`;
}

/** Quantities carry three decimals: 2.5 containers is nonsense, 2.5 CBM is not. */
export function parseQuantity(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d*(\.\d{0,3})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}
