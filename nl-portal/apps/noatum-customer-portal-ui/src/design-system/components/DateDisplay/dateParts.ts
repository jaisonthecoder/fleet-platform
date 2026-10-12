import type { DateParts } from './DateDisplay';

/*
 * A bare YYYY-MM-DD carries no time, so parsing it in local time can move it a
 * day either side of the date line. Pinned to UTC, as formatDate does.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (value: string | Date): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isoOf = (date: Date): string => date.toISOString().slice(0, 10);

const DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days from today to the described date.
 *
 * The two are read differently on purpose. The described value is a UTC
 * calendar day, because a bare YYYY-MM-DD has no zone and must not slide across
 * the date line. `today` is read from its *local* components, because whichever
 * Date the caller passes — `new Date()` or local midnight — the day the user is
 * actually living in is the local one. Reading both the same way puts the
 * relative line a day out for every user east of Greenwich.
 */
const daysBetween = (today: Date, date: Date): number => {
  const from = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const to = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((to - from) / DAY);
};

/**
 * ISO 8601 week number — "W39" is how carriers talk about a sailing.
 *
 * Deliberately not `Intl`: no locale option produces the ISO week, and the
 * week a carrier means is the ISO one regardless of where the reader sits.
 */
const isoWeek = (date: Date): number => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday decides the year the week belongs to.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
};

export interface DatePartsOptions {
  /**
   * Today, for the relative line and its tone. Supply it from the caller rather
   * than reading the clock here, so a test can pin it and a screen showing a
   * historical record can measure from the right day.
   *
   * Read from its local components, so `new Date()` and local midnight both
   * mean the day the user is living in.
   */
  today?: Date;
  /**
   * Renders "in 5 days" / "3 days ago" / "today" in the app's language. Without
   * it the relative line is omitted rather than shipped in English — an
   * untranslatable string is worse than a missing one.
   */
  formatRelative?: (days: number) => string;
  /** Locale for the weekday and month abbreviations. Defaults to en-GB. */
  locale?: string;
}

/**
 * Builds the parts DT-01 draws from an ISO date or a Date.
 *
 * `DateDisplay` takes pre-split parts because the caller owns language and
 * tone, but every caller was then re-deriving the same six fields — and the
 * showcase simply hard-coded them. One builder means the weekday, the ISO week
 * and the brand's DD.MM.YYYY are computed once.
 *
 * Returns null for an absent or unparseable date so the caller renders its own
 * empty state rather than a row of placeholder dashes.
 */
export function dateParts(
  value: string | Date | null | undefined,
  options: DatePartsOptions = {},
): DateParts | null {
  if (!value) return null;
  const date = toDate(value);
  if (!date) return null;

  const { today, formatRelative, locale = 'en-GB' } = options;
  const utc: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };

  const dayNumber = new Intl.DateTimeFormat(locale, { ...utc, day: '2-digit' }).format(date);
  /*
   * Three letters, always. en-GB abbreviates September to "Sept" and Spanish to
   * "sept", either of which overflows the fixed-width stamp tile DT-01 draws and
   * makes September the one month that sits differently from the other eleven.
   */
  const monthShort = new Intl.DateTimeFormat(locale, { ...utc, month: 'short' })
    .format(date)
    .replace('.', '')
    .slice(0, 3)
    .toUpperCase();
  const year = new Intl.DateTimeFormat(locale, { ...utc, year: 'numeric' }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, { ...utc, weekday: 'short' })
    .format(date)
    .replace('.', '');

  const days = today ? daysBetween(today, date) : null;

  return {
    dayNumber,
    monthShort,
    year,
    weekday,
    weekNumber: `W${String(isoWeek(date)).padStart(2, '0')}`,
    // The brand's numeric form, via the same rule formatDate applies.
    numeric: new Intl.DateTimeFormat('en-GB', {
      ...utc,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .format(date)
      .replaceAll('/', '.'),
    full: `${weekday} ${dayNumber} ${monthShort} ${year}`,
    relative: days !== null && formatRelative ? formatRelative(days) : undefined,
    // Exposed so a caller can tone the line without capturing `days` out of
    // formatRelative, which reassigns a variable after render.
    relativeDays: days,
    // A date already past is a contradiction on a forward-looking field, so it
    // is toned attention rather than left to read as an ordinary future date.
    relativeTone: days === null ? undefined : days < 0 ? 'attention' : 'action',
    iso: isoOf(date),
  };
}
