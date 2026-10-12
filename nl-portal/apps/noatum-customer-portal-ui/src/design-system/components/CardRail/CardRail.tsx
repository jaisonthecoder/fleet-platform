import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../utils';
import styles from './CardRail.module.css';

export interface CardRailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Names the rail, e.g. "Container types". */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /**
   * Below this many children the rail is an ordinary wrapping grid. A rail is a
   * cost — it hides things — and paying it for three cards that already fit is
   * the wrong trade.
   */
  railFrom?: number;
  /** Announced as the rail moves, e.g. "Showing 4 to 6 of 12". */
  positionLabel?: (visible: { first: number; last: number; total: number }) => string;
  /**
   * Card to bring into view. A rail hides things, so a choice made anywhere but
   * the rail itself — by the assistant, or from a summary below it — has to be
   * scrolled to or it looks as though nothing happened.
   */
  focusIndex?: number | null;
  /**
   * Changes whenever the caller asks again, so scrolling back to the card that
   * is already focused still works. Without it a second request is a no-op.
   */
  focusNonce?: number;
  children: ReactNode;
}

/**
 * A row of cards that becomes a rail when there are too many to show at once.
 *
 * A dozen container types laid out as a wrapping grid is four rows of tall
 * cards in the middle of a form: the customer loses the thread of what they
 * were filling in, and the sections below are pushed off the screen. Kept on
 * one row, the whole choice reads as one question again.
 *
 * Native scrolling with snap points, not a transform carousel. Touch swipe,
 * trackpad, shift-wheel, the scrollbar and Home/End all work because the
 * browser already implements them; the buttons are a convenience on top, and
 * nothing is hidden from find-in-page or from a screen reader, which reads the
 * cards in order regardless of what is scrolled into view.
 */
export function CardRail({
  label,
  previousLabel,
  nextLabel,
  railFrom = 4,
  positionLabel,
  focusIndex,
  focusNonce,
  className,
  children,
  ...rest
}: CardRailProps) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [position, setPosition] = useState('');

  const total = Children.count(children);
  const isRail = total >= railFrom;

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;

    // A fractional scrollWidth rounds against you at some zoom levels, which
    // leaves "next" enabled forever on a rail that is already at its end.
    const remaining = element.scrollWidth - element.clientWidth - element.scrollLeft;
    setAtStart(element.scrollLeft <= 1);
    setAtEnd(remaining <= 1);

    if (!positionLabel) return;
    const cards = [...element.children] as HTMLElement[];
    const visible = cards.filter(
      (card) =>
        card.offsetLeft + card.offsetWidth > element.scrollLeft + 1 &&
        card.offsetLeft < element.scrollLeft + element.clientWidth - 1,
    );
    const first = visible[0] ? cards.indexOf(visible[0]) + 1 : 1;
    const last = visible.at(-1) ? cards.indexOf(visible.at(-1) as HTMLElement) + 1 : first;
    setPosition(positionLabel({ first, last, total: cards.length }));
  }, [positionLabel]);

  useEffect(() => {
    const element = track.current;
    if (!element || !isRail) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isRail, measure, total]);

  useEffect(() => {
    const element = track.current;
    if (!element || !isRail || focusIndex === null || focusIndex === undefined) return;

    const card = element.children[focusIndex];
    if (card instanceof HTMLElement) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [focusIndex, focusNonce, isRail, total]);

  if (!isRail) {
    return (
      <div className={cn(styles.grid, className)} {...rest}>
        {children}
      </div>
    );
  }

  /** One viewport-worth, less a card's overlap so nothing is stepped over. */
  const step = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const width = card ? card.offsetWidth + 12 : element.clientWidth;
    const pages = Math.max(1, Math.floor(element.clientWidth / width));
    element.scrollBy({ left: direction * width * pages, behavior: 'smooth' });
  };

  return (
    <div className={cn(styles.rail, className)} {...rest}>
      <div
        ref={track}
        className={styles.track}
        data-scroll="compact"
        role="group"
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
      >
        {children}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.step}
          aria-label={previousLabel}
          disabled={atStart}
          onClick={() => step(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        {/* Polite, not assertive: the position is a reassurance, not an event
            worth interrupting what is being read. */}
        <span className={styles.position} aria-live="polite">
          {position}
        </span>

        <button
          type="button"
          className={styles.step}
          aria-label={nextLabel}
          disabled={atEnd}
          onClick={() => step(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
