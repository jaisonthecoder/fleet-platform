import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ComboInput } from './ComboInput';

afterEach(cleanup);

const COUNTRIES = ['Spain', 'España', 'Sweden', 'Switzerland', 'China'];

/** Controlled, the way every caller uses it. */
function Harness({ options = COUNTRIES }: { options?: string[] }) {
  const [value, setValue] = useState('');
  return (
    <ComboInput
      label="Country of origin"
      options={options}
      value={value}
      emptyHint="No match. It will be sent as typed."
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe('ComboInput (IN-02)', () => {
  it('is a combobox, not a browser datalist', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Country of origin' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    // The native control would leave a <datalist> in the tree and draw the list
    // with the browser's own chrome, which is the whole reason this exists.
    expect(document.querySelector('datalist')).toBeNull();
  });

  it('filters as you type, ignoring case and accents', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('combobox'), 'espana');

    expect(await screen.findByRole('option', { name: 'España' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'China' })).not.toBeInTheDocument();
  });

  it('puts a chosen suggestion in the field through the caller\'s own onChange', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'swe');
    await user.click(await screen.findByRole('option', { name: 'Sweden' }));

    expect(input).toHaveValue('Sweden');
    // Chosen means answered: the list does not spring back open.
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('still accepts something nobody has added to the list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'Wakanda');

    expect(input).toHaveValue('Wakanda');
    expect(await screen.findByText('No match. It will be sent as typed.')).toBeInTheDocument();
  });

  it('walks the list with the arrow keys and takes the highlighted one on Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.type(input, 's');
    await user.keyboard('{ArrowDown}{ArrowDown}');

    const highlighted = screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true');
    expect(input).toHaveAttribute('aria-activedescendant', highlighted?.id);

    await user.keyboard('{Enter}');
    expect(input).toHaveValue(highlighted?.textContent);
  });

  it('closes on Escape without changing what was typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'sp');
    expect(await screen.findByRole('option', { name: 'Spain' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(input).toHaveValue('sp');
  });
});
