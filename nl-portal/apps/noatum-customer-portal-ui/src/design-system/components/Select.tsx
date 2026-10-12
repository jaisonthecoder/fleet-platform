import { forwardRef, type ComponentPropsWithoutRef, useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../primitives/select';
import { Label } from '../primitives/label';

import styles from './Field.module.css';
import search from './SelectSearch.module.css';

/**
 * Where a list stops being readable and starts needing a filter.
 *
 * Eight is about a screen's worth. Below it a filter is one more thing to skip
 * past; above it - twenty-five hazard classes, a hundred and sixty currencies -
 * scrolling for a value you can already name is the slowest part of the form.
 */
const SEARCH_THRESHOLD = 8;

/** Case- and accent-insensitive, so "espana" finds "España". */
const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends ComponentPropsWithoutRef<typeof SelectRoot> {
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  placeholder?: string;
  labelHidden?: boolean;
  className?: string;
  onBlur?: ComponentPropsWithoutRef<typeof SelectTrigger>['onBlur'];
  /**
   * Force the filter on or off. Left unset it appears once the list is long
   * enough to be worth filtering, so no caller has to think about it.
   */
  searchable?: boolean;
  /** Placeholder for that filter. Defaults to "Search". */
  searchPlaceholder?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    label, options, error, hint, placeholder, labelHidden = false, className, required, onBlur,
    defaultValue, searchable, searchPlaceholder, ...rest
  },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const [query, setQuery] = useState('');
  const filtering = searchable ?? options.length > SEARCH_THRESHOLD;

  const shown = useMemo(() => {
    if (!filtering || query.trim() === '') return options;
    const needle = fold(query.trim());
    return options.filter((option) => fold(option.label).includes(needle));
  }, [filtering, options, query]);

  return (
    <div className={[styles.field, className ?? ''].filter(Boolean).join(' ')}>
      <Label htmlFor={id} className={labelHidden ? 'noa-visually-hidden' : styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </Label>

      <SelectRoot required={required} defaultValue={defaultValue ?? (placeholder ? undefined : options.find((option) => !option.disabled)?.value)} {...rest}>
      <SelectTrigger
        id={id}
        ref={ref}
        onBlur={onBlur}
        aria-required={required}
        className={[styles.control, styles.select, error ? styles.invalid : '']
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className="noa-select-content"
        position="popper"
        // Radix moves focus to the selected item on open, which would take it
        // straight back off the filter.
        onCloseAutoFocus={() => setQuery('')}
        // `header`, not a child: a child renders inside the scrolling Viewport,
        // where the options slide up through the Viewport's own padding and appear
        // above the box. Out here it is a fixed row and there is no strip to
        // scroll through.
        header={
          filtering ? (
            <div className={search.bar}>
              <Search className={search.glyph} size={15} aria-hidden="true" />
              <input
                className={search.input}
                type="text"
                value={query}
                autoFocus
                placeholder={searchPlaceholder ?? 'Search'}
                aria-label={`Search ${label.toLowerCase()}`}
                onChange={(event) => setQuery(event.target.value)}
                // Radix Select types-to-jump on any printable key, and it listens on
                // the content. Without this, typing "e" here also jumps the list to
                // the first option beginning with E and steals the caret.
                onKeyDown={(event) => {
                  if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
                }}
              />
            </div>
          ) : undefined
        }
      >
        {shown.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}

        {/* Not a SelectItem: there is nothing here to select, and Radix would
            make it keyboard-reachable and announce it as a choice. */}
        {filtering && shown.length === 0 && <p className={search.empty}>No match</p>}
      </SelectContent>
      </SelectRoot>

      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
