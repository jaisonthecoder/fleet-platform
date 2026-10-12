import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { busyAttributes } from '../../busy';
import { cn } from '../../utils';
import styles from './InlineTextWait.module.css';

export interface InlineTextWaitProps extends HTMLAttributes<HTMLSpanElement> {
  /** What is resolving, e.g. "Finding the transit time". */
  label: string;
  /**
   * `crossing` puts a travelling marker between two codes — for a route whose
   * transit time is still being worked out. `dots` breathes three dots after a
   * label, for a single figure.
   */
  variant?: 'crossing' | 'dots';
  /** The text either side of the marker, e.g. "CNTAO" and "ESVLC". */
  from?: ReactNode;
  to?: ReactNode;
  /** The label shown before the dots. */
  text?: ReactNode;
  /** False when a parent already announces this wait. */
  announce?: boolean;
}

/**
 * LD-11 · Inline text wait.
 *
 * For a figure or a cell that is still resolving: the text stays, a marker
 * crosses between the two codes, or three dots breathe after the label.
 *
 * Nothing shifts when the value lands — which is the whole reason this exists
 * rather than a spinner. A cell that collapses and reappears moves the row
 * under the reader's eye.
 */
export const InlineTextWait = forwardRef<HTMLSpanElement, InlineTextWaitProps>(
  function InlineTextWait(
    { label, variant = 'crossing', from, to, text, announce = true, className, ...rest },
    ref,
  ) {
    return (
      <span
        ref={ref}
        className={cn(styles.wait, className)}
        data-variant={variant}
        {...busyAttributes({ label, announce })}
        {...rest}
      >
        {variant === 'crossing' ? (
          <>
            {from}
            <span className={styles.track} aria-hidden="true">
              <span className={styles.marker} />
            </span>
            {to}
          </>
        ) : (
          <>
            {text}
            <span className={styles.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </>
        )}
      </span>
    );
  },
);
