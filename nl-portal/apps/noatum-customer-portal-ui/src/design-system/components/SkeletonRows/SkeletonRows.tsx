import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';

import { busyAttributes } from '../../busy';
import { Skeleton } from '../../primitives/skeleton';
import { cn } from '../../utils';
import styles from './SkeletonRows.module.css';

export interface SkeletonRowsProps extends HTMLAttributes<HTMLDivElement> {
  /** What is loading, e.g. "Loading shipments". */
  label: string;
  /** Column headings, kept visible so the table holds its shape. */
  headings?: readonly string[];
  /** Grid template for the columns. Match the real table's. */
  columns?: string;
  rows?: number;
  /** False when a parent already announces this wait. */
  announce?: boolean;
}

/**
 * LD-04 · Skeleton rows.
 *
 * Lists and tables hold their shape while they load, so nothing jumps when the
 * rows land. The headings stay real text — only the cells are placeholders —
 * because a table whose headings also shimmer tells the user nothing about
 * what is coming.
 *
 * Built on the shadcn Skeleton, so the shimmer is defined once.
 */
export const SkeletonRows = forwardRef<HTMLDivElement, SkeletonRowsProps>(function SkeletonRows(
  {
    label,
    headings,
    columns = 'minmax(80px, 1fr) minmax(120px, 1.8fr) minmax(70px, 0.9fr) minmax(80px, 1fr)',
    rows = 5,
    announce = true,
    className,
    ...rest
  },
  ref,
) {
  const grid = { '--columns': columns } as CSSProperties;
  return (
    <div
      ref={ref}
      className={cn(styles.table, className)}
      {...busyAttributes({ label, announce })}
      {...rest}
    >
      {headings?.length ? (
        <div className={styles.headings} style={grid}>
          {headings.map((heading) => (
            <span key={heading}>{heading}</span>
          ))}
        </div>
      ) : null}

      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className={styles.row} style={grid} aria-hidden="true">
          {Array.from({ length: headings?.length ?? 4 }, (_, cell) => (
            <Skeleton key={cell} className={styles.cell} />
          ))}
        </div>
      ))}
    </div>
  );
});
