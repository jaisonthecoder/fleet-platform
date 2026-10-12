import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ModeCards } from './ModeCards';

afterEach(cleanup);

const options = [
  { value: 'sea-fcl', label: 'Sea FCL', description: 'Full container', icon: 'container-ship' },
  { value: 'sea-lcl', label: 'Sea LCL', description: 'Shared container', icon: 'container-ship' },
  { value: 'air', label: 'Air', description: 'Fastest', icon: 'air-freight' },
] as const;

describe('ModeCards (SE-01)', () => {
  it('exposes real radios, so the choice is announced as one', () => {
    render(<ModeCards label="Transport mode" options={options} value="sea-fcl" onValueChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Transport mode' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /Sea FCL/ })).toBeChecked();
  });

  // Arrow-key selection belongs to Radix, and neither jsdom nor browser
  // automation activates a control by key press — both move focus and stop
  // there. Testing it here would assert the environment, not the component.
  // What this component owns is the radio semantics that make the keyboard
  // work at all, and the wiring of onValueChange.
  it('reports the chosen value through onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ModeCards label="Transport mode" options={options} value="sea-fcl" onValueChange={onValueChange} />);

    await user.click(screen.getByRole('radio', { name: /Sea LCL/ }));
    expect(onValueChange).toHaveBeenCalledWith('sea-lcl');
  });

  it('keeps only the selected card in the tab order', async () => {
    const user = userEvent.setup();
    render(<ModeCards label="Transport mode" options={options} value="air" onValueChange={() => {}} />);

    await user.tab();
    expect(screen.getByRole('radio', { name: /Air/ })).toHaveFocus();
  });

  it('does not select a disabled option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ModeCards
        label="Transport mode"
        options={[...options.slice(0, 2), { ...options[2], disabled: true }]}
        value="sea-fcl"
        onValueChange={onValueChange}
      />,
    );
    await user.click(screen.getByRole('radio', { name: /Air/ }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('names each card from its label and its description, not the label alone', () => {
    // The browser joins the two text nodes with a space; jsdom's name algorithm
    // does not. Both include the description, which is what matters here.
    render(<ModeCards label="Transport mode" options={options} value="sea-fcl" onValueChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /Sea FCL\s*Full container/ })).toBeInTheDocument();
  });
});
