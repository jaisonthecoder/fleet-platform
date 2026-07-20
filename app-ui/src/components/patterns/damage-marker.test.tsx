import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DamageMarker, type DamageMark } from './damage-marker'

function Harness() {
  const [marks, setMarks] = useState<DamageMark[]>([])
  return <DamageMarker marks={marks} onChange={setMarks} />
}

describe('DamageMarker', () => {
  it('starts empty and adds a pin when the diagram is tapped', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText(/No damage pinned/i)).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: /Tap the vehicle to mark damage/i }),
    )

    expect(screen.getByRole('button', { name: 'Damage 1' })).toBeInTheDocument()
    expect(screen.queryByText(/No damage pinned/i)).not.toBeInTheDocument()
  })

  it('keeps an existing mark read-only (no remove button)', () => {
    render(
      <DamageMarker
        marks={[
          {
            id: 'e1',
            x: 20,
            y: 20,
            note: 'Old scratch',
            photos: [],
            existing: true,
          },
        ]}
        onChange={() => undefined}
      />,
    )
    expect(
      screen.getByRole('button', { name: /Existing mark/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Remove damage/i }),
    ).not.toBeInTheDocument()
  })
})
