import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { busyAttributes } from '../../busy';
import { cn } from '../../utils';
import styles from './RefreshOverlay.module.css';

export interface RefreshOverlayProps extends HTMLAttributes<HTMLDivElement> {
  /** What is refreshing, e.g. "Refreshing shipments". Shown over the content. */
  label: string;
  /** True while the refresh is running. False renders the children alone. */
  busy?: boolean;
  children: ReactNode;
}

/**
 * LD-12 · Transparent overlay.
 *
 * When a view is refreshing in place, the content stays readable at 45% and
 * only the thread and one line of copy sit over it.
 *
 * No panel, no blur, no spinner in the middle of the screen — the point is that
 * the user can still read what is there while it updates. The content is also
 * left interactive: dimming it is a signal, not a lock.
 */
export const RefreshOverlay = forwardRef<HTMLDivElement, RefreshOverlayProps>(
  function RefreshOverlay({ label, busy = false, children, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(styles.wrap, className)}
        data-busy={busy || undefined}
        {...rest}
      >
        <div className={styles.content}>{children}</div>

        {busy && (
          <div className={styles.overlay} {...busyAttributes({ label, labelIsVisible: true })}>
            <span className={styles.thread}>
              <span />
            </span>
            <p className={styles.label}>{label}</p>
          </div>
        )}
      </div>
    );
  },
);
