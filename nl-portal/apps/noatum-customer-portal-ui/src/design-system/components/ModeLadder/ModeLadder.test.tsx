import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ModeLadder } from './ModeLadder';

afterEach(cleanup);

const items = [
  { id: 'sea', label: 'Sea FCL', detail: '32 days', value: 620, valueLabel: '620 kg', preferred: true },
  { id: 'rail', label: 'Rail', detail: '19 days', value: 1240, valueLabel: '1,240 kg', selected: true },
  { id: 'air', label: 'Air', detail: '3 days', value: 8400, valueLabel: '8,400 kg' },
];

const fillOf = (container: HTMLElement, index: number) =>
  container.querySelectorAll('[style*="--fill"]')[index]?.getAttribute('style') ?? '';

describe('ModeLadder (DA-05)', () => {
  it('scales every bar against the largest value', () => {
    const { container } = render(<ModeLadder items={items} label="Emissions by mode" />);
    expect(fillOf(container, 2)).toContain('100%');
  });

  it('does not collapse the group when one value is not a number', () => {
    // Math.max over a NaN made every bar NaN%.
    const { container } = render(
      <ModeLadder
        label="Emissions by mode"
        items={[{ id: 'bad', label: 'Bad', value: Number.NaN, valueLabel: '—' }, ...items]}
      />,
    );
    expect(fillOf(container, 3)).toContain('100%');
  });

  it('survives every value being zero rather than drawing full bars', () => {
    const { container } = render(
      <ModeLadder
        label="Emissions by mode"
        items={[{ id: 'a', label: 'A', value: 0, valueLabel: '0' }]}
      />,
    );
    expect(fillOf(container, 0)).toContain('0%');
  });

  it('says which row is chosen and which is best, in words', () => {
    render(
      <ModeLadder
        items={items}
        label="Emissions by mode"
        selectedLabel="chosen"
        preferredLabel="lowest emissions"
      />,
    );
    expect(screen.getByText(', chosen')).toBeInTheDocument();
    expect(screen.getByText(', lowest emissions')).toBeInTheDocument();
  });

  it('is read-only until a handler is supplied', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<ModeLadder items={items} label="Emissions by mode" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    rerender(<ModeLadder items={items} label="Emissions by mode" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Air/ }));
    expect(onSelect).toHaveBeenCalledWith('air');
  });
});
