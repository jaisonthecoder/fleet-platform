import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { ToggleChipGroup, ToggleGroupChip } from '../../primitives/toggle-group';
import { cn } from '../../utils';
import styles from './DayPicker.module.css';

export interface WeekdayOption {
  value: string;
  /** The single letter in the cell, e.g. "M". */
  shortLabel: string;
  /** The full name, which is what assistive technology reads. */
  fullLabel: string;
  disabled?: boolean;
}

export interface DayPickerProps
  extends Omit<
    ComponentPropsWithoutRef<typeof ToggleChipGroup>,
    'children' | 'type' | 'value' | 'onValueChange' | 'defaultValue'
  > {
  /** e.g. "Collection days". */
  label: string;
  showLabel?: boolean;
  /** Seven options, in week order. That order is the display order. */
  options: readonly WeekdayOption[];
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  /** The left-hand summary, e.g. "2 days a week · Tue and Fri". */
  summary?: ReactNode;
  /** The right-hand note, e.g. "Next Tue 22 SEP". */
  next?: ReactNode;
}

/**
 * DT-02 · Day picker.
 *
 * Seven cells for the weekdays a service runs or a collection is possible.
 * Used on sailing schedules, recurring bookings and warehouse opening days,
 * and it feeds the calendar in DT-03.
 *
 * Values come back in week order, not click order: a caller that renders
 * "Tue and Fri" should not get "Fri and Tue" because of what was pressed first.
 */
export const DayPicker = forwardRef<HTMLDivElement, DayPickerProps>(function DayPicker(
  { label, showLabel = true, options, values, onValuesChange, summary, next, className, ...rest },
  ref,
) {
  const order = options.map((option) => option.value);
  const inWeekOrder = (picked: string[]) =>
    [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return (
    <div className={styles.picker}>
      {showLabel && <p className={styles.label}>{label}</p>}
      <ToggleChipGroup
        ref={ref}
        type="multiple"
        aria-label={label}
        value={[...values]}
        onValueChange={(picked) => onValuesChange(inWeekOrder(picked))}
        className={cn(styles.week, className)}
        {...rest}
      >
        {options.map((option) => (
          <ToggleGroupChip
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={styles.day}
          >
            <span aria-hidden="true">{option.shortLabel}</span>
            <span className="noa-visually-hidden">{option.fullLabel}</span>
          </ToggleGroupChip>
        ))}
      </ToggleChipGroup>
      {(summary || next) && (
        <p className={styles.footer}>
          <span>{summary}</span>
          {next && <span className={styles.next}>{next}</span>}
        </p>
      )}
    </div>
  );
});
