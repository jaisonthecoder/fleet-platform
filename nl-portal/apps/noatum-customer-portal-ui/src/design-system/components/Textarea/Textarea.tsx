import { forwardRef, type TextareaHTMLAttributes, useId } from 'react';

import { Label } from '../../primitives/label';
import fieldStyles from '../Field.module.css';
import styles from './Textarea.module.css';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  /** Validation message. Its presence is what marks the field invalid. */
  error?: string;
  hint?: string;
  /** Hide the label visually but keep it for screen readers. */
  labelHidden?: boolean;
}

/**
 * Several lines of text, with its label, hint and error wired together.
 *
 * The same field as Input in every respect except height — it shares the
 * stylesheet rather than copying it, so the two sit side by side in a grid
 * without either being nudged.
 *
 * It exists because four screens had hand-rolled a bare `<textarea>` with its
 * own border, padding and focus ring, and they had already drifted apart: the
 * quotation terms, the covering message, and both lookup description fields
 * each looked slightly different from the inputs beside them.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, labelHidden = false, className, required, rows = 3, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={[fieldStyles.field, className ?? ''].filter(Boolean).join(' ')}>
      <Label htmlFor={id} className={labelHidden ? 'noa-visually-hidden' : fieldStyles.label}>
        {label}
        {required && (
          <span className={fieldStyles.required} aria-hidden="true">
            *
          </span>
        )}
      </Label>

      <textarea
        id={id}
        ref={ref}
        rows={rows}
        required={required}
        className={[
          'noa-control',
          fieldStyles.control,
          styles.control,
          error ? fieldStyles.invalid : '',
        ].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
        }
        {...rest}
      />

      {hint && !error && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}
      {error && (
        // role="alert" so the message is announced when it appears after a failed submit.
        <p id={errorId} className={fieldStyles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
