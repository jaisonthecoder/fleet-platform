import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignaturePad } from './signature-pad'

function Harness() {
  const [signed, setSigned] = useState(false)
  return <><SignaturePad signerName="Amina Khoury" onSignedChange={setSigned} /><output>{signed ? 'signed' : 'unsigned'}</output></>
}

describe('SignaturePad', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ clearRect: vi.fn(), getImageData: vi.fn(() => null), putImageData: vi.fn(), setTransform: vi.fn() }) })
  })

  it('does not treat a designated signer name as an automatic typed signature', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('unsigned')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Type' }))
    const input = screen.getByRole('textbox', { name: 'Type your full name to sign' })
    expect(input).toHaveValue('')
    expect(screen.getByText('unsigned')).toBeVisible()
    await user.type(input, 'Amina Khoury')
    expect(screen.getByText('signed')).toBeVisible()
  })
})