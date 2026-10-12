import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { LogisticsIcon } from '../../icons';
import type { LogisticsIconName } from '../../icons/logistics-icon-data';
import { clampProgress, roundPercent, scaleToTrack, TRACK_END, TRACK_START } from '../../measure';
import { cn } from '../../utils';
import styles from './RouteProgress.module.css';

export interface RouteProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** e.g. "CNSHA". */
  origin: ReactNode;
  /** e.g. "ESVLC". */
  destination: ReactNode;
  /** 0–100. */
  progress: number;
  /** The mode marker riding the track. */
  modeIcon: LogisticsIconName;
  /**
   * Names the cell, e.g. "Shanghai to Valencia". The percentage is appended,
   * so this is the route, not the whole sentence.
   */
  label: string;
  /** Formats the announced percentage. */
  formatProgress?: (percent: number) => string;
}

/**
 * DA-03 · Route progress cell.
 *
 * Origin and destination with a track between them and the mode riding it.
 * Small enough to live in a table row.
 *
 * The line and the marker share one mapping. They used to have two — the line
 * wrote the raw percentage into `x2` while the marker used `value - 5` clamped
 * to 0–90 and scaled — so the marker and the end of the line disagreed at every
 * value, and 0–2% and 98–100% collapsed into the caps.
 */
export const RouteProgress = forwardRef<HTMLDivElement, RouteProgressProps>(
  function RouteProgress(
    { origin, destination, progress, modeIcon, label, formatProgress, className, ...rest },
    ref,
  ) {
    const measure = clampProgress(progress, 100);
    const percent = roundPercent(measure.percent);
    const x = scaleToTrack(measure.percent);

    return (
      <div ref={ref} className={cn(styles.cell, className)} {...rest}>
        <span className={styles.port}>{origin}</span>

        <span
          className={styles.track}
          role="img"
          aria-label={`${label}: ${formatProgress ? formatProgress(percent) : `${percent} percent`}`}
        >
          <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
            <line
              className={styles.rest}
              x1={TRACK_START}
              y1="6"
              x2={TRACK_END}
              y2="6"
              vectorEffect="non-scaling-stroke"
            />
            <line
              className={styles.done}
              x1={TRACK_START}
              y1="6"
              x2={x}
              y2="6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* Same mapping as the line above, expressed as a percentage of the
              track so the marker cannot drift away from it. */}
          <span
            className={styles.marker}
            style={{ insetInlineStart: `${x}%` }}
            aria-hidden="true"
          >
            <LogisticsIcon name={modeIcon} />
          </span>
        </span>

        <span className={styles.port}>{destination}</span>
      </div>
    );
  },
);
