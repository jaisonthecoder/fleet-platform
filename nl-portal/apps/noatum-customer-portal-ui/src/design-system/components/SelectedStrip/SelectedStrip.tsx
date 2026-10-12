import { forwardRef, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '../../utils';
import styles from './SelectedStrip.module.css';

export interface SelectedItem {
  id: string;
  /** e.g. "2 × 40' HC". */
  title: ReactNode;
  /** e.g. "17,100 kg each · 34,200 kg total". */
  detail?: ReactNode;
}

export interface SelectedStripProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onRemove'> {
  /** e.g. "Selected · 1 type". The caller formats the count. */
  label: ReactNode;
  items: readonly SelectedItem[];
  /**
   * Removing an item. The label is required alongside the handler rather than
   * optional beside it: supplying one without the other used to render a
   * button with no accessible name, silently.
   */
  remove?: {
    onRemove: (id: string) => void;
    /** Names each remove button, e.g. (title) => `Remove ${title}`. */
    label: (item: SelectedItem) => string;
  };
  /**
   * Makes each entry a button that points back at whatever chose it, e.g.
   * scrolling the picker to that card. Without it the strip stays a read-back.
   */
  select?: {
    onSelect: (id: string) => void;
    /** Names each entry button, e.g. (title) => `Show ${title}`. */
    label: (item: SelectedItem) => string;
  };
  /** Shown when nothing is selected. */
  empty?: ReactNode;
}

/**
 * SE-05 · Selected summary strip.
 *
 * What the user has chosen so far, on the paper ground, each entry with a red
 * left rail. It is a read-back, not a control: the choosing happens above it.
 *
 * Removing the last item moves focus to the strip rather than losing it to the
 * document body, which is what happens when the focused button unmounts.
 */
export const SelectedStrip = forwardRef<HTMLDivElement, SelectedStripProps>(
  function SelectedStrip({ label, items, remove, select, empty, className, ...rest }, ref) {
    const listRef = useRef<HTMLDivElement>(null);

    const handleRemove = (item: SelectedItem, index: number) => {
      remove?.onRemove(item.id);
      // Move to the next remove button, or the strip itself if that was the last.
      const buttons = listRef.current?.querySelectorAll('button');
      const next = buttons?.[index + 1] ?? buttons?.[index - 1];
      if (next instanceof HTMLElement) next.focus();
      else listRef.current?.focus();
    };

    return (
      <div ref={ref} className={cn(styles.strip, className)} {...rest}>
        <p className={styles.label}>{label}</p>

        {items.length ? (
          <div className={styles.items} ref={listRef} tabIndex={-1}>
            {items.map((item, index) => (
              <span key={item.id} className={styles.item}>
                {select ? (
                  <button
                    type="button"
                    className={cn(styles.copy, styles.selectable)}
                    aria-label={select.label(item)}
                    onClick={() => select.onSelect(item.id)}
                  >
                    <span className={styles.title}>{item.title}</span>
                    {item.detail && <span className={styles.detail}>{item.detail}</span>}
                  </button>
                ) : (
                  <span className={styles.copy}>
                    <span className={styles.title}>{item.title}</span>
                    {item.detail && <span className={styles.detail}>{item.detail}</span>}
                  </span>
                )}
                {remove && (
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={remove.label(item)}
                    onClick={() => handleRemove(item, index)}
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>{empty}</p>
        )}
      </div>
    );
  },
);
