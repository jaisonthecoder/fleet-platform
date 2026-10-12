import { forwardRef, type HTMLAttributes } from 'react';

import styles from './ActionControls.module.css';

export interface ViewSwitcherOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ViewSwitcherProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  options: readonly ViewSwitcherOption[];
  value: string;
  onValueChange: (value: string) => void;
  controls?: string;
}

export const ViewSwitcher = forwardRef<HTMLDivElement, ViewSwitcherProps>(function ViewSwitcher(
  { label, options, value, onValueChange, controls, className, ...rest },
  ref,
) {
  const enabled = options.filter((option) => !option.disabled);
  const move = (current: string, direction: number) => {
    const index = enabled.findIndex((option) => option.value === current);
    if (index < 0) return;
    const next = enabled[(index + direction + enabled.length) % enabled.length];
    if (next) onValueChange(next.value);
  };
  return (
    <div
      ref={ref}
      className={[styles.switcher, className ?? ''].filter(Boolean).join(' ')}
      role="toolbar"
      aria-label={label}
      {...rest}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-controls={controls}
          tabIndex={option.value === value ? 0 : -1}
          disabled={option.disabled}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault();
              move(option.value, 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault();
              move(option.value, -1);
            }
          }}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
});

export interface StepperProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decrementLabel: string;
  incrementLabel: string;
  unit?: string;
  formatValue?: (value: number) => string;
  disabled?: boolean;
}

export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper(
  {
    label,
    value,
    onValueChange,
    min = 0,
    max,
    step = 1,
    decrementLabel,
    incrementLabel,
    unit,
    formatValue,
    disabled = false,
    className,
    ...rest
  },
  ref,
) {
  const safeMax = max ?? Number.MAX_SAFE_INTEGER;
  const safeValue = Math.min(safeMax, Math.max(min, Number.isFinite(value) ? value : min));
  const decrementValue = Math.max(min, safeValue - step);
  const incrementValue = Math.min(safeMax, safeValue + step);
  const valueText = formatValue?.(safeValue) ?? `${safeValue}${unit ? ` ${unit}` : ''}`;

  return (
    <div
      ref={ref}
      className={[styles.stepper, className ?? ''].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      {...rest}
    >
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={disabled || safeValue <= min}
        onClick={() => onValueChange(decrementValue)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <input
        className={styles.stepperInput}
        type="number"
        aria-label={label}
        aria-valuetext={valueText}
        value={safeValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next)) onValueChange(Math.min(safeMax, Math.max(min, next)));
        }}
      />
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={disabled || safeValue >= safeMax}
        onClick={() => onValueChange(incrementValue)}
      >
        <span aria-hidden="true">+</span>
      </button>
      {unit && <span className={styles.unit}>{unit}</span>}
    </div>
  );
});
