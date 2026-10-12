import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { clampProgress } from '../../measure';
import { cn } from '../../utils';
import styles from './StatTile.module.css';

export type StatTone = 'action' | 'navy' | 'success' | 'attention' | 'neutral';

export interface SparkBar {
  /** 0–100. Height of the bar. */
  value: number;
  /** Draws this bar solid rather than tinted — the periods that matter. */
  emphasis?: boolean;
}

export interface StatTileProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  label: ReactNode;
  /** The figure itself, already formatted. */
  value: ReactNode;
  tone?: StatTone;
  /** Six or so bars. Omit for a tile with no history. */
  bars?: readonly SparkBar[];
  /**
   * What the bars represent, e.g. "Six weeks to 20.09". Required with bars:
   * a row of shapes with no caption tells a screen reader nothing.
   */
  barsLabel?: string;
  /** Makes the whole tile activatable. */
  onSelect?: () => void;
}

/**
 * DA-02 · Stat tile with spark bars.
 *
 * A figure, a semantic top rail, and a short history underneath. The bars are
 * finite heights rather than a chart, so the tile stays cheap and legible at
 * 190px.
 */
export const StatTile = forwardRef<HTMLElement, StatTileProps>(function StatTile(
  { label, value, tone = 'action', bars, barsLabel, onSelect, className, ...rest },
  ref,
) {
  const Tag = onSelect ? 'button' : 'article';
  return (
    <Tag
      ref={ref as never}
      className={cn(styles.tile, className)}
      data-tone={tone}
      {...(onSelect ? { type: 'button' as const, onClick: onSelect } : {})}
      {...rest}
    >
      <span className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.figure}>{value}</span>
      </span>

      {bars?.length ? (
        <span className={styles.bars} role="img" aria-label={barsLabel}>
          {bars.map((bar, index) => (
            <span
              key={index}
              data-emphasis={bar.emphasis || undefined}
              style={{ '--height': `${clampProgress(bar.value, 100).percent}%` } as CSSProperties}
            />
          ))}
        </span>
      ) : null}
    </Tag>
  );
});
