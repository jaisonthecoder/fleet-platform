import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { LogisticsIcon } from '../../icons';
import type { LogisticsIconName } from '../../icons/logistics-icon-data';
import { cn } from '../../utils';
import styles from './HeroBand.module.css';

export interface HeroRoute {
  /** e.g. "CNTAO". Shown large. */
  fromCode: ReactNode;
  /** e.g. "Qingdao". The quiet line under the code. */
  fromLabel?: ReactNode;
  toCode: ReactNode;
  toLabel?: ReactNode;
  /** The marker riding the line. */
  icon: LogisticsIconName;
  /** Names the pair for assistive technology, e.g. "Qingdao to Valencia". */
  label: string;
}

export interface HeroBandProps extends HTMLAttributes<HTMLElement> {
  /** CH-04, drawn above everything else in the band. */
  breadcrumb?: ReactNode;
  /** e.g. "IMPORT · SEA FCL · PORT TO DOOR". Upper-cased by the caller. */
  eyebrow?: ReactNode;
  route?: HeroRoute;
  /** Short state chips, right-aligned beside the route. */
  chips?: ReactNode;
  /** Band-level actions, e.g. "Start from a template". */
  actions?: ReactNode;
  /**
   * Room left at the foot of the band for the page content to rise into.
   * The page pulls itself up by `--noa-hero-rise`; leave it off for a band
   * nothing overlaps.
   */
  rise?: boolean;
  children?: ReactNode;
}

/**
 * CH-09 · Hero band, route.
 *
 * The dark band that opens a route-shaped page: the trail, what is being
 * requested, and the lane itself drawn as origin, line and destination. It runs
 * edge to edge while its contents stay on the page measure, so the band belongs
 * to the browser window and the content belongs to the page.
 *
 * With `rise`, the band keeps 96px of empty navy at its foot and the first card
 * of the page climbs into it. That overlap is the whole effect — it is what
 * makes the form read as one object with the band rather than two stacked
 * panels, so the page and the band have to agree on the measure.
 */
export const HeroBand = forwardRef<HTMLElement, HeroBandProps>(function HeroBand(
  { breadcrumb, eyebrow, route, chips, actions, rise = false, children, className, ...rest },
  ref,
) {
  return (
    <section
      ref={ref}
      data-rise={rise ? 'true' : undefined}
      className={cn(styles.band, className)}
      {...rest}
    >
      <div className={styles.pattern} aria-hidden="true" />

      <div className={styles.inner}>
        {breadcrumb}

        {(eyebrow || route || chips || actions) && (
          <div className={styles.panel}>
            <div className={styles.lane}>
              {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}

              {route && (
                <div className={styles.route} role="group" aria-label={route.label}>
                  <div className={styles.end}>
                    <span className={styles.code}>{route.fromCode}</span>
                    {route.fromLabel && <span className={styles.place}>{route.fromLabel}</span>}
                  </div>

                  <div className={styles.line} aria-hidden="true">
                    <span className={styles.track} />
                    <span className={styles.run} />
                    <span className={styles.marker}>
                      <LogisticsIcon name={route.icon} size={16} />
                    </span>
                  </div>

                  <div className={cn(styles.end, styles.endTo)}>
                    <span className={styles.code}>{route.toCode}</span>
                    {route.toLabel && <span className={styles.place}>{route.toLabel}</span>}
                  </div>
                </div>
              )}
            </div>

            {(chips || actions) && (
              <div className={styles.side}>
                {chips && <div className={styles.chips}>{chips}</div>}
                {actions && <div className={styles.actions}>{actions}</div>}
              </div>
            )}
          </div>
        )}

        {children}
      </div>
    </section>
  );
});

/** A state chip for the band. `solid` is the one chip that carries the mode. */
export function HeroChip({
  tone = 'ghost',
  children,
}: {
  tone?: 'solid' | 'ghost' | 'alert';
  children: ReactNode;
}) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}
