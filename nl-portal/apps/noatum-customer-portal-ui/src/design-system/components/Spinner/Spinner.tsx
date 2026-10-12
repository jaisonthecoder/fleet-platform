import { forwardRef, type HTMLAttributes } from 'react';

import { busyAttributes } from '../../busy';
import { cn } from '../../utils';
import styles from './Spinner.module.css';

export type SpinnerVariant = 'arc' | 'twin' | 'sweep' | 'orbit' | 'cube';
export type SpinnerSize = 14 | 16 | 18 | 20;

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** What is happening, e.g. "Saving". */
  label: string;
  /** Renders the label beside the spinner. */
  visibleLabel?: boolean;
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  /** False when a parent already announces this wait. */
  announce?: boolean;
}

/**
 * LD-13 · Compact spinners.
 *
 * Five treatments at four sizes, none above 20px. The kit has no large centred
 * spinner on purpose: a wait big enough to need one is a wait that should say
 * what it is doing, which is LD-01's job.
 *
 * When the label is shown it is not also set as an attribute — an `aria-label`
 * over visible text overrides what is on screen.
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { label, visibleLabel = false, variant = 'arc', size = 16, announce = true, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(styles.wait, className)}
      data-variant={variant}
      data-size={size}
      {...busyAttributes({ label, labelIsVisible: visibleLabel, announce })}
      {...rest}
    >
      <span className={styles.mark} aria-hidden="true">
        {variant === 'twin' && <span />}
        {variant === 'orbit' && <span />}
        {variant === 'cube' && <span />}
      </span>
      {visibleLabel && <span className={styles.label}>{label}</span>}
    </span>
  );
});
