import { useId, useState, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';

import styles from './InfoRibbon.module.css';

export interface InfoRibbonProps {
  /** The guidance itself. Kept out of the DOM until it is asked for. */
  children: ReactNode;
  /**
   * The heading the icon belongs to. Passing it here keeps the trigger on the
   * title's baseline and lets the ribbon open full width beneath the whole block,
   * which a caller cannot achieve by placing the two side by side.
   */
  heading?: ReactNode;
  /** Accessible name for the trigger, e.g. "About customers". */
  label: string;
  /** Hides the ribbon again. */
  closeLabel: string;
  /** Open on first render, for a screen where the explanation is the point. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Guidance that waits to be asked for.
 *
 * Standing explanatory paragraphs cost the same vertical space on the thousandth
 * visit as on the first, so on a dense administration screen they become something
 * to scroll past. The icon keeps the explanation one click from the title and gives
 * the rest of the page back to the data.
 *
 * The content is unmounted while closed, so a screen reader does not announce help
 * that is not on screen.
 */
export function InfoRibbon({
  children,
  heading,
  label,
  closeLabel,
  defaultOpen = false,
  className,
}: InfoRibbonProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  const trigger = (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-controls={`${id}-panel`}
      aria-label={label}
      title={label}
      onClick={() => setOpen((value) => !value)}
    >
      <Info aria-hidden size={15} />
    </button>
  );

  return (
    <div className={[styles.block, className ?? ''].filter(Boolean).join(' ')}>
      {heading ? (
        <div className={styles.head}>
          {heading}
          {trigger}
        </div>
      ) : (
        trigger
      )}

      {open ? (
        <div id={`${id}-panel`} className={styles.ribbon} role="note">
          <div className={styles.body}>{children}</div>
          <button
            type="button"
            className={styles.close}
            aria-label={closeLabel}
            title={closeLabel}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
