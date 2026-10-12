import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { clampProgress, roundPercent } from '../../measure';
import { cn } from '../../utils';
import styles from './RingGauge.module.css';

/** The ring is r=44 in a 104 box, so its circumference is fixed. */
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface RingGaugeFact {
  id: string;
  label: ReactNode;
  value: ReactNode;
}

export interface RingGaugeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 0–100. Anything outside, or not a number, is clamped rather than drawn off-ring. */
  value: number;
  /** Names the gauge, e.g. "Emissions against the worst mode". */
  label: string;
  /** Shown inside the ring. Defaults to the rounded percentage. */
  valueLabel?: ReactNode;
  /** The small line under the value, e.g. "OF WORST". */
  caption?: ReactNode;
  /** Read alongside the ring, so the figures are available as text. */
  facts?: readonly RingGaugeFact[];
  /** Turns the ring the action colour instead of success green. */
  tone?: 'success' | 'action' | 'attention';
  /** Formats the announced value. Defaults to "<rounded> percent". */
  formatValueText?: (percent: number) => string;
}

/**
 * DA-06 · Ring gauge and fact list.
 *
 * A 12px ring on a #F0EFEC track, drawn from twelve o'clock, beside the same
 * numbers written out. The fact list is not decoration: it is how the figures
 * reach anyone who cannot read the ring.
 */
export const RingGauge = forwardRef<HTMLDivElement, RingGaugeProps>(function RingGauge(
  {
    value,
    label,
    valueLabel,
    caption,
    facts,
    tone = 'success',
    formatValueText,
    className,
    ...rest
  },
  ref,
) {
  const measure = clampProgress(value, 100);
  const percent = roundPercent(measure.percent);
  const filled = (measure.ratio * CIRCUMFERENCE).toFixed(2);
  const rest_ = (CIRCUMFERENCE - measure.ratio * CIRCUMFERENCE).toFixed(2);

  return (
    <div ref={ref} className={cn(styles.gauge, className)} data-tone={tone} {...rest}>
      <span className={styles.ring}>
        <svg viewBox="0 0 104 104" role="img" aria-label={`${label}: ${
          formatValueText ? formatValueText(percent) : `${percent} percent`
        }`}>
          <circle className={styles.track} cx="52" cy="52" r={RADIUS} fill="none" strokeWidth="12" />
          <circle
            className={styles.value}
            cx="52"
            cy="52"
            r={RADIUS}
            fill="none"
            strokeWidth="12"
            /*
             * Butt at zero. A round cap on a zero-length dash is still drawn —
             * SVG paints the cap — so an empty gauge showed a dot at twelve
             * o'clock that read as "something is done".
             */
            strokeLinecap={measure.ratio > 0 ? 'round' : 'butt'}
            strokeDasharray={`${filled} ${rest_}`}
            transform="rotate(-90 52 52)"
          />
        </svg>
        <span className={styles.readout} aria-hidden="true">
          <span className={styles.figure}>{valueLabel ?? `${percent}%`}</span>
          {caption && <span className={styles.caption}>{caption}</span>}
        </span>
      </span>

      {facts?.length ? (
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.id} className={styles.fact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
});
