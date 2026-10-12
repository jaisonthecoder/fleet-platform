import { forwardRef, type InputHTMLAttributes, useId } from 'react';

import styles from './Field.module.css';
import { Input as ShadcnInput } from '../primitives/input';
import { Label } from '../primitives/label';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Validation message. Its presence is what marks the field invalid. */
  error?: string;
  hint?: string;
  /** Hide the label visually but keep it for screen readers. */
  labelHidden?: boolean;
}

/**
 * Text input with its label, hint and error wired together.
 *
 * The label is required, not optional: a placeholder is not a label, and a field with
 * only a placeholder is unusable once the user starts typing.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, labelHidden = false, className, required, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={[styles.field, className ?? ''].filter(Boolean).join(' ')}>
      <Label
        htmlFor={id}
        className={labelHidden ? 'noa-visually-hidden' : styles.label}
      >
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </Label>

      <ShadcnInput
        id={id}
        ref={ref}
        required={required}
        className={[styles.control, error ? styles.invalid : ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
        {...rest}
      />

      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        // role="alert" so the message is announced when it appears after a failed submit.
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
