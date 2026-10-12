import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Autocomplete, type AutocompleteOption } from './Autocomplete';

const PORTS: AutocompleteOption[] = [
  { value: 'ESVLC — Valencia', label: 'ESVLC — Valencia', hint: 'ES' },
  { value: 'ESBCN — Barcelona', label: 'ESBCN — Barcelona', hint: 'ES' },
];

/** Controlled, because that is the only way the real form uses it. */
function Harness(props: Partial<React.ComponentProps<typeof Autocomplete>> = {}) {
  const [value, setValue] = useState('');
  return (
    <Autocomplete
      label="Origin"
      value={value}
      onValueChange={setValue}
      options={PORTS}
      {...props}
    />
  );
}

describe('Autocomplete', () => {
  it('announces itself as a combobox, so the list is discoverable without a mouse', () => {
    render(<Harness />);
    const field = screen.getByRole('combobox', { name: /origin/i });
    expect(field).toHaveAttribute('aria-autocomplete', 'list');
    expect(field).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on focus, which is the affordance ComboInput lacks', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: /origin/i }));

    expect(await screen.findByText('ESVLC — Valencia')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /origin/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('takes the whole value when a row is chosen, not just the code', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: /origin/i }));
    await user.click(await screen.findByText('ESBCN — Barcelona'));

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /origin/i })).toHaveValue('ESBCN — Barcelona'),
    );
  });

  it('accepts a value nobody has added yet, because no directory is ever complete', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<Harness options={[]} onQueryChange={onQueryChange} />);

    await user.type(screen.getByRole('combobox', { name: /origin/i }), 'ZZZZZ');

    expect(screen.getByRole('combobox', { name: /origin/i })).toHaveValue('ZZZZZ');
    expect(onQueryChange).toHaveBeenLastCalledWith('ZZZZZ');
  });

  it('separates "keep typing" from "nothing matched"', async () => {
    const user = userEvent.setup();
    render(<Harness options={[]} minQuery={3} promptHint="Keep typing" emptyHint="No match" />);

    const field = screen.getByRole('combobox', { name: /origin/i });
    await user.click(field);
    expect(await screen.findByText('Keep typing')).toBeInTheDocument();

    await user.type(field, 'abc');
    expect(await screen.findByText('No match')).toBeInTheDocument();
  });

  it('clears to empty rather than to the last suggestion', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const field = screen.getByRole('combobox', { name: /origin/i });
    await user.type(field, 'Valencia');
    await user.click(screen.getByRole('button', { name: /clear origin/i }));

    expect(field).toHaveValue('');
  });

  it('ties the error to the field, so it is read out and not merely drawn', async () => {
    render(<Harness error="Must be a 5-character UN/LOCODE" />);

    const field = screen.getByRole('combobox', { name: /origin/i });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Must be a 5-character UN/LOCODE');
  });
});
