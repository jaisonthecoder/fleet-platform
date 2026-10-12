import { forwardRef, type ComponentProps, type HTMLAttributes, type ReactNode } from 'react';
import { DayPicker as RdpDayPicker } from 'react-day-picker';

import { cn } from '../../utils';
import styles from './DatePicker.module.css';

export interface DateShortcut {
  id: string;
  label: ReactNode;
  date: Date;
}

export interface DatePickerLegend {
  chosen: string;
  sailing: string;
  today: string;
  past: string;
}

export interface DatePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /** Names the grid, e.g. "Cargo ready date". */
  calendarLabel: string;
  /**
   * The locale react-day-picker formats month and weekday names with.
   * Without it the library ships English captions whatever the app language,
   * and i18next cannot reach inside it.
   */
  locale?: ComponentProps<typeof RdpDayPicker>['locale'];
  /** Days a service actually runs. Tinted, dotted, and announced. */
  sailingDates?: readonly Date[];
  /** Usually "before today", so a past date cannot be chosen. */
  disabled?: ComponentProps<typeof RdpDayPicker>['disabled'];
  today?: Date;
  startMonth?: Date;
  endMonth?: Date;
  shortcuts?: readonly DateShortcut[];
  shortcutsLabel?: ReactNode;
  legend?: DatePickerLegend;
  /** Renders a closing action under the shortcuts, as DT-04 does. */
  doneLabel?: ReactNode;
  onDone?: () => void;
}

/**
 * DT-03 · Date picker.
 *
 * A compact month grid: sailing days carry a red dot and a tinted cell, today
 * is ringed navy, past dates are dead, and the shortcuts sit on the left so
 * most people never open the grid at all.
 *
 * A sailing day is not signalled by its tint alone — the dot is drawn, and the
 * day's accessible name says so, because a tinted cell means nothing to anyone
 * who cannot see it.
 */
export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    selected,
    onSelect,
    month,
    onMonthChange,
    calendarLabel,
    locale,
    sailingDates = [],
    disabled,
    today,
    startMonth,
    endMonth,
    shortcuts,
    shortcutsLabel,
    legend,
    doneLabel,
    onDone,
    className,
    ...rest
  },
  ref,
) {
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  return (
    <div ref={ref} className={cn(styles.picker, className)} {...rest}>
      {shortcuts?.length ? (
        <div className={styles.shortcuts}>
          {shortcutsLabel && <p className={styles.shortcutsLabel}>{shortcutsLabel}</p>}
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              type="button"
              className={styles.shortcut}
              aria-pressed={selected ? isSameDay(selected, shortcut.date) : false}
              onClick={() => onSelect(shortcut.date)}
            >
              {shortcut.label}
            </button>
          ))}
          {doneLabel && (
            <button type="button" className={styles.done} onClick={onDone}>
              {doneLabel}
            </button>
          )}
        </div>
      ) : null}

      <div className={styles.grid}>
        <RdpDayPicker
          mode="single"
          selected={selected}
          onSelect={onSelect}
          month={month}
          onMonthChange={onMonthChange}
          locale={locale}
          disabled={disabled}
          today={today}
          startMonth={startMonth}
          endMonth={endMonth}
          showOutsideDays={false}
          aria-label={calendarLabel}
          modifiers={{ sailing: [...sailingDates] }}
          modifiersClassNames={{ sailing: styles.sailing as string }}
          classNames={{
            root: styles.calendar as string,
            months: styles.months as string,
            month_caption: styles.caption as string,
            caption_label: styles.captionLabel as string,
            nav: styles.nav as string,
            button_previous: styles.navButton as string,
            button_next: styles.navButton as string,
            month_grid: styles.monthGrid as string,
            weekdays: styles.weekdays as string,
            weekday: styles.weekday as string,
            week: styles.weekRow as string,
            day: styles.day as string,
            day_button: styles.dayButton as string,
            selected: styles.selected as string,
            today: styles.today as string,
            disabled: styles.disabledDay as string,
            outside: styles.outside as string,
          }}
        />

        {legend && (
          <ul className={styles.legend}>
            <li>
              <span className={styles.keyChosen} aria-hidden="true" />
              {legend.chosen}
            </li>
            <li>
              <span className={styles.keySailing} aria-hidden="true" />
              {legend.sailing}
            </li>
            <li>
              <span className={styles.keyToday} aria-hidden="true" />
              {legend.today}
            </li>
            <li>
              <span className={styles.keyPast} aria-hidden="true" />
              {legend.past}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
});
