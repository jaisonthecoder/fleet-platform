import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { RangeSlider } from './RangeSlider';

afterEach(cleanup);

describe('RangeSlider', () => {
  it('exposes its label, bounds and current value', () => {
    render(
      <RangeSlider
        label="Maximum transit"
        value={32}
        min={18}
        max={48}
        minimumLabel="18 days"
        maximumLabel="48 days"
        valueLabel="32 days"
        onValueChange={() => undefined}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Maximum transit' });
    expect(slider).toHaveAttribute('min', '18');
    expect(slider).toHaveAttribute('max', '48');
    expect(slider).toHaveValue('32');
    expect(screen.getByText('32 days')).toBeVisible();
  });

  it('reports native numeric changes', () => {
    const onValueChange = vi.fn();
    render(
      <RangeSlider label="Payload" value={12000} max={28000} step={500} onValueChange={onValueChange} />,
    );
    fireEvent.change(screen.getByRole('slider', { name: 'Payload' }), {
      target: { value: '17000' },
    });
    expect(onValueChange).toHaveBeenCalledWith(17000);
  });

  it('clamps an out-of-range value before rendering', () => {
    render(<RangeSlider label="Payload" value={30000} max={28000} onValueChange={() => undefined} />);
    expect(screen.getByRole('slider', { name: 'Payload' })).toHaveValue('28000');
  });
});
