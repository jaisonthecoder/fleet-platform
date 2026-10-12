import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { busyAttributes } from '../../busy';
import { clampProgress, roundPercent } from '../../measure';
import { cn } from '../../utils';
import styles from './ContainerFill.module.css';

export interface ContainerFillProps extends HTMLAttributes<HTMLDivElement> {
  /** What is being processed, e.g. "Generating documents". */
  label: string;
  /** Done so far. Omit for an indeterminate fill. */
  value?: number;
  /** Total. Omit for an indeterminate fill. */
  max?: number;
  /** The count line, e.g. "18 of 24 documents". Says what is actually happening. */
  detail?: ReactNode;
  /** False when a parent already announces this wait. */
  announce?: boolean;
}

/**
 * LD-02 · Container fill, determinate.
 *
 * For work with a known size — uploading a packing list, generating documents,
 * exporting a report. The container fills and the count says what is actually
 * being processed, which is the part a percentage alone never tells you.
 *
 * With no `value` it falls back to an indeterminate fill, so a caller that
 * cannot count does not have to fake a number.
 */
export const ContainerFill = forwardRef<HTMLDivElement, ContainerFillProps>(
  function ContainerFill(
    { label, value, max, detail, announce = true, className, ...rest },
    ref,
  ) {
    const determinate = value !== undefined && max !== undefined;
    const fill = determinate ? clampProgress(value, max) : undefined;
    const percent = fill ? roundPercent(fill.percent) : undefined;

    return (
      <div
        ref={ref}
        className={cn(styles.fill, className)}
        data-determinate={determinate || undefined}
        {...busyAttributes({
          label: determinate ? `${label}, ${percent}%` : label,
          announce,
        })}
        {...rest}
      >
        <div
          className={styles.box}
          aria-hidden="true"
          style={fill ? ({ '--fill': `${fill.percent}%` } as CSSProperties) : undefined}
        >
          <span className={styles.water} />
          <span className={styles.post} data-side="start" />
          <span className={styles.post} data-side="end" />
          <span className={styles.ribs} />
        </div>

        <div className={styles.copy}>
          <p className={styles.label}>{label}</p>
          {detail && <p className={styles.detail}>{detail}</p>}
          {percent !== undefined && <p className={styles.percent}>{percent}%</p>}
        </div>
      </div>
    );
  },
);
