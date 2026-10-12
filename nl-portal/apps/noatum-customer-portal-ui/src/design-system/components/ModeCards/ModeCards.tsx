import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { LogisticsIcon } from '../../icons';
import type { LogisticsIconName } from '../../icons/logistics-icon-data';
import { RadioGroup, RadioGroupCard } from '../../primitives/radio-group';
import { cn } from '../../utils';
import styles from './ModeCards.module.css';

export interface ModeCardOption {
  value: string;
  /** e.g. "Sea FCL". */
  label: ReactNode;
  /** e.g. "Full container, port to port". */
  description?: ReactNode;
  icon: LogisticsIconName;
  disabled?: boolean;
}

export interface ModeCardsProps
  extends Omit<ComponentPropsWithoutRef<typeof RadioGroup>, 'children' | 'onValueChange'> {
  /** Names the group, e.g. "Transport mode". */
  label: string;
  /** Renders the label above the cards as well as naming the group, as SE-02 and SE-03 do. */
  showLabel?: boolean;
  options: readonly ModeCardOption[];
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * SE-01 · Transport mode cards.
 *
 * A single choice drawn as cards: 2px border turning to the action colour when
 * selected, and an icon tile that inverts with it. The grid is auto-fit from
 * 150px, so it reflows rather than scrolling.
 *
 * Built on the Radix radio group, so arrow keys move between cards, only the
 * selected card is in the tab order, and the whole card is the target.
 */
export const ModeCards = forwardRef<HTMLDivElement, ModeCardsProps>(function ModeCards(
  { label, showLabel = false, options, value, onValueChange, className, ...rest },
  ref,
) {
  return (
    <div className={styles.field}>
      {showLabel && <p className={styles.eyebrow}>{label}</p>}
      <RadioGroup
        ref={ref}
        aria-label={label}
        value={value}
        onValueChange={onValueChange}
        className={cn(styles.grid, className)}
        {...rest}
      >
        {options.map((option) => (
          <RadioGroupCard
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={styles.card}
          >
            <span className={styles.tile}>
              <LogisticsIcon name={option.icon} size={24} />
            </span>
            <span className={styles.copy}>
              <span className={styles.title}>{option.label}</span>
              {option.description && (
                <>
                  {/* A separator text node, so the name is not run together. */}
                  <span className="noa-visually-hidden"> </span>
                  <span className={styles.sub}>{option.description}</span>
                </>
              )}
            </span>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </div>
  );
});
