import { forwardRef, type ComponentProps, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../utils';
import { DateDisplay, type DateParts } from '../DateDisplay';
import { DatePicker } from '../DatePicker';
import { DayPicker, type WeekdayOption } from '../DayPicker';
import styles from './SchedulePicker.module.css';

export interface SchedulePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** e.g. "First collection". */
  dateLabel: string;
  /** The chosen date, already formatted. */
  date: DateParts;
  selectedDate?: Date;
  onDateChange: (date: Date | undefined) => void;

  /** e.g. "Repeats on". */
  weekdayLabel: string;
  weekdays: readonly WeekdayOption[];
  selectedWeekdays: readonly string[];
  onWeekdaysChange: (values: string[]) => void;

  /** The plain sentence reading back what was agreed. */
  summary: ReactNode;

  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the trigger, e.g. "Change the first collection date". */
  triggerLabel: string;
  doneLabel: ReactNode;

  calendar: Omit<
    ComponentProps<typeof DatePicker>,
    'selected' | 'onSelect' | 'doneLabel' | 'onDone'
  >;
}

/**
 * DT-04 · Schedule picker.
 *
 * One control for a recurring booking: the start date from the grid, the
 * weekdays from the day picker, and a sentence reading back what was actually
 * agreed.
 *
 * The grid opens *in place*, beneath the two fields, so the read-back sentence
 * stays put and the page never jumps. That is why this is not a popover: a
 * floating layer would cover the sentence the user is checking.
 */
export const SchedulePicker = forwardRef<HTMLDivElement, SchedulePickerProps>(
  function SchedulePicker(
    {
      dateLabel,
      date,
      selectedDate,
      onDateChange,
      weekdayLabel,
      weekdays,
      selectedWeekdays,
      onWeekdaysChange,
      summary,
      open,
      onOpenChange,
      triggerLabel,
      doneLabel,
      calendar,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div ref={ref} className={cn(styles.schedule, className)} {...rest}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <p className={styles.label}>{dateLabel}</p>
            <button
              type="button"
              className={styles.trigger}
              aria-label={triggerLabel}
              aria-expanded={open}
              onClick={() => onOpenChange(!open)}
            >
              <DateDisplay variant="stamp" date={date} className={styles.triggerDate} />
            </button>
          </div>

          <div className={styles.field}>
            <DayPicker
              label={weekdayLabel}
              options={weekdays}
              values={selectedWeekdays}
              onValuesChange={onWeekdaysChange}
            />
          </div>
        </div>

        <p className={styles.summary}>{summary}</p>

        {open && (
          <div className={styles.panel}>
            <DatePicker
              {...calendar}
              selected={selectedDate}
              onSelect={onDateChange}
              doneLabel={doneLabel}
              onDone={() => onOpenChange(false)}
            />
          </div>
        )}
      </div>
    );
  },
);
