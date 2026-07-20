import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckCircle2, Inbox } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Banner } from '@/components/patterns/banner'
import { EmptyState } from '@/components/patterns/empty-state'
import { AppProviders } from '@/app/providers/app-providers'
import { notify } from '@/hooks/use-toast'

describe('feedback components', () => {
  it('renders an Alert with tone, title and description', () => {
    render(
      <Alert tone="ok">
        <CheckCircle2 />
        <AlertTitle>Compliant</AlertTitle>
        <AlertDescription>Licence valid.</AlertDescription>
      </Alert>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Compliant')).toBeVisible()
    expect(screen.getByText('Licence valid.')).toBeVisible()
  })

  it('Progress exposes the value via ARIA', () => {
    render(<Progress value={64} label="Upload" />)
    const bar = screen.getByRole('progressbar', { name: 'Upload' })
    expect(bar).toHaveAttribute('aria-valuenow', '64')
  })

  it('Banner fires onDismiss', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <Banner
        tone="warn"
        title="Heads up"
        onDismiss={onDismiss}
        dismissLabel="Dismiss"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('EmptyState renders its action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <EmptyState
        icon={Inbox}
        title="No bookings yet"
        action={
          <button type="button" onClick={onClick}>
            Book
          </button>
        }
      />,
    )
    expect(screen.getByText('No bookings yet')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Book' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('notify shows a toast through the mounted Toaster', async () => {
    render(
      <AppProviders>
        <div />
      </AppProviders>,
    )
    notify.ok('Booking confirmed', { description: 'WF-482910' })
    expect(await screen.findByText('Booking confirmed')).toBeVisible()
  })
})
