/** Largest first; the first unit the gap fills is the one that reads best. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60_000],
  ['month', 30 * 24 * 60 * 60_000],
  ['day', 24 * 60 * 60_000],
  ['hour', 60 * 60_000],
  ['minute', 60_000],
  ['second', 1000],
];

/**
 * "38 min ago", in the viewer's language.
 *
 * The API sends timestamps, never rendered ages: a feed that says "38 min ago"
 * is only true at the moment it was serialised, and it is not translatable.
 */
export function timeAgo(iso: string | null | undefined, locale: string, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const deltaMs = then - now;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });

  for (const [unit, size] of UNITS) {
    if (Math.abs(deltaMs) >= size) return format.format(Math.round(deltaMs / size), unit);
  }
  return format.format(0, 'second');
}
