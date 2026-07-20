import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ReferenceForm } from './reference-form'

describe('ReferenceForm (RHF + Zod)', () => {
  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup()
    render(<ReferenceForm />)
    await user.click(screen.getByRole('button', { name: /Sign & submit/i }))
    expect(await screen.findByText('Enter a destination')).toBeVisible()
    expect(screen.getByText('Select a pool')).toBeVisible()
    expect(screen.getByText('You must accept to continue')).toBeVisible()
  })

  it('clears the destination error once a valid value is typed', async () => {
    const user = userEvent.setup()
    render(<ReferenceForm />)
    await user.click(screen.getByRole('button', { name: /Sign & submit/i }))
    expect(await screen.findByText('Enter a destination')).toBeVisible()
    await user.type(
      screen.getByPlaceholderText('Khalifa Port, Gate 4'),
      'Khalifa',
    )
    await user.click(screen.getByRole('button', { name: /Sign & submit/i }))
    expect(screen.queryByText('Enter a destination')).not.toBeInTheDocument()
  })
})
