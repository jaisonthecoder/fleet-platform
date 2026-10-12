import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './IncotermStrip.module.css';

export interface HandoverStage {
  id: string;
  /** e.g. "Loading on board". */
  label: ReactNode;
  /** Who carries the cost of this stage. */
  payer: 'seller' | 'buyer';
  /** Risk passes at the end of this stage. At most one stage should carry it. */
  riskTransfers?: boolean;
}

export interface IncotermStripProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** e.g. "FOB · seller covers 6 of 11 stages". */
  title: ReactNode;
  /** e.g. "Seller pays to loading on board; risk passes at the ship's rail." */
  note?: ReactNode;
  stages: readonly HandoverStage[];
  /** Names the strip for assistive technology. */
  stripLabel: string;
  sellerLabel: string;
  buyerLabel: string;
  riskLabel: string;
}

/**
 * SP-07 · Incoterm handover strip.
 *
 * The stages of a door-to-door move coloured by who pays, with a marker where
 * risk transfers. Cost and risk are separate questions and the strip answers
 * both, which is why the marker is not simply where the colour changes.
 *
 * Every stage states its payer in text as well as colour, and the strip scrolls
 * rather than clipping on a narrow screen.
 */
export const IncotermStrip = forwardRef<HTMLElement, IncotermStripProps>(function IncotermStrip(
  { title, note, stages, stripLabel, sellerLabel, buyerLabel, riskLabel, className, ...rest },
  ref,
) {
  return (
    <section ref={ref} className={cn(styles.strip, className)} {...rest}>
      <header className={styles.head}>
        <span className={styles.title}>{title}</span>
        {note && <span className={styles.note}>{note}</span>}
      </header>

      {/* Focusable, because it scrolls: a scrolling region no keyboard can
          reach is unreadable below about 700px. */}
      <ol
        className={styles.stages}
        data-scroll="hair"
        role="list"
        aria-label={stripLabel}
        tabIndex={0}
      >
        {stages.map((stage) => (
          <li key={stage.id} className={styles.stage} data-payer={stage.payer}>
            <span className={styles.bar}>
              {stage.riskTransfers && <span className={styles.marker} aria-hidden="true" />}
            </span>
            <span className={styles.label} data-risk={stage.riskTransfers || undefined}>
              {stage.label}
              <span className="noa-visually-hidden">
                {', '}
                {stage.payer === 'seller' ? sellerLabel : buyerLabel}
                {stage.riskTransfers ? `, ${riskLabel}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className={styles.legend}>
        <span>
          <span className={styles.key} data-payer="seller" aria-hidden="true" />
          {sellerLabel}
        </span>
        <span>
          <span className={styles.key} data-payer="buyer" aria-hidden="true" />
          {buyerLabel}
        </span>
        <span>
          <span className={styles.key} data-risk aria-hidden="true" />
          {riskLabel}
        </span>
      </p>
    </section>
  );
});
