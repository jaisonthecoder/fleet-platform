import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { RadioGroup, RadioGroupCard } from '../../primitives/radio-group';
import { cn } from '../../utils';
import styles from './RadioCards.module.css';

export interface RadioCardOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioCardsProps
  extends Omit<ComponentPropsWithoutRef<typeof RadioGroup>, 'children' | 'onValueChange'> {
  /** Names the group, e.g. "Scope requested". */
  label: string;
  /** Renders the label above the cards as well as naming the group. */
  showLabel?: boolean;
  options: readonly RadioCardOption[];
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * SE-02 · Radio cards.
 *
 * The quieter sibling of SE-01: a 1px border, a drawn dot, and the label on one
 * line. Used where the choice is a scope or a preference rather than a mode.
 *
 * Same Radix radio group underneath, so the keyboard behaviour is identical.
 */
export const RadioCards = forwardRef<HTMLDivElement, RadioCardsProps>(function RadioCards(
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
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.label}>{option.label}</span>
          </RadioGroupCard>
        ))}
      </RadioGroup>
    </div>
  );
});
