import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { clampProgress, roundPercent } from '../../measure';
import { cn } from '../../utils';
import styles from './ChargeBreakdown.module.css';

export type ChargeTone = 'navy' | 'action' | 'neutral' | 'tint';

export interface ChargeGroup {
  id: string;
  /** e.g. "Ocean freight". */
  label: ReactNode;
  /** The quiet second line, e.g. "2 × 40' HC including BAF and CAF". */
  detail?: ReactNode;
  value: number;
  /** Formatted with its currency code, e.g. "EUR 4,260". Never a symbol alone. */
  amount: ReactNode;
  tone: ChargeTone;
}

export interface ChargeBreakdownProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** e.g. "All-in EUR 7,420". */
  title: ReactNode;
  /** e.g. "per 2 × 40' HC · DAP Ribarroja". */
  basis?: ReactNode;
  groups: readonly ChargeGroup[];
  /** Names the stacked bar for assistive technology. */
  chartLabel: string;
  /** Heading of the excluded row, e.g. "Excluded". */
  excludedLabel?: ReactNode;
  /**
   * What the figure does not cover. A charge total that does not name its
   * exclusions is how a quotation gets argued, so this is prominent rather
   * than a footnote.
   */
  excluded?: ReactNode;
  /** Total the shares are measured against. Defaults to the sum of the groups. */
  total?: number;
}

/**
 * SP-06 · Charge breakdown.
 *
 * Origin, freight, destination and delivery stacked to the all-in figure, each
 * group proportional, so a quotation can be argued line by line.
 */
export const ChargeBreakdown = forwardRef<HTMLElement, ChargeBreakdownProps>(
  function ChargeBreakdown(
    { title, basis, groups, chartLabel, excludedLabel, excluded, total, className, ...rest },
    ref,
  ) {
    const sum = groups.reduce(
      (running, group) => running + (Number.isFinite(group.value) ? group.value : 0),
      0,
    );
    const scale = clampProgress(sum, total ?? sum).max;
    const shares = groups.map((group) => ({
      group,
      share: clampProgress(group.value, scale),
    }));

    return (
      <section ref={ref} className={cn(styles.breakdown, className)} {...rest}>
        <header className={styles.head}>
          <span className={styles.total}>{title}</span>
          {basis && <span className={styles.basis}>{basis}</span>}
        </header>

        {/* Decorative: every segment is repeated as a row below. */}
        <div className={styles.bar} role="img" aria-label={chartLabel}>
          {shares.map(({ group, share }) => (
            <span
              key={group.id}
              data-tone={group.tone}
              style={{ '--share': `${share.percent}%` } as CSSProperties}
            />
          ))}
        </div>

        <ul className={styles.rows}>
          {shares.map(({ group, share }) => (
            <li key={group.id} className={styles.row}>
              <span className={styles.swatch} data-tone={group.tone} aria-hidden="true" />
              <span className={styles.copy}>
                <span className={styles.label}>{group.label}</span>
                {group.detail && <span className={styles.detail}>{group.detail}</span>}
              </span>
              <span className={styles.amount}>{group.amount}</span>
              <span className={styles.share}>{roundPercent(share.percent)}%</span>
            </li>
          ))}
        </ul>

        {excluded && (
          <p className={styles.excluded}>
            <span>{excludedLabel}</span>
            <span>{excluded}</span>
          </p>
        )}
      </section>
    );
  },
);
