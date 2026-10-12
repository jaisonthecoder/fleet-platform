import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './FreeTimeMeter.module.css';

export type FreeTimeState = 'used' | 'remaining' | 'chargeable';

export interface FreeTimeDay {
  id: string;
  /** What this day is, e.g. "Day 3 · 24.08". Read by assistive technology. */
  label: string;
  state: FreeTimeState;
}

export interface FreeTimeFact {
  id: string;
  label: ReactNode;
  value: ReactNode;
  /** Draws the figure in the action colour, e.g. the running cost. */
  emphasis?: boolean;
}

export interface FreeTimeMeterProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** e.g. "Detention · MSCU 728 4410". */
  title: ReactNode;
  /** e.g. "3 days chargeable". */
  status?: ReactNode;
  /** Draws the status in the action colour rather than neutral. */
  statusTone?: 'action' | 'attention' | 'success';
  /** One per day, in order. */
  days: readonly FreeTimeDay[];
  /** Names the meter for assistive technology. */
  meterLabel: string;
  /** The three markers under the meter. */
  start?: ReactNode;
  freeTimeEnd?: ReactNode;
  today?: ReactNode;
  facts?: readonly FreeTimeFact[];
  /**
   * What the running figure excludes. A demurrage number without its
   * exclusions is the one that gets disputed.
   */
  excluded?: ReactNode;
}

/**
 * SP-05 · Free time and demurrage meter.
 *
 * One day per cell: used, remaining, then chargeable days past the free period
 * with the running cost. Each cell names its own day and state, because a row
 * of coloured blocks says nothing to anyone who cannot see it.
 */
export const FreeTimeMeter = forwardRef<HTMLElement, FreeTimeMeterProps>(function FreeTimeMeter(
  {
    title,
    status,
    statusTone = 'action',
    days,
    meterLabel,
    start,
    freeTimeEnd,
    today,
    facts,
    excluded,
    className,
    ...rest
  },
  ref,
) {
  return (
    <section ref={ref} className={cn(styles.meter, className)} {...rest}>
      <header className={styles.head}>
        <span className={styles.title}>{title}</span>
        {status && (
          <span className={styles.status} data-tone={statusTone}>
            {status}
          </span>
        )}
      </header>

      <ol className={styles.days} aria-label={meterLabel}>
        {days.map((day) => (
          <li key={day.id} className={styles.day} data-state={day.state}>
            <span className="noa-visually-hidden">{day.label}</span>
          </li>
        ))}
      </ol>

      {(start || freeTimeEnd || today) && (
        <p className={styles.markers}>
          <span>{start}</span>
          <span className={styles.freeEnd}>{freeTimeEnd}</span>
          <span>{today}</span>
        </p>
      )}

      {facts?.length ? (
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.id}>
              <dt>{fact.label}</dt>
              <dd data-emphasis={fact.emphasis || undefined}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {excluded && <p className={styles.excluded}>{excluded}</p>}
    </section>
  );
});
