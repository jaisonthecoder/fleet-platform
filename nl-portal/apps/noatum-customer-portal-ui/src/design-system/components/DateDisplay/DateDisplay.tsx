import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './DateDisplay.module.css';

/**
 * One date, already formatted by the caller.
 *
 * The design system holds no locale, so every piece arrives as a string. That
 * also lets a Spanish surface pass Spanish month and weekday names without the
 * component knowing anything about either.
 */
export interface DateParts {
  /** "25" */
  dayNumber: string;
  /** "SEP" */
  monthShort: string;
  /** "2026" */
  year: string;
  /** "Fri" */
  weekday: string;
  /** "W39" — how carriers talk about a sailing. */
  weekNumber?: string;
  /** "25.09.2026", the brand's numeric form. */
  numeric?: string;
  /** "Fri 25 SEP 2026" */
  full?: string;
  /** "in 5 days" — the distance from today is what the customer feels. */
  relative?: ReactNode;
  /** Whole days from the supplied today: negative is past. Null when no today was given. */
  relativeDays?: number | null;
  /** Colours the relative line. */
  relativeTone?: 'action' | 'success' | 'attention' | 'muted';
  /** Machine-readable date for `<time dateTime>`, e.g. "2026-09-25". */
  iso?: string;
}

export type DateDisplayVariant = 'stamp' | 'line' | 'chip';

export interface DateDisplayProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  date: DateParts;
  variant?: DateDisplayVariant;
  /** Prefix for the relative line in the segmented variant, e.g. "Cargo ready". */
  relativePrefix?: ReactNode;
}

/**
 * DT-01 · Date field treatments.
 *
 * A shipping date is never just a number: the weekday decides whether a sailing
 * exists, the week number is how carriers talk, and the distance from today is
 * what the customer feels. Three ways to show the same date, all carrying those
 * three facts.
 *
 * Every variant emits `<time dateTime>` when an ISO date is supplied, so the
 * date is machine-readable however it is drawn.
 */
export const DateDisplay = forwardRef<HTMLElement, DateDisplayProps>(function DateDisplay(
  { date, variant = 'stamp', relativePrefix, className, ...rest },
  ref,
) {
  const tone = date.relativeTone ?? 'action';

  if (variant === 'line') {
    return (
      <div ref={ref as never} className={cn(styles.lineWrap, className)} {...rest}>
        <time className={styles.line} dateTime={date.iso}>
          <span className={styles.lineDay}>{date.dayNumber}</span>
          <span className={styles.lineMonth}>{date.monthShort}</span>
          <span className={styles.lineYear}>{date.year}</span>
          <span className={styles.lineMeta}>
            {date.weekday}
            {date.weekNumber ? ` · ${date.weekNumber}` : ''}
          </span>
        </time>
        {date.relative && (
          <p className={styles.relative} data-tone={tone}>
            {relativePrefix ? <>{relativePrefix} </> : null}
            {date.relative}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'chip') {
    return (
      <div ref={ref as never} className={cn(styles.chipWrap, className)} {...rest}>
        <time className={styles.chip} dateTime={date.iso}>
          <span className={styles.chipDay} aria-hidden="true">
            {date.dayNumber}
          </span>
          <span className={styles.chipFull}>
            {date.full ?? `${date.weekday} ${date.dayNumber} ${date.monthShort} ${date.year}`}
          </span>
        </time>
        <span className={styles.chipMeta}>
          {date.numeric && <span className={styles.numeric}>{date.numeric}</span>}
          {date.weekNumber && <span className={styles.tag}>{date.weekNumber}</span>}
          {date.relative && (
            <span className={styles.tag} data-tone={tone}>
              {date.relative}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <time ref={ref as never} className={cn(styles.stamp, className)} dateTime={date.iso} {...rest}>
      <span className={styles.stampBlock} aria-hidden="true">
        <span className={styles.stampDay}>{date.dayNumber}</span>
        <span className={styles.stampMonth}>{date.monthShort}</span>
      </span>
      <span className={styles.stampCopy}>
        <span className={styles.stampWeekday}>{date.weekday}</span>
        <span className={styles.stampMeta}>
          <span className="noa-visually-hidden">
            {date.dayNumber} {date.monthShort}{' '}
          </span>
          {date.year}
          {date.weekNumber ? ` · ${date.weekNumber}` : ''}
        </span>
        {date.relative && (
          <span className={styles.stampRelative} data-tone={tone}>
            {date.relative}
          </span>
        )}
      </span>
    </time>
  );
});
