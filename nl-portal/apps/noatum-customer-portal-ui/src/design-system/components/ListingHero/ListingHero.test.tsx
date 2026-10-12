import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ListingHero } from './ListingHero';

afterEach(cleanup);

const segments = [
  { key: 'requested', label: 'Requested', count: 2 },
  { key: 'options_ready', label: 'Options ready', count: 3 },
  { key: 'accepted', label: 'Accepted', count: 0 },
];

function renderHero(props: Partial<Parameters<typeof ListingHero>[0]> = {}) {
  return render(
    <ListingHero
      title="Quotations"
      segments={segments}
      segmentsLabel="Filter by state"
      clearLabel="Clear filter"
      {...props}
    >
      <div>listing</div>
    </ListingHero>,
  );
}

describe('listing hero', () => {
  /* The band is a legend as much as a filter, so a state at zero is still drawn:
     "nothing is expiring" is a fact worth reading, and a legend that changes
     shape between visits is one nobody can learn to scan. */
  it('draws every state, including the ones at zero', () => {
    renderHero();
    const group = screen.getByRole('group', { name: 'Filter by state' });
    expect(within(group).getAllByRole('button')).toHaveLength(3);
    expect(within(group).getByRole('button', { name: /Accepted 0/ })).toBeInTheDocument();
  });

  /* Filtering to an empty state could only ever produce an empty grid, so the
     chip reports and does not offer: inert, and out of the tab order. */
  it('reports a state at zero rather than offering it', async () => {
    const user = userEvent.setup();
    const onSegmentChange = vi.fn();
    renderHero({ onSegmentChange });

    const empty = screen.getByRole('button', { name: /Accepted 0/ });
    expect(empty).toBeDisabled();
    await user.click(empty);
    expect(onSegmentChange).not.toHaveBeenCalled();
  });

  it('reports the segment that was picked', async () => {
    const user = userEvent.setup();
    const onSegmentChange = vi.fn();
    renderHero({ onSegmentChange });

    await user.click(screen.getByRole('button', { name: /Options ready 3/ }));
    expect(onSegmentChange).toHaveBeenCalledWith('options_ready');
  });

  /* Picking the segment you are already in is how you get back out of it - there
     is no other affordance on the chip itself. */
  it('clears the filter when the active segment is picked again', async () => {
    const user = userEvent.setup();
    const onSegmentChange = vi.fn();
    renderHero({ activeSegment: 'options_ready', onSegmentChange });

    await user.click(screen.getByRole('button', { name: /Options ready 3/ }));
    expect(onSegmentChange).toHaveBeenCalledWith(null);
  });

  it('marks the active chip as pressed and offers a way out', async () => {
    const user = userEvent.setup();
    const onSegmentChange = vi.fn();
    renderHero({ activeSegment: 'requested', onSegmentChange });

    expect(screen.getByRole('button', { name: /Requested 2/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(onSegmentChange).toHaveBeenCalledWith(null);
  });

  /* The bar and the chips are the same control. Announcing both would read every
     state out twice to anyone who cannot see they are one row of colour. */
  it('does not announce the bar a second time', () => {
    renderHero();
    // Three chips and no second set: the bar draws only the two states that have
    // width, and is hidden from assistive technology regardless.
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('draws no band at all when nothing is in the list', () => {
    renderHero({ segments: [] });
    expect(screen.queryByRole('group', { name: 'Filter by state' })).not.toBeInTheDocument();
    expect(screen.getByText('listing')).toBeInTheDocument();
  });
});
