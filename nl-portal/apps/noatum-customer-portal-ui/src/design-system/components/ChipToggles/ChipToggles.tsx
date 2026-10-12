import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';

import { ToggleChipGroup, ToggleGroupChip } from '../../primitives/toggle-group';
import { cn } from '../../utils';
import styles from './ChipToggles.module.css';

/* ------------------------------------------------------------------ chips */

export interface ChipToggleOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface ChipTogglesProps
  extends Omit<
    ComponentPropsWithoutRef<typeof ToggleChipGroup>,
    'children' | 'type' | 'value' | 'onValueChange' | 'defaultValue'
  > {
  /** Names the group, e.g. "Additional services". */
  label: string;
  /** Renders the label above the chips as well as naming the group. */
  showLabel?: boolean;
  options: readonly ChipToggleOption[];
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
}

/**
 * SE-03 · Chip toggles.
 *
 * Several answers at once, drawn as pills with a drawn checkbox. The checkbox
 * is what tells you this is a multiple choice rather than a single one, so it
 * is not decoration and is not optional.
 *
 * Built on the Radix toggle group in multiple mode, so each chip reports its
 * own pressed state and the group is one tab stop.
 */
export const ChipToggles = forwardRef<HTMLDivElement, ChipTogglesProps>(function ChipToggles(
  { label, showLabel = false, options, values, onValuesChange, className, ...rest },
  ref,
) {
  return (
    <div className={styles.field}>
      {showLabel && <p className={styles.eyebrow}>{label}</p>}
      <ToggleChipGroup
        ref={ref}
        type="multiple"
        aria-label={label}
        value={[...values]}
        onValueChange={onValuesChange}
        className={cn(styles.chips, className)}
        {...rest}
      >
        {options.map((option) => (
          <ToggleGroupChip
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={styles.chip}
          >
            <span className={styles.box} aria-hidden="true">
              <Check className={styles.tick} />
            </span>
            {option.label}
          </ToggleGroupChip>
        ))}
      </ToggleChipGroup>
    </div>
  );
});

/* ------------------------------------------------------------------ pills */

export interface FilterPillOption {
  value: string;
  label: ReactNode;
  /** Shown in a solid badge after the label. Omit for none. */
  count?: number;
  disabled?: boolean;
}

export interface FilterPillsProps
  extends Omit<
    ComponentPropsWithoutRef<typeof ToggleChipGroup>,
    'children' | 'type' | 'value' | 'onValueChange' | 'defaultValue'
  > {
  label: string;
  options: readonly FilterPillOption[];
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * SE-03 · Group pills.
 *
 * One answer, smaller and tighter than the chips above, with an optional count.
 * Radix's single mode returns '' when the pressed pill is pressed again, which
 * would clear a filter that is meant to always have a value, so that is held.
 */
export const FilterPills = forwardRef<HTMLDivElement, FilterPillsProps>(function FilterPills(
  { label, options, value, onValueChange, className, ...rest },
  ref,
) {
  return (
    <ToggleChipGroup
      ref={ref}
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      className={cn(styles.pills, className)}
      {...rest}
    >
      {options.map((option) => (
        <ToggleGroupChip
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={styles.pill}
        >
          {option.label}
          {option.count !== undefined && (
            <>
              <span className="noa-visually-hidden"> </span>
              <span className={styles.count}>{option.count}</span>
            </>
          )}
        </ToggleGroupChip>
      ))}
    </ToggleChipGroup>
  );
});
