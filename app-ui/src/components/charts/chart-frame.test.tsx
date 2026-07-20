import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartFrame } from './index'

describe('ChartFrame', () => {
  it('renders a visible caption and a semantic data-table fallback', () => {
    render(
      <ChartFrame
        title="Cost per km"
        description="Trailing 6 months"
        data={[
          { m: 'Jun', cost: 1.88 },
          { m: 'Jul', cost: 1.84 },
        ]}
        columns={[
          { key: 'm', label: 'Month' },
          { key: 'cost', label: 'AED / km' },
        ]}
      >
        <div data-testid="chart-body">chart</div>
      </ChartFrame>,
    )
    // Visible title
    expect(screen.getByText('Cost per km')).toBeVisible()
    // Semantic fallback table exists with the data
    const table = screen.getByRole('table', { hidden: true })
    expect(table).toBeInTheDocument()
    expect(screen.getByText('AED / km', { selector: 'th' })).toBeInTheDocument()
    expect(screen.getByText('1.84', { selector: 'td' })).toBeInTheDocument()
  })
})
