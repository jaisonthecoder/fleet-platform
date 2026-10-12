import {
  forwardRef,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';

import { Popover, PopoverAnchor, PopoverContent } from '../primitives/popover';
import { Input as ShadcnInput } from '../primitives/input';
import { Label } from '../primitives/label';
import field from './Field.module.css';
import styles from './ComboInput.module.css';

export interface ComboInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'list'> {
  label: string;
  /** Suggestions. Never a constraint - anything typed is accepted. */
  options: string[];
  error?: string;
  hint?: string;
  labelHidden?: boolean;
  /** How many suggestions to show at once. The rest are reachable by typing. */
  limit?: number;
  /** Shown when nothing matches, e.g. "No match — it will be sent as typed". */
  emptyHint?: string;
}

/** Case- and accent-insensitive, so "espana" finds "España". */
const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * A field that offers a list and still takes anything.
 *
 * Use it wherever the business has a maintained list that is a convenience
 * rather than a rule: carriers, charge bases, commodity descriptions. Both
 * behaviours are needed at once - pick the maintained value in one click, and
 * type the one nobody has added yet. A Select gives the first and forbids the
 * second; a bare Input gives the second and produces four spellings of the same
 * carrier.
 *
 * This used to be a native `datalist`, which was the right instinct - the
 * browser supplies filtering, keyboard handling and screen-reader semantics for
 * free - and the wrong result: the list is drawn by the browser's own chrome,
 * which ignores every token and looks different in Chrome, Firefox and Safari.
 * A black OS panel hanging off a Noatum field reads as a different product.
 *
 * So the list is ours and the input is still a plain text input: typing,
 * maxLength, onChange and form behaviour are untouched, and only the suggestion
 * list changed. It is portalled to the body, because a suggestion list inside a
 * horizontally scrolling row gets clipped by it.
 *
 * Not a replacement for Select. Where the value must be one of a fixed set - a
 * status, a mode, a currency - use Select, which says what it does.
 */
export const ComboInput = forwardRef<HTMLInputElement, ComboInputProps>(function ComboInput(
  {
    label,
    options,
    error,
    hint,
    labelHidden = false,
    limit = 8,
    emptyHint,
    className,
    required,
    value,
    onChange,
    onKeyDown,
    onBlur,
    ...rest
  },
  ref,
) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const chosen = useRef(false);

  const typed = String(value ?? '').trim();
  const query = fold(typed);
  /*
   * Hidden only when the field already holds the option character for
   * character: that is the question answered, and one row repeating what was
   * just chosen is noise. Compared raw rather than folded, so somebody typing
   * "espana" is still offered "España" — the accented spelling is the one worth
   * one keystroke.
   */
  const matches =
    query === ''
      ? options.slice(0, limit)
      : options.filter((option) => fold(option).includes(query) && option !== typed).slice(0, limit);

  const show = open && (matches.length > 0 || Boolean(emptyHint));

  /**
   * Suggestions are applied through the input's own onChange, so a caller that
   * reads `event.target.value` cannot tell a click from a keystroke and nothing
   * needs a second handler.
   */
  const choose = (option: string) => {
    const element = inputRef.current;
    setActive(-1);
    // The dispatch below runs the input's own onChange, which reopens the list.
    // The flag is read there rather than here because the event is synchronous
    // and a state update would not have landed in time.
    chosen.current = true;
    setOpen(false);
    if (!element) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, option);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.focus();
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(event.key === 'ArrowDown' ? 0 : matches.length - 1);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const count = matches.length;
      if (count === 0) return;
      setActive((current) => (current + step + count) % count);
      return;
    }

    if (event.key === 'Enter' && open && active >= 0) {
      const option = matches[active];
      if (option !== undefined) {
        // Only when a suggestion is highlighted: otherwise Enter submits the
        // form, which is what Enter in a text field is for.
        event.preventDefault();
        choose(option);
      }
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className={[field.field, className ?? ''].filter(Boolean).join(' ')}>
      <Label htmlFor={id} className={labelHidden ? 'noa-visually-hidden' : field.label}>
        {label}
        {required && (
          <span className={field.required} aria-hidden="true">
            *
          </span>
        )}
      </Label>

      <Popover open={show} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className={styles.anchor}>
            <ShadcnInput
              {...rest}
              id={id}
              ref={(element) => {
                inputRef.current = element;
                if (typeof ref === 'function') ref(element);
                else if (ref) ref.current = element;
              }}
              required={required}
              value={value}
              onChange={(event) => {
                setActive(-1);
                if (chosen.current) chosen.current = false;
                else setOpen(true);
                onChange?.(event);
              }}
              onKeyDown={keyDown}
              onFocus={(event) => {
                setOpen(true);
                rest.onFocus?.(event);
              }}
              onBlur={(event) => {
                setOpen(false);
                setActive(-1);
                onBlur?.(event);
              }}
              className={[field.control, error ? field.invalid : ''].filter(Boolean).join(' ')}
              role="combobox"
              autoComplete="off"
              aria-expanded={show}
              aria-controls={show ? listId : undefined}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              aria-autocomplete="list"
              aria-invalid={error ? true : undefined}
              aria-describedby={
                [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
              }
            />
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          className={styles.panel}
          // Focus stays in the field: a combobox whose list steals focus stops
          // being a text input the moment it opens.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {matches.length > 0 ? (
            <ul className={styles.list} id={listId} role="listbox" aria-label={label}>
              {matches.map((option, index) => (
                <li
                  key={option}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active ? 'true' : undefined}
                  className={styles.option}
                  // mousedown, not click: the input's blur would close the list
                  // before a click ever lands.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  {option}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{emptyHint}</p>
          )}
        </PopoverContent>
      </Popover>

      {hint && !error && (
        <p id={hintId} className={field.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={field.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
