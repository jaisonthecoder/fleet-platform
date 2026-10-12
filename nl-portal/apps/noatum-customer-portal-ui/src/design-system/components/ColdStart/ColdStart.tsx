import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { busyAttributes } from '../../busy';
import { cn } from '../../utils';
import styles from './ColdStart.module.css';

export type ColdStartVariant = 'dark' | 'light' | 'bays' | 'network' | 'board';

export interface ColdStartItem {
  id: string;
  /** The module coming online, or the figure's label. */
  label: ReactNode;
  /** Only the board and network variants show a value. */
  value?: ReactNode;
  tone?: 'action' | 'success' | 'attention' | 'neutral';
}

export interface ColdStartProps extends HTMLAttributes<HTMLElement> {
  variant?: ColdStartVariant;
  /** The wordmark, e.g. "NOATUM". */
  brand: ReactNode;
  /** The lockup's second word, e.g. "LOGISTICS". */
  brandSuffix?: ReactNode;
  /** What is happening. Announced once. */
  label: string;
  /** Shown under the wordmark on the two splash variants. */
  message?: ReactNode;
  /** Bays, network nodes or board rows, depending on the variant. */
  items?: readonly ColdStartItem[];
}

/**
 * LD-05 … LD-09 · Cold start.
 *
 * Only for the first paint after sign-in, when there is genuinely nothing to
 * show yet. Five treatments of the same moment:
 *
 * - `dark` / `light` — the wordmark and a single leg drawing underneath it.
 * - `bays` — five bays filling in sequence, each one a module coming online,
 *   so the wait doubles as a map of the platform.
 * - `network` — the rotation lighting up node by node.
 * - `board` — the user's own counts dropping in a line at a time, so by the
 *   time the app is ready they have already read their morning.
 *
 * One live region carries the label; the decoration is hidden, because a
 * screen reader should hear "Preparing your portal", not five bay names
 * arriving one at a time.
 */
export const ColdStart = forwardRef<HTMLElement, ColdStartProps>(function ColdStart(
  { variant = 'dark', brand, brandSuffix, label, message, items, className, ...rest },
  ref,
) {
  const isBoard = variant === 'board';

  return (
    <section
      ref={ref}
      className={cn(styles.splash, className)}
      data-variant={variant}
      {...busyAttributes({ label })}
      {...rest}
    >
      <header className={styles.brand} aria-hidden="true">
        <span className={styles.word}>{brand}</span>
        {brandSuffix && <span className={styles.suffix}>{brandSuffix}</span>}
        {/* LD-06 passes a light sweep across the wordmark once per cycle. */}
        {variant === 'light' && <span className={styles.sweep} />}
      </header>

      {(variant === 'dark' || variant === 'light') && (
        <>
          {/* Two layers: the line draws left to right, and a dot rides its
              leading edge. Without the dot the gesture has no head. */}
          <span className={styles.leg} aria-hidden="true">
            <span className={styles.legClip}>
              <span className={styles.legRun} />
            </span>
            <span className={styles.legSlide}>
              <span className={styles.legDot} />
            </span>
          </span>
          {message && <p className={styles.message}>{message}</p>}
        </>
      )}

      {variant === 'bays' && items?.length ? (
        <div className={styles.bays} aria-hidden="true">
          {items.map((item, index) => (
            <span key={item.id} style={{ animationDelay: `${index * 180}ms` }}>
              <i data-tone={item.tone} />
              <small>{item.label}</small>
            </span>
          ))}
        </div>
      ) : null}

      {variant === 'network' && items?.length ? (
        <ol className={styles.network} aria-hidden="true">
          {items.map((item, index) => (
            <li key={item.id} style={{ animationDelay: `${index * 220}ms` }}>
              <i data-tone={item.tone} />
              <span>{item.label}</span>
              {item.value && <strong>{item.value}</strong>}
            </li>
          ))}
        </ol>
      ) : null}

      {isBoard && items?.length ? (
        <ol className={styles.board} aria-hidden="true">
          {items.map((item, index) => (
            <li key={item.id} style={{ animationDelay: `${index * 200}ms` }}>
              <span>{item.label}</span>
              <strong data-tone={item.tone}>{item.value}</strong>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
});
