import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { ApprovalHistoryPanel } from './approval-history-panel'

const POOL_ID = '10000000-0000-4000-8000-000000000001'
const DEDICATED_ID = '20000000-0000-4000-8000-000000000001'

/** Renders approval history with retries disabled for deterministic API assertions. */
function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ApprovalHistoryPanel /></QueryClientProvider>)
}

describe('ApprovalHistoryPanel', () => {
  const interventions: Array<{ url: string; body: unknown }> = []

  beforeEach(async () => {
    interventions.length = 0
    await i18n.changeLanguage('en')
    const common = {
      requesterName: 'Aisha Rahman', status: 'Approved', revision: 4, decision: 'APPROVED', decisionReason: null,
      decidedAtUtc: '2026-08-10T08:00:00.000Z', suspended: false, suspensionReason: null, suspendedAtUtc: null,
      capabilities: { suspend: true, resume: false, revoke: true }, interventions: [{ action: 'SUSPEND', reason: 'Earlier evidence review', occurredAtUtc: '2026-08-09T08:00:00.000Z' }],
    }
    server.use(
      http.get('*/api/v1/booking-approvals/history', () => HttpResponse.json([{ ...common, domain: 'PoolBooking', subjectId: POOL_ID, reference: 'BK-2026-100001', summary: 'DEMO-02' }])),
      http.get('*/api/v1/entitlements/approvals/history', () => HttpResponse.json([{ ...common, domain: 'DedicatedVehicle', subjectId: DEDICATED_ID, reference: DEDICATED_ID, summary: 'LongTerm · SUV' }])),
      http.post('*/api/v1/bookings/:id/approval-intervention', async ({ request }) => {
        interventions.push({ url: request.url, body: await request.json() })
        return HttpResponse.json({ status: 'Approved' })
      }),
      http.post('*/api/v1/entitlements/:id/approval-intervention', async ({ request }) => {
        interventions.push({ url: request.url, body: await request.json() })
        return HttpResponse.json({ status: 'Cancelled' })
      }),
    )
  })

  it('categorizes both domains and submits a reason-bound Pool suspension', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(await screen.findByText('BK-2026-100001')).toBeVisible()
    expect(screen.getByText(DEDICATED_ID)).toBeVisible()
    expect(screen.getAllByText('Earlier evidence review')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Pool bookings' }))
    expect(screen.getByText('BK-2026-100001')).toBeVisible()
    expect(screen.queryByText(DEDICATED_ID)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Suspend' }))
    const confirm = screen.getByRole('button', { name: 'Confirm intervention' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Intervention reason'), 'Vehicle safety evidence requires review')
    await user.click(confirm)

    expect(interventions).toEqual([{
      url: expect.stringContaining(`/api/v1/bookings/${POOL_ID}/approval-intervention`),
      body: { action: 'SUSPEND', expectedRevision: 4, reason: 'Vehicle safety evidence requires review' },
    }])
  })

  it('routes a Dedicated revocation to the Dedicated aggregate endpoint', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText(DEDICATED_ID)
    await user.click(screen.getByRole('button', { name: 'Dedicated vehicles' }))
    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    await user.type(screen.getByLabelText('Intervention reason'), 'Dedicated approval withdrawn before allocation')
    await user.click(screen.getByRole('button', { name: 'Confirm intervention' }))

    expect(interventions).toEqual([{
      url: expect.stringContaining(`/api/v1/entitlements/${DEDICATED_ID}/approval-intervention`),
      body: { action: 'REVOKE', expectedRevision: 4, reason: 'Dedicated approval withdrawn before allocation' },
    }])
  })
})
