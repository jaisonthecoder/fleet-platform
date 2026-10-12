import type { ReactNode } from 'react';

import styles from './StatCounter.module.css';

export interface StatCounterProps {
  label: string;
  /** Pre-formatted by the caller, who knows the locale and the unit. */
  value: string | number;
  /** Signed change, e.g. "+12%". Direction drives the colour. */
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'flat';
  icon?: ReactNode;
  loading?: boolean;
  /** Renders as a link/button when the tile drills into a filtered list. */
  onClick?: () => void;
}

/**
 * A dashboard tile.
 *
 * `value` is a string the caller has already formatted: currency and number formatting
 * depends on locale and on minor-unit handling that only the feature knows about.
 */
export function StatCounter({
  label,
  value,
  delta,
  deltaDirection = 'flat',
  icon,
  loading = false,
  onClick,
}: StatCounterProps) {
  const content = (
    <>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>

      {loading ? (
        <span className={styles.skeleton} aria-hidden="true" />
      ) : (
        <strong className={styles.value}>{value}</strong>
      )}

      {delta && !loading && (
        <span className={[styles.delta, styles[deltaDirection]].join(' ')}>{delta}</span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={[styles.tile, styles.clickable].join(' ')} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={styles.tile} aria-busy={loading || undefined}>
      {content}
    </div>
  );
}
