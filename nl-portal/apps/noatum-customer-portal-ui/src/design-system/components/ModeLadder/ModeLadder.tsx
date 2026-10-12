import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { clampProgress } from '../../measure';
import { cn } from '../../utils';
import styles from './ModeLadder.module.css';

export interface ModeLadderItem {
  id: string;
  /** e.g. "Sea FCL". */
  label: ReactNode;
  /** The quiet note after the label, e.g. "32 days". */
  detail?: ReactNode;
  value: number;
  /** Formatted for display, e.g. "1,240 kg". The caller owns units. */
  valueLabel: ReactNode;
  /** The chosen option. Drawn in the action colour. */
  selected?: boolean;
  /** The best option on this measure. Drawn in success green. */
  preferred?: boolean;
}

export interface ModeLadderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  items: readonly ModeLadderItem[];
  /** Names the chart, e.g. "Emissions by transport mode". */
  label: string;
  /** Bars are drawn against this. Defaults to the largest value present. */
  maximum?: number;
  /** Makes each row activatable. Without it the ladder is read-only. */
  onSelect?: (id: string) => void;
  /** Words for the two states, so colour is never the only signal. */
  selectedLabel?: string;
  preferredLabel?: string;
}

/**
 * DA-05 · Mode ladder.
 *
 * Horizontal bars on a #F0EFEC track: the chosen mode in the action colour, the
 * best on this measure in success green, the rest neutral. Plain markup, no
 * chart library.
 */
export const ModeLadder = forwardRef<HTMLDivElement, ModeLadderProps>(function ModeLadder(
  { items, label, maximum, onSelect, selectedLabel, preferredLabel, className, ...rest },
  ref,
) {
  // Without a guard one non-finite value collapses every bar in the group.
  const largest = items.reduce(
    (top, item) => (Number.isFinite(item.value) ? Math.max(top, item.value) : top),
    0,
  );
  const scale = clampProgress(largest, maximum ?? largest).max;

  return (
    <div ref={ref} role="group" aria-label={label} className={cn(styles.ladder, className)} {...rest}>
      {items.map((item) => {
        const bar = clampProgress(item.value, scale);
        const tone = item.selected ? 'selected' : item.preferred ? 'preferred' : 'neutral';
        const Row = onSelect ? 'button' : 'div';
        return (
          <Row
            key={item.id}
            className={styles.row}
            data-tone={tone}
            {...(onSelect
              ? { type: 'button' as const, onClick: () => onSelect(item.id) }
              : {})}
          >
            <span className={styles.head}>
              <span className={styles.label}>
                {item.label}
                {item.detail && <span className={styles.detail}>{item.detail}</span>}
                {item.selected && selectedLabel && (
                  <span className="noa-visually-hidden">, {selectedLabel}</span>
                )}
                {item.preferred && !item.selected && preferredLabel && (
                  <span className="noa-visually-hidden">, {preferredLabel}</span>
                )}
              </span>
              <span className={styles.value}>{item.valueLabel}</span>
            </span>
            <span className={styles.track} aria-hidden="true">
              <span style={{ '--fill': `${bar.percent}%` } as CSSProperties} />
            </span>
          </Row>
        );
      })}
    </div>
  );
});
