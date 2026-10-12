import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import {
  ChipToggleGroup,
  FilterChip,
  RadioCardGroup,
  TransportModePicker,
} from './SelectionControls';

afterEach(cleanup);

describe('selection controls', () => {
  it('reports a transport mode through native radio semantics', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TransportModePicker
        label="Transport mode"
        value="sea"
        onValueChange={onValueChange}
        options={[
          { value: 'sea', label: 'Sea FCL', description: 'Full container', icon: 'container-ship' },
          { value: 'air', label: 'Air', description: 'Airport or door', icon: 'air-freight' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: /Sea FCL/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Air/ }));
    expect(onValueChange).toHaveBeenCalledWith('air');
  });

  it('supports radio cards and multi-select chips', async () => {
    const user = userEvent.setup();
    const onRadioChange = vi.fn();
    const onValuesChange = vi.fn();
    render(
      <>
        <RadioCardGroup
          label="Scope"
          value="door"
          onValueChange={onRadioChange}
          options={[{ value: 'door', label: 'Door to door' }, { value: 'port', label: 'Port to port' }]}
        />
        <ChipToggleGroup
          label="Services"
          values={['customs']}
          onValuesChange={onValuesChange}
          options={[{ value: 'customs', label: 'Customs clearance' }, { value: 'insurance', label: 'Cargo insurance' }]}
        />
      </>,
    );
    await user.click(screen.getByRole('radio', { name: 'Port to port' }));
    expect(onRadioChange).toHaveBeenCalledWith('port');
    await user.click(screen.getByRole('checkbox', { name: 'Cargo insurance' }));
    expect(onValuesChange).toHaveBeenCalledWith(['customs', 'insurance']);
  });

  it('gives removable filter chips an explicit action name', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<FilterChip label="Mode: Sea FCL" removeLabel="Remove mode filter" onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Remove mode filter: Mode: Sea FCL' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
