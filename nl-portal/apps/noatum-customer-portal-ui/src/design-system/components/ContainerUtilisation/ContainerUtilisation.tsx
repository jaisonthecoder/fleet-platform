import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { clampProgress, roundPercent } from '../../measure';
import { cn } from '../../utils';
import styles from './ContainerUtilisation.module.css';

export interface UtilisationMeasure {
  /** e.g. "Volume". Named, because which measure binds is the whole question. */
  name: string;
  value: number;
  max: number;
  /** Formatted for display, e.g. "62.4 of 76 m³". The caller owns units. */
  valueLabel: ReactNode;
}

export interface ContainerUtilisationProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** e.g. "2 × 40' HC". */
  title: ReactNode;
  /** Which measure binds, e.g. "Volume is the limit". */
  constraint?: ReactNode;
  volume: UtilisationMeasure;
  payload: UtilisationMeasure;
  /** Names the drawn container for assistive technology. */
  chartLabel: string;
  note?: ReactNode;
}

/**
 * SP-04 · Container utilisation.
 *
 * Volume and payload read against the same container, with the binding
 * constraint called out. The fill rises inside a drawn container face, and the
 * water line carries its own figure.
 *
 * Both measures go through clampProgress: a zero maximum previously rendered a
 * completely full container, because `<progress max="0">` is invalid and the
 * browser substitutes 1.
 */
export const ContainerUtilisation = forwardRef<HTMLElement, ContainerUtilisationProps>(
  function ContainerUtilisation(
    { title, constraint, volume, payload, chartLabel, note, className, ...rest },
    ref,
  ) {
    const volumeFill = clampProgress(volume.value, volume.max);
    const payloadFill = clampProgress(payload.value, payload.max);
    const shown = roundPercent(volumeFill.percent);

    return (
      <section ref={ref} className={cn(styles.utilisation, className)} {...rest}>
        <header className={styles.head}>
          <span className={styles.title}>{title}</span>
          {constraint && <span className={styles.constraint}>{constraint}</span>}
        </header>

        <div
          className={styles.container}
          role="img"
          aria-label={`${chartLabel}: ${volume.name} ${shown}%`}
          style={{ '--fill': `${volumeFill.percent}%` } as CSSProperties}
        >
          <span className={styles.fill} />
          <span className={styles.post} data-side="start" />
          <span className={styles.post} data-side="end" />
          <span className={styles.ribs} />
          <span className={styles.waterline} />
          <span className={styles.waterlineLabel}>
            {shown}% {volume.name.toLocaleLowerCase()}
          </span>
        </div>

        <dl className={styles.measures}>
          {[volume, payload].map((measure, index) => {
            const fill = index === 0 ? volumeFill : payloadFill;
            return (
              <div key={measure.name} className={styles.measure}>
                <dt>{measure.name}</dt>
                <dd>
                  <span className={styles.track} aria-hidden="true">
                    <span style={{ '--fill': `${fill.percent}%` } as CSSProperties} />
                  </span>
                  <span className={styles.figure}>
                    {measure.valueLabel}
                    <span className={styles.percent}> · {roundPercent(fill.percent)}%</span>
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>

        {note && <p className={styles.note}>{note}</p>}
      </section>
    );
  },
);
