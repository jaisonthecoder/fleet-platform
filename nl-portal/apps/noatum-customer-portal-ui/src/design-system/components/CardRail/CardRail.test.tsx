import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { CardRail } from './CardRail';

// jsdom has neither ResizeObserver nor layout. The rail observes its own track
// to know when it has reached an end, so without this it throws on mount.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const cards = (count: number) =>
  Array.from({ length: count }, (_, index) => <div key={index}>Card {index + 1}</div>);

const labels = {
  label: 'Container types',
  previousLabel: 'Previous container types',
  nextLabel: 'More container types',
};

describe('CardRail', () => {
  it('stays an ordinary grid while the cards still fit', () => {
    render(<CardRail {...labels}>{cards(3)}</CardRail>);

    // A rail is a cost — it hides things — and three cards do not earn it.
    expect(screen.queryByRole('button', { name: 'More container types' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Container types' })).not.toBeInTheDocument();
    expect(screen.getByText('Card 3')).toBeInTheDocument();
  });

  it('becomes a rail once there are more than three', () => {
    render(<CardRail {...labels}>{cards(12)}</CardRail>);

    expect(screen.getByRole('group', { name: 'Container types' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous container types' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More container types' })).toBeInTheDocument();
  });

  it('renders every card, scrolled into view or not', () => {
    render(<CardRail {...labels}>{cards(12)}</CardRail>);

    // Native scrolling, not a transform carousel: nothing is unmounted, so
    // find-in-page and a screen reader still reach the twelfth card.
    expect(screen.getByText('Card 1')).toBeInTheDocument();
    expect(screen.getByText('Card 12')).toBeInTheDocument();
  });

  it('is reachable by keyboard as a scrollable region', () => {
    render(<CardRail {...labels}>{cards(12)}</CardRail>);

    // WCAG 2.1: a region that scrolls must be focusable, or a keyboard user
    // with no focusable card content cannot scroll it at all.
    expect(screen.getByRole('group', { name: 'Container types' })).toHaveAttribute('tabindex', '0');
  });

  it('moves the track when the next control is used, and stops at the ends', async () => {
    const user = userEvent.setup();
    const scrollBy = vi.fn();
    // jsdom reports every width as 0, so without this the rail correctly
    // concludes it has nothing to scroll and disables both controls.
    const sizes = { scrollBy, scrollWidth: 1000, clientWidth: 400, offsetWidth: 200 };
    for (const [name, value] of Object.entries(sizes)) {
      Object.defineProperty(HTMLElement.prototype, name, { configurable: true, value });
    }

    render(<CardRail {...labels}>{cards(12)}</CardRail>);

    // At the start there is nowhere to go back to, and the control says so
    // rather than disappearing and moving the one beside it.
    expect(screen.getByRole('button', { name: 'Previous container types' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'More container types' }));
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('respects a caller that wants the rail sooner or later', () => {
    render(<CardRail {...labels} railFrom={10}>{cards(9)}</CardRail>);
    expect(screen.queryByRole('group', { name: 'Container types' })).not.toBeInTheDocument();
  });
});
