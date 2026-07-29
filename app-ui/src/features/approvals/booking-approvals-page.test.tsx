import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { BookingApprovalsPage } from './booking-approvals-page'

const item = {
  bookingId: '10000000-0000-4000-8000-000000000001',
  bookingNumber: 'BK-2026-000101',
  requesterName: 'Amina Khoury',
  vehicle: { plate: 'DEMO-01', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER' },
  pickupAtUtc: '2999-01-01T08:00:00.000Z',
  returnAtUtc: '2999-01-01T10:00:00.000Z',
  purpose: 'Port operations',
  passengerCount: 3,
  consentVersion: 'consent-approved-v1',
  workflowStepId: '20000000-0000-4000-8000-000000000001',
  expectedBookingVersion: 4,
  expectedStepVersion: 1,
  dueAtUtc: '2998-12-31T08:00:00.000Z',
  delegated: false,
  evidence: { eligibility: 'VERIFIED_AT_CONSENT', consent: 'SIGNED', reservation: 'HELD', forecast: 'NOT_AVAILABLE' },
}

/** Renders the approval inbox with a retry-disabled query client. */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><BookingApprovalsPage /></QueryClientProvider>)
}

describe('BookingApprovalsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(http.get('*/api/v1/booking-approvals', () => HttpResponse.json([item])))
  })

  it('renders the live assigned task and safe evidence without a forecast claim', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Approval inbox' })).toBeVisible()
    expect(screen.getAllByText('BK-2026-000101').length).toBeGreaterThan(0)
    expect(screen.getByText('Verified when consent was committed')).toBeVisible()
    expect(screen.getByText('Not available')).toBeVisible()
    expect(screen.queryByText(/88%|cost|licence|signature|device/i)).not.toBeInTheDocument()
  })

  it('sends expected versions and a durable key for approval', async () => {
    const requests: Array<{ body: Record<string, unknown>; key: string | null }> = []
    server.use(http.post('*/api/v1/bookings/:id/approve', async ({ request: incoming }) => {
      requests.push({ body: await incoming.json() as Record<string, unknown>, key: incoming.headers.get('idempotency-key') })
      return HttpResponse.json({ status: 'Approved' })
    }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Amina Khoury')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Confirm decision' }))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]?.body).toEqual({ expectedBookingVersion: 4, expectedStepVersion: 1 })
    expect(requests[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('requires a reason before declining', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Amina Khoury')
    await user.click(screen.getByRole('button', { name: 'Decline' }))
    expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeDisabled()
    await user.type(screen.getByLabelText('Decision reason'), 'Operational conflict')
    expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeEnabled()
  })
})