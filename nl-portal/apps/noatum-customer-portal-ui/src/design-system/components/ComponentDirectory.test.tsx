import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ComponentDirectory, type ComponentDirectoryLabels } from './ComponentDirectory';

const items = [
  { code: 'FN-01', name: 'Brand and state colours', group: 'Foundations', keywords: ['palette'] },
  { code: 'CH-11', name: 'Pagination', group: 'Chrome', keywords: ['pages', 'rows'] },
  { code: 'DA-05', name: 'Mode ladder bar chart', group: 'Data display', keywords: ['emissions'] },
] as const;

const labels: ComponentDirectoryLabels = {
  eyebrow: 'Directory',
  searchLabel: 'Search components',
  searchPlaceholder: 'Find a component',
  groupsLabel: 'Component groups',
  allGroups: 'All',
  clearSearch: 'Clear search',
  empty: 'Nothing matches.',
  results: (visible, total) => `${visible} of ${total} components`,
};

afterEach(cleanup);

describe('ComponentDirectory', () => {
  it('searches codes, names and keywords and clears the query', async () => {
    const user = userEvent.setup();
    render(<ComponentDirectory items={items} labels={labels} />);

    const search = screen.getByRole('searchbox', { name: labels.searchLabel });
    await user.type(search, 'emissions');

    expect(screen.getByText('DA-05')).toBeVisible();
    expect(screen.queryByText('FN-01')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3 components')).toBeVisible();

    await user.click(screen.getByRole('button', { name: labels.clearSearch }));
    expect(screen.getByText('FN-01')).toBeVisible();
  });

  it('filters by group and exposes each count', async () => {
    const user = userEvent.setup();
    render(
      <ComponentDirectory items={items} labels={labels} groupOrder={['Chrome', 'Foundations']} />,
    );

    const filters = screen.getByRole('group', { name: labels.groupsLabel });
    expect(within(filters).getByRole('button', { name: 'All 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(filters).getByRole('button', { name: 'Chrome 1' })).toBeVisible();

    await user.click(within(filters).getByRole('button', { name: 'Chrome 1' }));
    expect(screen.getByText('CH-11')).toBeVisible();
    expect(screen.queryByText('DA-05')).not.toBeInTheDocument();
  });

  it('supports controlled state and reports selection', async () => {
    const user = userEvent.setup();
    const selected = vi.fn();

    function ControlledDirectory() {
      const [query, setQuery] = useState('Pagination');
      return (
        <ComponentDirectory
          items={items}
          labels={labels}
          query={query}
          onQueryChange={setQuery}
          onSelect={selected}
        />
      );
    }

    render(<ControlledDirectory />);
    await user.click(screen.getByRole('button', { name: 'CH-11 Pagination' }));
    expect(selected).toHaveBeenCalledWith(items[1]);
  });

  it('marks the selected component as current', () => {
    render(
      <ComponentDirectory items={items} labels={labels} selectedCode="CH-11" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'CH-11 Pagination' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('renders the supplied empty state', async () => {
    const user = userEvent.setup();
    render(<ComponentDirectory items={items} labels={labels} />);
    await user.type(screen.getByRole('searchbox', { name: labels.searchLabel }), 'missing');
    expect(screen.getByText(labels.empty)).toBeVisible();
  });
});
