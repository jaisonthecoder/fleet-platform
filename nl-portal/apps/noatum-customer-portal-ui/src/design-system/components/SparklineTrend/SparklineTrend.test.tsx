import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { SparklineTrend } from './SparklineTrend';

afterEach(cleanup);

const base = {
  title: 'Carbon intensity trend',
  chartLabel: 'Carbon intensity, April to September',
  labels: ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP'],
};

describe('SparklineTrend (DA-07)', () => {
  it('exposes the values as a table, since a path exposes none', () => {
    render(<SparklineTrend {...base} points={[58, 50, 54, 38, 34, 26]} />);
    expect(screen.getByRole('table', { name: base.chartLabel })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'JUL' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '38' })).toBeInTheDocument();
  });

  it('renders the empty state for a single point rather than a stray triangle', () => {
    render(<SparklineTrend {...base} points={[58]} empty="Not enough history yet" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Not enough history yet')).toBeVisible();
  });

  it('ignores points that are not numbers', () => {
    render(<SparklineTrend {...base} points={[58, Number.NaN, 26]} />);
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + two usable points
  });

  it('draws a flat series without dividing by zero', () => {
    const { container } = render(<SparklineTrend {...base} points={[40, 40, 40]} />);
    const line = container.querySelector('path:nth-of-type(2)')?.getAttribute('d') ?? '';
    expect(line).not.toContain('NaN');
  });

  it('describes the chart with its own table', () => {
    const { container } = render(<SparklineTrend {...base} points={[1, 2, 3]} />);
    const svg = container.querySelector('svg');
    const tableId = svg?.getAttribute('aria-describedby');
    expect(tableId).toBeTruthy();
    expect(container.querySelector(`#${CSS.escape(tableId as string)}`)?.tagName).toBe('TABLE');
  });

  it('lets the caller format the values', () => {
    render(
      <SparklineTrend {...base} points={[58, 26]} formatValue={(value) => `${value} kg CO2e`} />,
    );
    expect(screen.getByRole('cell', { name: '58 kg CO2e' })).toBeInTheDocument();
  });
});
