import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ChipToggles, FilterPills } from './ChipToggles';

afterEach(cleanup);

const services = [
  { value: 'insurance', label: 'Cargo insurance' },
  { value: 'customs', label: 'Customs clearance' },
  { value: 'inspection', label: 'Pre-shipment inspection' },
];

describe('ChipToggles (SE-03)', () => {
  it('reports each chip as pressed or not, so several answers announce as several', () => {
    render(
      <ChipToggles
        label="Additional services"
        options={services}
        values={['customs']}
        onValuesChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Customs clearance', pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cargo insurance', pressed: false }),
    ).toBeInTheDocument();
  });

  it('adds to the selection rather than replacing it', async () => {
    const user = userEvent.setup();
    const onValuesChange = vi.fn();
    render(
      <ChipToggles
        label="Additional services"
        options={services}
        values={['customs']}
        onValuesChange={onValuesChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cargo insurance' }));
    expect(onValuesChange).toHaveBeenCalledWith(expect.arrayContaining(['customs', 'insurance']));
  });

  it('removes a chip that is pressed again', async () => {
    const user = userEvent.setup();
    const onValuesChange = vi.fn();
    render(
      <ChipToggles
        label="Additional services"
        options={services}
        values={['customs']}
        onValuesChange={onValuesChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Customs clearance' }));
    expect(onValuesChange).toHaveBeenCalledWith([]);
  });

  it('keeps the drawn checkbox out of the accessible name', () => {
    render(
      <ChipToggles
        label="Additional services"
        options={services}
        values={[]}
        onValuesChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Pre-shipment inspection' })).toBeInTheDocument();
  });
});

describe('FilterPills (SE-03)', () => {
  const pills = [
    { value: 'all', label: 'All', count: 24 },
    { value: 'sea', label: 'Sea', count: 18 },
    { value: 'air', label: 'Air', count: 6 },
  ];

  it('keeps exactly one pill pressed', () => {
    render(<FilterPills label="Mode" options={pills} value="sea" onValueChange={() => {}} />);
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1);
  });

  it('does not clear the filter when the pressed pill is pressed again', async () => {
    // Radix single mode reports an empty string on deselect. A filter that must
    // always carry a value would otherwise empty itself.
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<FilterPills label="Mode" options={pills} value="sea" onValueChange={onValueChange} />);
    await user.click(screen.getByRole('radio', { name: /Sea/ }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows a count only where one is supplied', () => {
    render(
      <FilterPills
        label="Mode"
        options={[{ value: 'all', label: 'All' }, ...pills.slice(1)]}
        value="all"
        onValueChange={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Sea\s*18/ })).toBeInTheDocument();
  });
});
