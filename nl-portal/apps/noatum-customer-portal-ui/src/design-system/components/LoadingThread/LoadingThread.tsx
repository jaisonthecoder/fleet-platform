import { forwardRef, type HTMLAttributes } from 'react';

import { busyAttributes } from '../../busy';
import { cn } from '../../utils';
import styles from './LoadingThread.module.css';

export interface LoadingThreadProps extends HTMLAttributes<HTMLDivElement> {
  /** What is refreshing, e.g. "Refreshing shipments". */
  label: string;
  /** False when a parent already announces this wait. */
  announce?: boolean;
}

/**
 * LD-10 · Boxless thread.
 *
 * No card, no scrim, nothing to lay out around: a 2px thread pinned under a
 * header or above a table while it refreshes. The lightest wait in the kit, and
 * the right one whenever the content below it is still readable.
 */
export const LoadingThread = forwardRef<HTMLDivElement, LoadingThreadProps>(
  function LoadingThread({ label, announce = true, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(styles.thread, className)}
        {...busyAttributes({ label, announce })}
        {...rest}
      >
        <span className={styles.run} />
      </div>
    );
  },
);
