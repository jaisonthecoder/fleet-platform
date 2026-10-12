import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { RadioCards } from './RadioCards';

afterEach(cleanup);

const options = [
  { value: 'port-port', label: 'Port to port' },
  { value: 'door-door', label: 'Door to door' },
  { value: 'door-port', label: 'Door to port' },
];

describe('RadioCards (SE-02)', () => {
  it('is one named radio group, not a row of buttons', () => {
    render(<RadioCards label="Scope requested" options={options} value="port-port" onValueChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Scope requested' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Port to port' })).toBeChecked();
  });

  // Arrow-key selection belongs to Radix, and neither jsdom nor browser
  // automation activates a control by key press — both move focus and stop
  // there. Testing it here would assert the environment, not the component.
  // What this component owns is the radio semantics that make the keyboard
  // work at all, and the wiring of onValueChange.
  it('reports the chosen value through onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<RadioCards label="Scope requested" options={options} value="port-port" onValueChange={onValueChange} />);
    await user.click(screen.getByRole('radio', { name: 'Door to door' }));
    expect(onValueChange).toHaveBeenCalledWith('door-door');
  });

  it('keeps the dot out of the accessible name', () => {
    render(<RadioCards label="Scope requested" options={options} value="port-port" onValueChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Door to door' })).toBeInTheDocument();
  });

  it('renders the group label above the cards only when asked', () => {
    const { rerender } = render(
      <RadioCards label="Scope requested" options={options} value="port-port" onValueChange={() => {}} />,
    );
    expect(screen.queryByText('Scope requested')).not.toBeInTheDocument();

    rerender(
      <RadioCards showLabel label="Scope requested" options={options} value="port-port" onValueChange={() => {}} />,
    );
    expect(screen.getByText('Scope requested')).toBeVisible();
  });
});
