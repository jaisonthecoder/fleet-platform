import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

import { Command, CommandEmpty, CommandItem, CommandList } from '../../primitives/command';
import { Popover, PopoverAnchor, PopoverContent } from '../../primitives/popover';
import { Label } from '../../primitives/label';
import { Input as ShadcnInput } from '../../primitives/input';
import { Spinner } from '../Spinner';
import fieldStyles from '../Field.module.css';
import styles from './Autocomplete.module.css';

/** Case- and accent-insensitive, so "espana" finds "España". */
const fold = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export interface AutocompleteOption {
  /** What the field takes when this row is chosen. */
  value: string;
  /** What the row reads as. */
  label: string;
  /** A quieter second line - a country, a code, whatever disambiguates. */
  hint?: string;
}

export interface AutocompleteProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'list' | 'value' | 'onChange'> {
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  /**
   * The suggestions. Filtered here when they are a fixed local list, and taken as
   * given when `onQueryChange` says the caller is searching somewhere else.
   */
  options: AutocompleteOption[];
  /**
   * Called as the person types. Supplying it means "I do the searching", and turns
   * off the local filter - what comes back is shown as it arrives.
   */
  onQueryChange?: (query: string) => void;
  /** Draws the spinner while a search is in flight. */
  loading?: boolean;
  /**
   * Characters before searching starts. 0 opens the whole list on focus, which is
   * right for a short maintained list; 2 or 3 suits a directory too large to show.
   */
  minQuery?: number;
  /** Shown while fewer than `minQuery` characters have been typed. */
  promptHint?: string;
  /** Shown when the search came back with nothing. */
  emptyHint?: string;
  /**
   * How many rows to draw at once. The rest stay reachable by typing.
   *
   * A list is for choosing from, not for scrolling: past about fifty rows nobody
   * reads to the end, and the browser lays out hundreds of nodes on every
   * keystroke to be ignored.
   */
  maxVisible?: number;
  /**
   * Sort the rows by label before showing them.
   *
   * Opt-in, and deliberately not the default: a lookup carries its own
   * `sort_order` because somebody decided 20GP comes before 40HC, and
   * re-alphabetising a curated list throws that decision away. Turn it on for
   * the long ones — countries, commodities — where A to Z is the only order
   * anybody can navigate.
   */
  sort?: boolean;
  /**
   * Shown under a capped list, e.g. "148 more — keep typing to narrow it".
   * `{{count}}` is replaced with how many rows are held back. The kit takes the
   * sentence rather than translating it: the design system carries no strings.
   */
  moreHint?: string;
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
}

/**
 * A field that looks like what it is.
 *
 * `ComboInput` does the same job and is the right choice for a short maintained
 * list, but it is a bare text box until you type into it - nothing on screen says
 * a list exists. That is fine for "commodity", where the suggestions are a
 * convenience on top of a word you already know, and wrong for "origin", where the
 * list IS the answer and the customer does not know the codes.
 *
 * So this one carries the affordances: a search glyph, a chevron that opens the
 * list on click, a spinner while a lookup is in flight, and a clear control once
 * there is something to clear.
 *
 * Built on the shadcn Popover and Command primitives, so positioning, layering and
 * the list's semantics are theirs. Selection keys are handled here rather than by
 * cmdk because focus stays in the field - a form control that moves focus into a
 * popover to choose a value is a control people lose their place in.
 *
 * Free text is accepted by design. The directory behind a field like this is never
 * complete, and refusing a value nobody has added yet turns a suggestion into an
 * obstacle. Whoever owns the field decides whether what was typed is valid.
 */
export const Autocomplete = forwardRef<HTMLInputElement, AutocompleteProps>(function Autocomplete(
  {
    label,
    value,
    onValueChange,
    options,
    onQueryChange,
    loading = false,
    minQuery = 0,
    promptHint,
    emptyHint,
    maxVisible = 50,
    sort = false,
    moreHint,
    labelHidden = false,
    hint,
    error,
    required,
    className,
    onKeyDown,
    onFocus,
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
  const inner = useRef<HTMLInputElement | null>(null);

  /*
   * Who filters, decided by whether a query handler was given.
   *
   * With one, the caller is searching somewhere else - a directory, an endpoint -
   * and what arrives is already the answer. Without one the options are a fixed
   * local list, and filtering them here is the whole point: 21 HS sections that
   * ignore what you typed are not suggestions.
   */
  const matched = onQueryChange
    ? options
    : options.filter((option) => fold(option.label).includes(fold(value)));

  /*
   * What is actually drawn: sorted where the caller asked for it, then capped.
   *
   * The cap is what lets a list open on focus at all. Fifty rows of a directory
   * is a starting point somebody can read; all of it is a scrollbar, and none of
   * it — which is what an empty box gave before — is a field that looks broken
   * until you guess what to type into it.
   */
  const shown = (sort ? [...matched].sort((a, b) => a.label.localeCompare(b.label)) : matched)
    .slice(0, maxVisible);

  /** How many matches the cap is holding back, for the note under the list. */
  const hidden = Math.max(0, matched.length - shown.length);

  const short = value.trim().length < minQuery;
  // A prompt is worth a panel of its own: it is the difference between "no matches"
  // and "keep typing", which look identical when the list is simply empty.
  const showing = open && (shown.length > 0 || Boolean(short ? promptHint : emptyHint));

  // The highlight must not survive a change to what is under it.
  useEffect(() => setActive(-1), [options, value]);

  function choose(option: AutocompleteOption) {
    onValueChange(option.value);
    onQueryChange?.(option.value);
    setOpen(false);
    setActive(-1);
    inner.current?.focus();
  }

  function keys(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (shown.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + shown.length) % shown.length);
      return;
    }
    if (event.key === 'Enter' && open && active >= 0 && shown[active]) {
      // Only when a row is highlighted: otherwise Enter submits the form, which is
      // what someone who typed a code and wants to move on is asking for.
      event.preventDefault();
      choose(shown[active]);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className={[fieldStyles.field, className ?? ''].filter(Boolean).join(' ')}>
      <Label htmlFor={id} className={labelHidden ? 'noa-visually-hidden' : fieldStyles.label}>
        {label}
        {required && <span className={fieldStyles.required} aria-hidden="true">*</span>}
      </Label>

      <Popover open={showing} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className={[styles.shell, error ? styles.invalid : ''].filter(Boolean).join(' ')}>
            <Search className={styles.leading} size={16} aria-hidden="true" />

            <ShadcnInput
              id={id}
              ref={(node) => {
                inner.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
              }}
              role="combobox"
              aria-expanded={showing}
              aria-controls={showing ? listId : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              required={required}
              className={styles.control}
              aria-invalid={error ? true : undefined}
              aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
              value={value}
              onChange={(event) => {
                onValueChange(event.target.value);
                onQueryChange?.(event.target.value);
                setOpen(true);
              }}
              onFocus={(event) => { setOpen(true); onFocus?.(event); }}
              onBlur={onBlur}
              onKeyDown={keys}
              {...rest}
            />

            <span className={styles.trailing}>
              {/* The kit already owns the waiting state, and announce=false because the
                  field itself is not busy - only its suggestions are. */}
              {loading && <Spinner label="Searching" size={14} announce={false} />}
              {value !== '' && !loading && (
                <button
                  type="button"
                  className={styles.icon}
                  // The label says what goes, not merely "clear" - a screen reader
                  // user has several of these on one form.
                  aria-label={typeof label === 'string' ? `Clear ${label.toLowerCase()}` : 'Clear'}
                  onClick={() => {
                    onValueChange('');
                    onQueryChange?.('');
                    setActive(-1);
                    inner.current?.focus();
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className={styles.icon}
                // Presentational: the input already announces the expanded state, so
                // a second control saying the same thing is noise in a screen reader.
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => { setOpen((current) => !current); inner.current?.focus(); }}
              >
                <ChevronDown className={showing ? styles.chevronOpen : styles.chevron} size={16} />
              </button>
            </span>
          </div>
        </PopoverAnchor>

        <PopoverContent
          className={styles.panel}
          align="start"
          sideOffset={4}
          // Focus stays in the field: this is a text box with suggestions, not a menu.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {/* shouldFilter=false - the options given are already the answer, whether
              they were filtered here or by a server. */}
          <Command shouldFilter={false}>
            <CommandList id={listId} className={styles.list}>
              {short && promptHint && <CommandEmpty className={styles.note}>{promptHint}</CommandEmpty>}
              {!short && shown.length === 0 && emptyHint && (
                <CommandEmpty className={styles.note}>{emptyHint}</CommandEmpty>
              )}
              {shown.map((option, index) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  className={styles.option}
                  data-active={index === active ? 'true' : undefined}
                  onMouseEnter={() => setActive(index)}
                  onSelect={() => choose(option)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint && <span className={styles.optionHint}>{option.hint}</span>}
                  {option.value === value && <Check className={styles.tick} size={14} aria-hidden="true" />}
                </CommandItem>
              ))}
              {/* Says the list is a sample, not the whole of it — otherwise a
                  customer whose answer is row 80 concludes it is not there. */}
              {hidden > 0 && moreHint && (
                <p className={styles.note}>{moreHint.replace('{{count}}', String(hidden))}</p>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {hint && !error && <p id={hintId} className={fieldStyles.hint}>{hint}</p>}
      {error && <p id={errorId} role="alert" className={fieldStyles.error}>{error}</p>}
    </div>
  );
});
