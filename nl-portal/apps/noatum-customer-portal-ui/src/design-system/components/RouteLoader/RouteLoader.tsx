import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { busyAttributes } from '../../busy';
import { LogisticsIcon } from '../../icons';
import type { LogisticsIconName } from '../../icons/logistics-icon-data';
import { cn } from '../../utils';
import styles from './RouteLoader.module.css';

export interface RouteLoaderStep {
  id: string;
  label: ReactNode;
  state: 'done' | 'current' | 'waiting';
}

export interface RouteLoaderProps extends HTMLAttributes<HTMLElement> {
  /** e.g. "Searching Sea FCL · import". */
  eyebrow: ReactNode;
  /** e.g. "Usually under 20 seconds". */
  estimate?: ReactNode;
  originCode: ReactNode;
  originName?: ReactNode;
  destinationCode: ReactNode;
  destinationName?: ReactNode;
  modeIcon: LogisticsIconName;
  /**
   * What is happening right now, e.g. "Asking 14 carriers for space on this
   * lane". This is the only thing announced, and it is what makes the wait
   * read as movement on the user's own shipment rather than a generic delay.
   */
  message: string;
  steps?: readonly RouteLoaderStep[];
  /** Words for the step states, so the tick is never the only signal. */
  doneLabel?: string;
  currentLabel?: string;
}

/**
 * LD-01 · Route loader, the signature wait.
 *
 * The lane the user asked about becomes the progress bar: the mode marker sails
 * from origin to destination and the work behind the scenes ticks off as it
 * goes.
 *
 * Only the message line is a live region. Wrapping the whole card in one, as
 * this previously did, re-announces the route, the ports and every step each
 * time any prop changes.
 */
export const RouteLoader = forwardRef<HTMLElement, RouteLoaderProps>(function RouteLoader(
  {
    eyebrow,
    estimate,
    originCode,
    originName,
    destinationCode,
    destinationName,
    modeIcon,
    message,
    steps,
    doneLabel,
    currentLabel,
    className,
    ...rest
  },
  ref,
) {
  return (
    <section ref={ref} className={cn(styles.loader, className)} aria-busy {...rest}>
      <header className={styles.head}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        {estimate && <span className={styles.estimate}>{estimate}</span>}
      </header>

      <div className={styles.route}>
        <span className={styles.port}>
          <span className={styles.code}>{originCode}</span>
          {originName && <span className={styles.name}>{originName}</span>}
        </span>

        <span className={styles.track} aria-hidden="true">
          <span className={styles.rail} />
          <span className={styles.wake} />
          <span className={styles.marker}>
            <LogisticsIcon name={modeIcon} />
          </span>
        </span>

        <span className={styles.port} data-align="end">
          <span className={styles.code}>{destinationCode}</span>
          {destinationName && <span className={styles.name}>{destinationName}</span>}
        </span>
      </div>

      {/* The only live region on the card. */}
      <p className={styles.message} {...busyAttributes({ label: message, labelIsVisible: true })}>
        {message}
      </p>

      {steps?.length ? (
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.id} data-state={step.state}>
              <span className={styles.tick} aria-hidden="true" />
              {step.label}
              {step.state === 'done' && doneLabel && (
                <span className="noa-visually-hidden">, {doneLabel}</span>
              )}
              {step.state === 'current' && currentLabel && (
                <span className="noa-visually-hidden">, {currentLabel}</span>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
});
