import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import styles from './RangeSlider.module.css';

export interface RangeSliderProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'onChange' | 'type' | 'value'
> {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  valueLabel?: ReactNode;
  minimumLabel?: ReactNode;
  maximumLabel?: ReactNode;
  note?: ReactNode;
  warningThreshold?: number;
  warningLabel?: ReactNode;
  formatValue?: (value: number) => string;
  onValueCommit?: (value: number) => void;
  ticks?: readonly { value: number; label: string }[];
}

/** Controlled native range input with the Noatum label/value treatment. */
export const RangeSlider = forwardRef<HTMLInputElement, RangeSliderProps>(function RangeSlider(
  {
    label,
    value,
    onValueChange,
    valueLabel,
    minimumLabel,
    maximumLabel,
    note,
    warningThreshold,
    warningLabel,
    formatValue,
    onValueCommit,
    ticks,
    min = 0,
    max = 100,
    step = 1,
    disabled,
    className,
    ...rest
  },
  ref,
) {
  const id = useId();
  const ticksId = `${id}-ticks`;
  const noteId = `${id}-note`;
  const parsedMaximum = typeof max === 'number' ? max : Number(max);
  const parsedMinimum = typeof min === 'number' ? min : Number(min);
  const numericMinimum = Number.isFinite(parsedMinimum) ? parsedMinimum : 0;
  const numericMaximum =
    Number.isFinite(parsedMaximum) && parsedMaximum > numericMinimum
      ? parsedMaximum
      : numericMinimum + 1;
  const clampedValue = Math.min(
    numericMaximum,
    Math.max(numericMinimum, Number.isFinite(value) ? value : numericMinimum),
  );
  const warning =
    warningThreshold !== undefined &&
    warningThreshold > numericMinimum &&
    clampedValue >= warningThreshold;
  const valueText = formatValue?.(clampedValue) ?? String(clampedValue);

  return (
    <div
      className={[styles.slider, warning ? styles.warning : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.heading}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{valueLabel ?? valueText}</output>
      </div>
      <input
        {...rest}
        ref={ref}
        id={id}
        type="range"
        min={numericMinimum}
        max={numericMaximum}
        step={step}
        value={clampedValue}
        disabled={disabled}
        aria-valuetext={valueText}
        aria-describedby={note ? noteId : undefined}
        list={ticks?.length ? ticksId : undefined}
        onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)}
        onPointerUp={(event) => onValueCommit?.(event.currentTarget.valueAsNumber)}
        onKeyUp={(event) => onValueCommit?.(event.currentTarget.valueAsNumber)}
      />
      {ticks?.length && (
        <datalist id={ticksId}>
          {ticks.map((tick) => (
            <option key={tick.value} value={tick.value} label={tick.label} />
          ))}
        </datalist>
      )}
      {(minimumLabel !== undefined || maximumLabel !== undefined) && (
        <div className={styles.limits} aria-hidden="true">
          <span>{minimumLabel}</span>
          <span>{maximumLabel}</span>
        </div>
      )}
      {note && (
        <p id={noteId} className={styles.note}>
          {note}
        </p>
      )}
      {warning && warningLabel && <p className={styles.warningText}>{warningLabel}</p>}
    </div>
  );
});

export interface RangeIntervalSliderProps extends Omit<
  RangeSliderProps,
  'value' | 'onValueChange' | 'valueLabel' | 'warningThreshold' | 'warningLabel' | 'onValueCommit'
> {
  value: readonly [number, number];
  onValueChange: (value: [number, number]) => void;
  onValueCommit?: (value: [number, number]) => void;
  minimumValueLabel: string;
  maximumValueLabel: string;
}
export const RangeIntervalSlider = forwardRef<HTMLDivElement, RangeIntervalSliderProps>(
  function RangeIntervalSlider(
    {
      value,
      onValueChange,
      minimumValueLabel,
      maximumValueLabel,
      min = 0,
      max = 100,
      step = 1,
      label,
      formatValue,
      onValueCommit,
      className,
      ...rest
    },
    ref,
  ) {
    const minimum = Number(min),
      maximum = Number(max),
      low = Math.min(value[0], value[1]),
      high = Math.max(value[0], value[1]);
    return (
      <div ref={ref} className={[styles.interval, className ?? ''].filter(Boolean).join(' ')}>
        <RangeSlider
          {...rest}
          label={`${label} — ${minimumValueLabel}`}
          value={low}
          min={minimum}
          max={high}
          step={step}
          formatValue={formatValue}
          onValueChange={(next) => onValueChange([next, high])}
          onValueCommit={(next) => onValueCommit?.([next, high])}
        />
        <RangeSlider
          {...rest}
          label={`${label} — ${maximumValueLabel}`}
          value={high}
          min={low}
          max={maximum}
          step={step}
          formatValue={formatValue}
          onValueChange={(next) => onValueChange([low, next])}
          onValueCommit={(next) => onValueCommit?.([low, next])}
        />
      </div>
    );
  },
);
