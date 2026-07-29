import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { DedicatedAllocationPage } from './dedicated-allocation-page'

const ENTITLEMENT_ID = '10000000-0000-4000-8000-000000000001'
const PREFERRED_ID = '20000000-0000-4000-8000-000000000001'
const OTHER_ID = '30000000-0000-4000-8000-000000000001'
const item = {
  entitlement: {
    id: ENTITLEMENT_ID, requestType: 'LongTerm', driverOption: 'WithoutDriver',
    requesterPersonId: '40000000-0000-4000-8000-000000000001', requestedByPersonId: '40000000-0000-4000-8000-000000000001', assignedDriverPersonId: '40000000-0000-4000-8000-000000000001',
    justificationCategory: 'OPERATIONAL_REQUIREMENT', justificationText: 'Cross-site need', vehicleCategoryCode: 'SUV', preferredVehicleId: PREFERRED_ID, preferenceNote: 'Fortuner preferred', vehicleId: null,
    durationStart: '2026-08-01', durationEnd: '2026-12-31', locationNodeId: '50000000-0000-4000-8000-000000000001', businessUnit: null, costCentre: null,
    status: 'AwaitingConsent', revision: 6, workflowInstanceId: '60000000-0000-4000-8000-000000000001', policyVersion: 'manual-v1', eligibilityResult: { decision: 'ALLOW' }, approvalRouteProvenance: {}, eligibilityPreviewId: '70000000-0000-4000-8000-000000000001', consentSignedAtUtc: '2026-07-26T10:00:00Z', allocatedAtUtc: null, renewedFromEntitlementId: null, capabilities: { edit: false, submit: false, consent: false, cancel: true, renew: false, returnVehicle: false, blockingReasons: [] }, createdAtUtc: '2026-07-25T00:00:00Z',
  },
  requesterName: 'Aisha Rahman', preferredVehiclePlate: 'AD-100',
  options: [
    { vehicleId: PREFERRED_ID, plate: 'AD-100', makeCode: 'TOYOTA', modelCode: 'FORTUNER', vehicleClass: 'SUV', fuelTypeCode: 'PETROL', locationName: 'Khalifa Port Pool' },
    { vehicleId: OTHER_ID, plate: 'AD-200', makeCode: 'NISSAN', modelCode: 'PATROL', vehicleClass: 'SUV', fuelTypeCode: 'PETROL', locationName: 'Khalifa Port Pool' },
  ],
}

/** Renders the Fleet allocation queue with retry-disabled queries. */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><DedicatedAllocationPage /></QueryClientProvider>)
}

describe('DedicatedAllocationPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(
      http.get('*/api/v1/entitlements/allocation-worklist', () => HttpResponse.json([item])),
      http.get('*/api/v1/entitlements/:id/bsd-windows', () => HttpResponse.json([])),
    )
  })

  it('shows only final-qualified options and non-binding preference context', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Dedicated Vehicle allocation' })).toBeVisible()
    expect(screen.getByText('AD-100')).toBeVisible()
    expect(screen.getByText(/Preferences are not guaranteed/)).toBeVisible()
    expect(screen.queryByText(/vin|insurance|vendor|lease/i)).not.toBeInTheDocument()
  })

  it('requires variance for another Vehicle and sends revision with a durable key', async () => {
    const allocations: Array<{ body: Record<string, unknown>; key: string | null }> = []
    server.use(http.post('*/api/v1/entitlements/:id/allocate', async ({ request }) => {
      allocations.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
      return HttpResponse.json({ ...item.entitlement, status: 'Allocated', revision: 7, vehicleId: OTHER_ID, allocatedAtUtc: '2026-07-26T11:00:00Z' })
    }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Aisha Rahman' })
    await user.click(screen.getByLabelText('Final qualified Vehicle'))
    await user.click(await screen.findByRole('option', { name: /AD-200/ }))
    expect(screen.getByRole('button', { name: 'Allocate Vehicle' })).toBeDisabled()
    await user.type(screen.getByLabelText('Preference variance reason'), 'Preferred Vehicle unavailable')
    await user.click(screen.getByRole('button', { name: 'Allocate Vehicle' }))
    await waitFor(() => expect(allocations).toHaveLength(1))
    expect(allocations[0]?.body).toEqual({ vehicleId: OTHER_ID, expectedRevision: 6, varianceReasonCode: 'Preferred Vehicle unavailable' })
    expect(allocations[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  }, 10_000)

  it('requires Fleet proposal then confirmation for an allocated BSD window', async () => {
    const calls: string[] = []
    const allocatedItem = { ...item, entitlement: { ...item.entitlement, status: 'Allocated', vehicleId: PREFERRED_ID, revision: 7, capabilities: { edit: false, submit: false, consent: false, cancel: false, renew: true, returnVehicle: true, blockingReasons: [] } } }
    server.use(
      http.get('*/api/v1/entitlements/allocation-worklist', () => HttpResponse.json([allocatedItem])),
      http.post('*/api/v1/entitlements/:id/bsd-windows', () => { calls.push('propose'); return HttpResponse.json({ id: '80000000-0000-4000-8000-000000000001', entitlementRequestId: ENTITLEMENT_ID, vehicleId: PREFERRED_ID, windowStart: '2026-09-01T08:00:00Z', windowEnd: '2026-09-03T08:00:00Z', status: 'Proposed', reason: 'Approved absence' }) }),
      http.post('*/api/v1/entitlements/bsd-windows/:id/confirm', () => { calls.push('confirm'); return HttpResponse.json({ id: '80000000-0000-4000-8000-000000000001', entitlementRequestId: ENTITLEMENT_ID, vehicleId: PREFERRED_ID, windowStart: '2026-09-01T08:00:00Z', windowEnd: '2026-09-03T08:00:00Z', status: 'Confirmed', reason: 'Fleet confirmed', confirmedAtUtc: '2026-08-30T08:00:00Z' }) }),
      http.post('*/api/v1/entitlements/bsd-windows/:id/cancel', () => { calls.push('cancel'); return HttpResponse.json({ id: '80000000-0000-4000-8000-000000000001', entitlementRequestId: ENTITLEMENT_ID, vehicleId: PREFERRED_ID, windowStart: '2026-09-01T08:00:00Z', windowEnd: '2026-09-03T08:00:00Z', status: 'Cancelled', reason: 'No longer required' }) }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Aisha Rahman' })
    await user.type(screen.getByLabelText('Pool window start'), '2026-09-01T08:00')
    await user.type(screen.getByLabelText('Pool return deadline'), '2026-09-03T08:00')
    await user.type(screen.getByLabelText('Fleet confirmation reason'), 'Approved absence')
    await user.click(screen.getByRole('button', { name: 'Propose window' }))
    expect(await screen.findByText('BSD window status: Proposed')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirm Pool window' }))
    expect(await screen.findByText('BSD window status: Confirmed')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel future window' }))
    await waitFor(() => expect(calls).toEqual(['propose', 'confirm', 'cancel']))
  }, 10_000)

  it('reloads a persisted Conflict without allowing a duplicate proposal or leaking Booking facts', async () => {
    const allocatedItem = { ...item, entitlement: { ...item.entitlement, status: 'Allocated', vehicleId: PREFERRED_ID, revision: 7, capabilities: { edit: false, submit: false, consent: false, cancel: false, renew: true, returnVehicle: true, blockingReasons: [] } } }
    server.use(
      http.get('*/api/v1/entitlements/allocation-worklist', () => HttpResponse.json([allocatedItem])),
      http.get('*/api/v1/entitlements/:id/bsd-windows', () => HttpResponse.json([{
        id: '80000000-0000-4000-8000-000000000001',
        entitlementRequestId: ENTITLEMENT_ID,
        vehicleId: PREFERRED_ID,
        windowStart: '2026-09-01T08:00:00Z',
        windowEnd: '2026-09-03T08:00:00Z',
        status: 'Conflict',
        reason: 'Operational conflict',
      }])),
    )

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('The Vehicle cannot return to its Dedicated assignment')
    expect(screen.getByRole('button', { name: 'Refresh schedule' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Propose window' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm Pool window' })).not.toBeInTheDocument()
    expect(screen.queryByText(/booking number|employee id|driver name|leave reason/i)).not.toBeInTheDocument()
  })

  it('rejects an invalid local BSD window before sending a request', async () => {
    const calls: unknown[] = []
    const allocatedItem = { ...item, entitlement: { ...item.entitlement, status: 'Allocated', vehicleId: PREFERRED_ID, revision: 7 } }
    server.use(
      http.get('*/api/v1/entitlements/allocation-worklist', () => HttpResponse.json([allocatedItem])),
      http.post('*/api/v1/entitlements/:id/bsd-windows', async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json({})
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Aisha Rahman' })
    await user.type(screen.getByLabelText('Pool window start'), '2026-09-03T08:00')
    await user.type(screen.getByLabelText('Pool return deadline'), '2026-09-01T08:00')
    await user.type(screen.getByLabelText('Fleet confirmation reason'), 'Invalid window proof')
    await user.click(screen.getByRole('button', { name: 'Propose window' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('must be after a valid start time')
    expect(calls).toHaveLength(0)
  })

  it('localizes persisted BSD statuses in Arabic', async () => {
    await i18n.changeLanguage('ar')
    const allocatedItem = { ...item, entitlement: { ...item.entitlement, status: 'Allocated', vehicleId: PREFERRED_ID, revision: 7 } }
    server.use(
      http.get('*/api/v1/entitlements/allocation-worklist', () => HttpResponse.json([allocatedItem])),
      http.get('*/api/v1/entitlements/:id/bsd-windows', () => HttpResponse.json([{
        id: '80000000-0000-4000-8000-000000000001', entitlementRequestId: ENTITLEMENT_ID,
        vehicleId: PREFERRED_ID, windowStart: '2026-09-01T08:00:00Z', windowEnd: '2026-09-03T08:00:00Z',
        status: 'Confirmed', reason: 'Fleet confirmed',
      }])),
    )
    renderPage()
    expect(await screen.findByText('حالة نافذة الإرجاع: مؤكدة')).toBeVisible()
    expect(screen.queryByText(/Confirmed/)).not.toBeInTheDocument()
  })
})