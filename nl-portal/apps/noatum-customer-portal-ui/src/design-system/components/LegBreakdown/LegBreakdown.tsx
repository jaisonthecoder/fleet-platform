import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { LogisticsIcon } from '../../icons';
import type { LogisticsIconName } from '../../icons/logistics-icon-data';
import { clampProgress, roundPercent } from '../../measure';
import { cn } from '../../utils';
import styles from './LegBreakdown.module.css';

export type LegTone = 'navy' | 'action' | 'attention' | 'neutral' | 'tint';

export interface TransitLeg {
  id: string;
  /** e.g. "Main freight". */
  label: ReactNode;
  /** The quiet second line, e.g. "Qingdao to Valencia". */
  detail?: ReactNode;
  /** Days. Widths are proportional to this. */
  value: number;
  /** Formatted for display, e.g. "24 days". */
  valueLabel: ReactNode;
  icon?: LogisticsIconName;
  tone: LegTone;
  /** Dwell rather than movement. Named in text so it cannot be hidden. */
  dwell?: boolean;
}

export interface LegBreakdownProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** e.g. "Qingdao → Ribarroja · door to door". */
  title: ReactNode;
  /** e.g. "38 days total · 4 legs, 2 dwell periods". */
  summary?: ReactNode;
  legs: readonly TransitLeg[];
  /** Names the bar for assistive technology. */
  chartLabel: string;
  /** Says "dwell" in words beside a dwell leg. */
  dwellLabel?: string;
  /** Total the widths are measured against. Defaults to the sum of the legs. */
  total?: number;
}

/**
 * SP-03 · Multimodal leg breakdown.
 *
 * Door-to-door transit split into pre-carriage, terminal dwell, main leg and
 * on-carriage. Widths are proportional to days, so dwell time is impossible to
 * hide — which is the whole point of the component, and why dwell is also
 * named in text rather than only shaded.
 */
export const LegBreakdown = forwardRef<HTMLElement, LegBreakdownProps>(function LegBreakdown(
  { title, summary, legs, chartLabel, dwellLabel, total, className, ...rest },
  ref,
) {
  const sum = legs.reduce(
    (running, leg) => running + (Number.isFinite(leg.value) ? leg.value : 0),
    0,
  );
  const scale = clampProgress(sum, total ?? sum).max;
  const shares = legs.map((leg) => ({ leg, share: clampProgress(leg.value, scale) }));

  return (
    <section ref={ref} className={cn(styles.breakdown, className)} {...rest}>
      <header className={styles.head}>
        <span className={styles.title}>{title}</span>
        {summary && <span className={styles.summary}>{summary}</span>}
      </header>

      {/* Decorative: every segment is written out in the list below. */}
      <div className={styles.bar} role="img" aria-label={chartLabel}>
        {shares.map(({ leg, share }) => (
          <span
            key={leg.id}
            data-tone={leg.tone}
            style={{ '--share': `${share.percent}%` } as CSSProperties}
          >
            {leg.icon && <LogisticsIcon name={leg.icon} />}
          </span>
        ))}
      </div>

      <ul className={styles.legs}>
        {shares.map(({ leg, share }) => (
          <li key={leg.id} className={styles.leg}>
            <span className={styles.swatch} data-tone={leg.tone} aria-hidden="true" />
            <span className={styles.copy}>
              <span className={styles.label}>
                {leg.label}
                {leg.dwell && dwellLabel && (
                  <span className={styles.dwell}> · {dwellLabel}</span>
                )}
              </span>
              {leg.detail && <span className={styles.detail}>{leg.detail}</span>}
              <span className={styles.value}>
                {leg.valueLabel}
                <span className={styles.share}> · {roundPercent(share.percent)}%</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
});
