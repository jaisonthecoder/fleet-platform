import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { DateField } from './DateField';
import type { DateParts } from '../DateDisplay';

afterEach(cleanup);

const SEP_25: DateParts = {
  dayNumber: '25',
  monthShort: 'SEP',
  year: '2026',
  weekday: 'Fri',
  weekNumber: 'W39',
  numeric: '25.09.2026',
  full: 'Fri 25 SEP 2026',
  relative: 'in 5 days',
  relativeTone: 'success',
  iso: '2026-09-25',
};

const calendar = {
  calendarLabel: 'Cargo ready date',
  today: new Date(2026, 8, 20),
  startMonth: new Date(2026, 8, 1),
};

describe('DateField (DT-01 D)', () => {
  it('starts closed, so a form row is a row and not a calendar', () => {
    render(
      <DateField label="Cargo ready" placeholder="Choose a date" onSelect={() => {}} calendar={calendar} />,
    );
    expect(screen.getByRole('button', { name: /Choose a date/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('opens the grid on the body rather than inside the form row', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DateField label="Cargo ready" date={SEP_25} onSelect={() => {}} calendar={calendar} />,
    );

    await user.click(screen.getByRole('button', { name: /Cargo ready/ }));

    const grid = await screen.findByRole('grid');
    expect(grid).toBeInTheDocument();
    // Portalled: the panel is not a descendant of the field it belongs to.
    expect(container.contains(grid)).toBe(false);
  });

  it('closes once the question is answered', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DateField
        label="Cargo ready"
        date={SEP_25}
        selected={new Date(2026, 8, 25)}
        onSelect={onSelect}
        calendar={calendar}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Cargo ready/ });
    await user.click(trigger);
    const grid = await screen.findByRole('grid');
    await user.click(within(grid).getByText('22'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and hands focus back to the field', async () => {
    const user = userEvent.setup();
    render(<DateField label="Cargo ready" date={SEP_25} onSelect={() => {}} calendar={calendar} />);

    const trigger = screen.getByRole('button', { name: /Cargo ready/ });
    await user.click(trigger);
    await screen.findByRole('grid');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('names itself from its label and its value, not from the chevron', () => {
    // Queried by the label alone: the value is drawn as a DT-01 stamp, so how the
    // date is split into spans is presentation and must not be what the test pins.

    render(
      <DateField
        label="Cargo ready"
        date={SEP_25}
        hint="Sailing days are marked."
        onSelect={() => {}}
        calendar={calendar}
      />,
    );
    const trigger = screen.getByRole('button', { name: /^Cargo ready/ });
    expect(trigger).toHaveAccessibleDescription('Sailing days are marked.');
  });
});
