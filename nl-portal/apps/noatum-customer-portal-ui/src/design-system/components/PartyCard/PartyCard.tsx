import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './PartyCard.module.css';

export interface PartyCardProps extends HTMLAttributes<HTMLElement> {
  /** The role this card fills, e.g. "Shipper". Also names the control. */
  role: string;
  /** A note about the role, e.g. "Same as consignee". */
  badge?: ReactNode;
  /**
   * The control that picks the party — a Select, a combobox, whatever the
   * screen needs. The card supplies the label and the id; it does not decide
   * what the control is.
   */
  children: ReactNode;
  /** e.g. "Pudong warehouse, CN · contact Wei Zhang". */
  detail?: ReactNode;
  /**
   * Navy marks a reference role (notify party, agent); action marks one the
   * customer is responsible for. Never the only signal — the role name says it.
   */
  tone?: 'action' | 'navy';
}

/**
 * SE-06 · Party card.
 *
 * One role in the shipment, its chosen party, and the line that says who that
 * actually is. The card owns the label and the control's id so the role is
 * always announced with the control, whatever control the screen supplies.
 */
export const PartyCard = forwardRef<HTMLElement, PartyCardProps>(function PartyCard(
  { role, badge, children, detail, tone = 'action', className, ...rest },
  ref,
) {
  const labelId = useId();
  return (
    <section
      ref={ref}
      className={cn(styles.card, className)}
      data-tone={tone}
      aria-labelledby={labelId}
      {...rest}
    >
      <header className={styles.head}>
        <h3 id={labelId} className={styles.role}>
          {role}
        </h3>
        {badge && <span className={styles.badge}>{badge}</span>}
      </header>

      <div className={styles.control}>{children}</div>

      {detail && <p className={styles.detail}>{detail}</p>}
    </section>
  );
});
