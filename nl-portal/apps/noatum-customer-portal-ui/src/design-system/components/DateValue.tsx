import styles from './DateValue.module.css';

/* A bare YYYY-MM-DD carries no time, so parsing it in local time can move it a
   day either side of the date line. Pin those to UTC; leave real timestamps in
   the viewer's own zone, which is what the screens did before this existed. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/**
 * Formats to the brand's DD.MM.YYYY.
 *
 * Exported as a function as well as a component because column definitions and
 * sort comparators sometimes need the string rather than an element.
 */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const dateOnly = DATE_ONLY.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    ...DATE_FORMAT,
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  })
    .format(date)
    .replaceAll('/', '.');
}

export function formatTime(value: string | null | undefined): string | null {
  if (!value || DATE_ONLY.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', TIME_FORMAT).format(date);
}

export interface DateValueProps {
  value: string | null | undefined;
  /** Adds the time beneath, for audit trails and import runs. */
  withTime?: boolean;
  /** Shown when there is no date. An em dash reads better than an empty cell. */
  absent?: string;
}

/**
 * A date, in the one format the brand uses.
 *
 * Four separate implementations of this rule existed, in three different
 * techniques, and none of them set tabular figures - so date columns did not
 * line up. One component means one format and one place to change it.
 */
export function DateValue({ value, withTime = false, absent = '—' }: DateValueProps) {
  const date = formatDate(value);
  if (!date) return <span className={styles.absent}>{absent}</span>;

  const time = withTime ? formatTime(value) : null;

  return (
    <span className={styles.date}>
      <time dateTime={value ?? undefined}>{date}</time>
      {time && (
        <>
          {' '}
          <span className={styles.time}>{time}</span>
        </>
      )}
    </span>
  );
}
