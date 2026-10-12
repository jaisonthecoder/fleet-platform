import { forwardRef, useId, type FieldsetHTMLAttributes } from 'react';

import { LogisticsIcon, type LogisticsIconName } from '../icons';
import styles from './SelectionControls.module.css';

export interface SelectionOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface TransportModeOption extends SelectionOption {
  icon: LogisticsIconName;
}

interface SelectionGroupProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
}

export interface TransportModePickerProps extends SelectionGroupProps {
  options: readonly TransportModeOption[];
}

export const TransportModePicker = forwardRef<HTMLFieldSetElement, TransportModePickerProps>(
  function TransportModePicker(
    { label, options, value, onValueChange, name, className, disabled, ...rest },
    ref,
  ) {
    const generatedName = useId();
    const groupName = name ?? generatedName;

    return (
      <fieldset
        ref={ref}
        className={[styles.fieldset, className ?? ''].filter(Boolean).join(' ')}
        disabled={disabled}
        {...rest}
      >
        <legend className="noa-visually-hidden">{label}</legend>
        <div className={styles.modeGrid}>
          {options.map((option) => (
            <label key={option.value} className={styles.optionLabel}>
              <input
                className="noa-visually-hidden"
                type="radio"
                name={groupName}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onValueChange(option.value)}
              />
              <span className={styles.modeCard}>
                <span className={styles.iconTile}>
                  <LogisticsIcon name={option.icon} size={16} />
                </span>
                <span className={styles.optionText}>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  },
);

export interface RadioCardGroupProps extends SelectionGroupProps {
  options: readonly SelectionOption[];
}

export const RadioCardGroup = forwardRef<HTMLFieldSetElement, RadioCardGroupProps>(
  function RadioCardGroup(
    { label, options, value, onValueChange, name, className, disabled, ...rest },
    ref,
  ) {
    const generatedName = useId();
    const groupName = name ?? generatedName;

    return (
      <fieldset
        ref={ref}
        className={[styles.fieldset, className ?? ''].filter(Boolean).join(' ')}
        disabled={disabled}
        {...rest}
      >
        <legend className={styles.legend}>{label}</legend>
        <div className={styles.radioGrid}>
          {options.map((option) => (
            <label key={option.value} className={styles.optionLabel}>
              <input
                className="noa-visually-hidden"
                type="radio"
                name={groupName}
                value={option.value}
                checked={value === option.value}
                disabled={option.disabled}
                onChange={() => onValueChange(option.value)}
              />
              <span className={styles.radioCard}>
                <span className={styles.radioMark} aria-hidden="true" />
                <span className={styles.optionText}>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  },
);

export interface ChipToggleOption extends SelectionOption {
  count?: number;
}

export interface ChipToggleGroupProps
  extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'onChange'> {
  label: string;
  options: readonly ChipToggleOption[];
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  name?: string;
  minSelected?: number;
  maxSelected?: number;
  error?: React.ReactNode;
}

export const ChipToggleGroup = forwardRef<HTMLFieldSetElement, ChipToggleGroupProps>(
  function ChipToggleGroup(
    { label, options, values, onValuesChange, name, minSelected = 0, maxSelected = Number.MAX_SAFE_INTEGER, error, className, disabled, ...rest },
    ref,
  ) {
    const toggle = (option: ChipToggleOption) => {
      const uniqueValues = Array.from(new Set(values));
      const nextValues = uniqueValues.includes(option.value)
        ? values.filter((value) => value !== option.value)
        : [...uniqueValues, option.value];
      if (nextValues.length < minSelected || nextValues.length > maxSelected) return;
      onValuesChange(nextValues);
    };

    return (
      <fieldset
        ref={ref}
        className={[styles.fieldset, className ?? ''].filter(Boolean).join(' ')}
        disabled={disabled}
        {...rest}
      >
        <legend className={styles.legend}>{label}</legend>
        <div className={styles.chips}>
          {options.map((option) => (
            <label key={option.value} className={styles.optionLabel}>
              <input
                className="noa-visually-hidden"
                type="checkbox"
                name={name}
                value={option.value}
                checked={values.includes(option.value)}
                disabled={option.disabled}
                onChange={() => toggle(option)}
              />
              <span className={styles.chip}>
                <span className={styles.checkboxMark} aria-hidden="true">✓</span>
                <span>{option.label}</span>
                {option.count !== undefined && <small>{option.count}</small>}
              </span>
            </label>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
      </fieldset>
    );
  },
);

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  removeLabel: string;
  count?: number;
}

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { label, removeLabel, count, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={[styles.filterChip, className ?? ''].filter(Boolean).join(' ')}
      aria-label={`${removeLabel}: ${label}`}
      title={removeLabel}
      {...rest}
    >
      <span>{label}</span>
      {count !== undefined && <strong>{count}</strong>}
      <span aria-hidden="true">×</span>
    </button>
  );
});
