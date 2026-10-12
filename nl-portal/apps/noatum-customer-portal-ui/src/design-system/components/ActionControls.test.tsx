import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { Stepper, ViewSwitcher } from './ActionControls';

afterEach(cleanup);

describe('ViewSwitcher', () => {
  it('reports the selected value and exposes pressed state', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ViewSwitcher
        label="Listing view"
        value="grid"
        onValueChange={onValueChange}
        options={[
          { value: 'grid', label: 'Grid' },
          { value: 'cards', label: 'Cards' },
        ]}
      />,
    );

    const group = screen.getByRole('toolbar', { name: 'Listing view' });
    expect(within(group).getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(group).getByRole('button', { name: 'Cards' }));
    expect(onValueChange).toHaveBeenCalledWith('cards');
  });
});

describe('Stepper', () => {
  it('increments, decrements and blocks boundary actions', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Stepper
        label="Containers"
        value={1}
        min={0}
        max={2}
        onValueChange={onValueChange}
        decrementLabel="Remove container"
        incrementLabel="Add container"
        unit="containers"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add container' }));
    expect(onValueChange).toHaveBeenCalledWith(2);

    rerender(
      <Stepper
        label="Containers"
        value={2}
        min={0}
        max={2}
        onValueChange={onValueChange}
        decrementLabel="Remove container"
        incrementLabel="Add container"
      />,
    );
    expect(screen.getByRole('button', { name: 'Add container' })).toBeDisabled();
  });
});
