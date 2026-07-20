import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { ConfirmProvider, useConfirm } from './use-confirm'

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await confirm({
          title: 'Decline booking?',
          tone: 'danger',
          confirmLabel: 'Decline',
          cancelLabel: 'Keep',
        })
        onResult(ok)
      }}
    >
      open
    </button>
  )
}

function renderHarness(onResult: (v: boolean) => void) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ConfirmProvider>
        <Harness onResult={onResult} />
      </ConfirmProvider>
    </I18nextProvider>,
  )
}

describe('useConfirm', () => {
  it('resolves true when confirmed', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderHarness(onResult)
    await user.click(screen.getByText('open'))
    await user.click(await screen.findByRole('button', { name: 'Decline' }))
    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('resolves false when cancelled', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    renderHarness(onResult)
    await user.click(screen.getByText('open'))
    await user.click(await screen.findByRole('button', { name: 'Keep' }))
    expect(onResult).toHaveBeenCalledWith(false)
  })
})
