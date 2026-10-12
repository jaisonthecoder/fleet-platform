import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './SparklineTrend.module.css';

const WIDTH = 320;
const HEIGHT = 90;
/** Keeps the stroke off the top and bottom edges of the box. */
const PADDING = 8;

export interface SparklineTrendProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** At least two points. One point cannot describe a trend and is not drawn. */
  points: readonly number[];
  /** One per point, e.g. months. Drawn under the chart and used in the table. */
  labels?: readonly string[];
  /** The badge, e.g. "Down 12%". */
  trend?: ReactNode;
  trendTone?: 'success' | 'attention' | 'action' | 'neutral';
  /** Names the chart for assistive technology. */
  chartLabel: string;
  /** Column heading for the values in the text alternative. */
  valueHeading?: string;
  /** Formats a point for the text alternative. */
  formatValue?: (value: number) => string;
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: ReactNode;
}

/**
 * DA-07 · Sparkline trend.
 *
 * A filled area and a 2.5px line, drawn as plain SVG. The same series is
 * repeated as a visually hidden table, because a path exposes no values at all
 * and the badge alone does not say what the shape was.
 *
 * A single point renders the empty state rather than an invisible path and a
 * stray filled triangle.
 */
export const SparklineTrend = forwardRef<HTMLElement, SparklineTrendProps>(
  function SparklineTrend(
    {
      title,
      description,
      points,
      labels,
      trend,
      trendTone = 'success',
      chartLabel,
      valueHeading = 'Value',
      formatValue = (value) => String(value),
      empty,
      className,
      ...rest
    },
    ref,
  ) {
    const tableId = useId();
    const usable = points.filter((point) => Number.isFinite(point));
    const drawable = usable.length >= 2;

    let line = '';
    let area = '';
    if (drawable) {
      const low = Math.min(...usable);
      const high = Math.max(...usable);
      const span = high - low || 1;
      const stepX = WIDTH / (usable.length - 1);
      const coords = usable.map((point, index) => {
        const x = index * stepX;
        const y = PADDING + (1 - (point - low) / span) * (HEIGHT - PADDING * 2);
        return `${x} ${y.toFixed(2)}`;
      });
      line = `M${coords.join(' L')}`;
      area = `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;
    }

    return (
      <figure ref={ref} className={cn(styles.chart, className)} data-tone={trendTone} {...rest}>
        <figcaption className={styles.head}>
          <span className={styles.copy}>
            <span className={styles.title}>{title}</span>
            {description && <span className={styles.description}>{description}</span>}
          </span>
          {trend && <span className={styles.trend}>{trend}</span>}
        </figcaption>

        {drawable ? (
          <>
            <svg
              className={styles.svg}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={chartLabel}
              aria-describedby={tableId}
            >
              <path className={styles.area} d={area} />
              <path className={styles.line} d={line} fill="none" vectorEffect="non-scaling-stroke" />
            </svg>

            {labels?.length ? (
              <div className={styles.labels} aria-hidden="true">
                {labels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            ) : null}

            {/* The values themselves, for anyone who cannot read the shape. */}
            <table id={tableId} className="noa-visually-hidden">
              <caption>{chartLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">Point</th>
                  <th scope="col">{valueHeading}</th>
                </tr>
              </thead>
              <tbody>
                {usable.map((point, index) => (
                  <tr key={labels?.[index] ?? index}>
                    <th scope="row">{labels?.[index] ?? String(index + 1)}</th>
                    <td>{formatValue(point)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className={styles.empty}>{empty}</p>
        )}
      </figure>
    );
  },
);
