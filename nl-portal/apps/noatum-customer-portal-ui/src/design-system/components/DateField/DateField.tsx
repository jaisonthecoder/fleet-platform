import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '../../primitives/popover';
import { cn } from '../../utils';
import { DatePicker } from '../DatePicker';
import { DateDisplay, type DateParts } from '../DateDisplay';
import styles from './DateField.module.css';

export interface DateFieldProps {
  /** e.g. "Cargo ready". Sits above the control, never inside it. */
  label: string;
  /** Draws the asterisk and tells assistive tech, like every other field. */
  required?: boolean;
  /** The chosen date, already formatted. Omit for none chosen. */
  date?: DateParts;
  /** Shown when nothing is chosen, e.g. "Choose a date". */
  placeholder?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  /** Everything the grid needs. Its own selection is supplied here. */
  calendar: Omit<ComponentProps<typeof DatePicker>, 'selected' | 'onSelect'>;
  /** Controlled disclosure. Left out, the field owns it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * DT-01 D · Date in a form row.
 *
 * The field shows the chosen date and opens the DT-03 grid beneath it. A date
 * field is a disclosure, not a permanently open calendar: the grid is portalled
 * to the body, closes on outside click and Escape, returns focus to the field,
 * and closes when a date is chosen.
 *
 * DT-03 on its own is the bare grid, for surfaces that want it always visible —
 * the schedule picker opens it in place so its read-back sentence never moves.
 * Anywhere else, use this.
 */
export const DateField = forwardRef<HTMLButtonElement, DateFieldProps>(function DateField(
  { label, date, placeholder, hint, required, disabled, selected, onSelect, calendar, open, onOpenChange },
  ref,
) {
  const id = useId();
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={styles.field}>
      <span className={cn('noa-label', styles.label)} id={`${id}-label`}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </span>

      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            className={date ? styles.triggerChosen : styles.trigger}
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}-value`}
            aria-required={required}
            aria-describedby={hint ? `${id}-hint` : undefined}
          >
            {/*
              Two triggers, one control.
              Empty, it is an ordinary field: full width, field height, a prompt to
              fill in. Once a date exists that shape is wrong - the stamp is taller
              than a field row and wider than it needs to be, so a fixed height made
              it ride over the label and a full width left it stranded in a column of
              its own. Chosen, the trigger shrinks to the stamp and keeps a small
              chevron. Both open the same calendar; nothing about the switch belongs
              to the screen using it.
            */}
            {date ? (
              <>
                <span className={styles.stamp} id={`${id}-value`}>
                  <DateDisplay date={date} variant="stamp" />
                </span>
                <ChevronDown className={styles.chevronSmall} aria-hidden="true" />
              </>
            ) : (
              <>
                <CalendarDays className={styles.icon} aria-hidden="true" />
                <span className={styles.value} id={`${id}-value`}>
                  <span className={styles.placeholder}>{placeholder}</span>
                </span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className={styles.panel}>
          <DatePicker
            {...calendar}
            selected={selected}
            onSelect={(next) => {
              onSelect(next);
              // A date field closes once the question is answered.
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {hint && (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
});
