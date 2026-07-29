import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { EntitlementApprovalsPanel } from './entitlement-approvals-panel'

const item = {
  entitlementId: '10000000-0000-4000-8000-000000000001', revision: 2,
  workflowInstanceId: '20000000-0000-4000-8000-000000000001',
  workflowStepId: '30000000-0000-4000-8000-000000000001', workflowStepVersion: 1,
  delegated: false, actingForPersonId: null, requesterName: 'Aisha Rahman',
  requestType: 'LongTerm', driverOption: 'WithoutDriver',
  justificationCategory: 'OPERATIONAL_REQUIREMENT', justificationText: 'Cross-site operational requirement',
  vehicleCategoryCode: 'SUV', preferredVehicleId: null, preferenceNote: 'Fortuner if available',
  durationStart: '2026-08-01', durationEnd: '2026-12-31', locationName: 'Khalifa Port Pool',
  eligibilityResult: { decision: 'ALLOW', policyVersion: 'manual-dedicated-eligibility-v1' },
  dueAtUtc: '2026-07-28T08:00:00.000Z',
}

/** Renders the Dedicated approval panel with retry-disabled queries. */
function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><EntitlementApprovalsPanel /></QueryClientProvider>)
}

describe('EntitlementApprovalsPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(http.get('*/api/v1/entitlements/approvals', () => HttpResponse.json([item])))
  })

  it('shows minimized request, eligibility and non-binding preference evidence', async () => {
    renderPanel()
    expect(await screen.findByRole('heading', { name: 'Aisha Rahman' })).toBeVisible()
    expect(screen.getByText('Cross-site operational requirement')).toBeVisible()
    expect(screen.getByText('Fortuner if available')).toBeVisible()
    expect(screen.getByText('Eligibility and approval route evidence are pinned')).toBeVisible()
    expect(screen.queryByText(/grade|salary|vin|insurance|signature/i)).not.toBeInTheDocument()
  })

  it('sends both versions and a durable key for approval', async () => {
    const decisions: Array<{ body: Record<string, unknown>; key: string | null }> = []
    server.use(http.post('*/api/v1/entitlements/:id/approve', async ({ request }) => {
      decisions.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
      return HttpResponse.json({ status: 'Approved' })
    }))
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Cross-site operational requirement')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await user.click(screen.getByRole('button', { name: 'Confirm decision' }))
    await waitFor(() => expect(decisions).toHaveLength(1))
    expect(decisions[0]?.body).toEqual({ expectedRevision: 2, expectedStepVersion: 1 })
    expect(decisions[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  })
})