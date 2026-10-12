import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { RingGauge } from './RingGauge';

afterEach(cleanup);

describe('RingGauge (DA-06)', () => {
  it('rounds the announced value instead of reading every digit', () => {
    // It used to announce "Fill: 33.33333333%".
    render(<RingGauge value={33.33333333} label="Emissions against the worst mode" />);
    expect(
      screen.getByRole('img', { name: 'Emissions against the worst mode: 33 percent' }),
    ).toBeInTheDocument();
  });

  it('clamps rather than drawing off the ring', () => {
    const { rerender, container } = render(<RingGauge value={140} label="Fill" />);
    const arc = () => container.querySelector('circle:nth-of-type(2)');
    const total = 2 * Math.PI * 44;
    expect(Number(arc()?.getAttribute('stroke-dasharray')?.split(' ')[0])).toBeCloseTo(total, 1);

    rerender(<RingGauge value={-20} label="Fill" />);
    expect(Number(arc()?.getAttribute('stroke-dasharray')?.split(' ')[0])).toBeCloseTo(0, 1);
  });

  it('survives a value that is not a number', () => {
    render(<RingGauge value={Number.NaN} label="Fill" />);
    expect(screen.getByRole('img', { name: 'Fill: 0 percent' })).toBeInTheDocument();
  });

  it('writes the facts out as text beside the ring', () => {
    render(
      <RingGauge
        value={61}
        label="Fill"
        facts={[
          { id: 'per-tonne', label: 'Per tonne', value: '14 kg' },
          { id: 'distance', label: 'Distance', value: '19,400 km' },
        ]}
      />,
    );
    expect(screen.getByText('Per tonne')).toBeVisible();
    expect(screen.getByText('19,400 km')).toBeVisible();
  });

  it('lets the caller own the announced wording', () => {
    render(
      <RingGauge
        value={61}
        label="Fill"
        formatValueText={(percent) => `${percent}% of the worst mode`}
      />,
    );
    expect(screen.getByRole('img', { name: 'Fill: 61% of the worst mode' })).toBeInTheDocument();
  });
});
