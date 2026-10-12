import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { LogisticsIcon } from './LogisticsIcon';
import { LOGISTICS_ICONS, LOGISTICS_ICON_NAMES } from './logistics-icon-data';

afterEach(cleanup);

describe('LogisticsIcon', () => {
  it('preserves the complete FN-07 registry', () => {
    expect(LOGISTICS_ICON_NAMES).toHaveLength(59);
    expect(new Set(LOGISTICS_ICON_NAMES).size).toBe(59);
    expect(LOGISTICS_ICONS['container-ship'][0]).toBe('Container ship');
    expect(LOGISTICS_ICONS['free-time'][0]).toBe('Free time');
  });

  it('is decorative by default', () => {
    const { container } = render(<LogisticsIcon name="container-ship" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('provides a labelled image mode', () => {
    render(<LogisticsIcon name="dangerous-goods" decorative={false} label="Dangerous goods" />);
    expect(screen.getByRole('img', { name: 'Dangerous goods' })).toBeVisible();
  });

  it('uses the requested supported size and exact path', () => {
    const { container } = render(<LogisticsIcon name="air-freight" size={16} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg?.querySelector('path')).toHaveAttribute('d', LOGISTICS_ICONS['air-freight'][1]);
  });
});
