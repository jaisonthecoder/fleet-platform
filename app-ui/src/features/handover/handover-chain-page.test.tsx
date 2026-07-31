import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { HandoverChainPage } from './handover-chain-page'

const HANDOVER_ID = '10000000-0000-4000-8000-000000000001'
const BOOKING_ID = '20000000-0000-4000-8000-000000000001'
const VEHICLE_ID = '30000000-0000-4000-8000-000000000001'
const DRIVER_ID = '40000000-0000-4000-8000-000000000001'
const ACTOR_ID = '50000000-0000-4000-8000-000000000001'
const KEY_ID = '60000000-0000-4000-8000-000000000001'
const AMENDMENT_ID = '70000000-0000-4000-8000-000000000001'
const baseHandover = { schemaVersion: 2, id: HANDOVER_ID, bookingId: BOOKING_ID, vehicleId: VEHICLE_ID, driverPersonId: DRIVER_ID, phase: 'Returned', handoverAtUtc: '2026-08-01T08:00:00.000Z', startOdometer: '1000', startFuelEighths: 8, gpsStatus: 'MATCHED', keyIssueRef: 'KEY-01', offlineCaptured: false, returnAtUtc: '2026-08-01T10:00:00.000Z', endOdometer: '1124', endFuelEighths: 6, returnCondition: 'Good', keyReturnRef: 'KEY-01', expectedFuelConsumedLitres: '12.40', actualFuelConsumedLitres: '14.00', fuelDeviationPercent: '12.90', fuelDeviationFlagged: true, odometerConflict: false, lateReturn: false, damage: [] }
const chain = { schemaVersion: 2, handover: baseHandover, inspections: [{ capturePhase: 'Handover', definitionVersion: 1, code: 'body', verdict: 'Pass', note: null, evidenceRefs: [] }, { capturePhase: 'Return', definitionVersion: 1, code: 'body', verdict: 'Fail', note: 'New scratch', evidenceRefs: [KEY_ID] }], evidenceRefs: [KEY_ID], keys: [{ id: KEY_ID, vehicleId: VEHICLE_ID, handoverId: HANDOVER_ID, custodyState: 'Returned', keyRef: 'KEY-01', personId: DRIVER_ID, atUtc: '2026-08-01T10:00:00.000Z' }], amendments: [], chainRevision: 2, evidenceCompleteness: 'Complete' }
const receipt = { schemaVersion: 2, handoverId: HANDOVER_ID, bookingId: BOOKING_ID, bookingNumber: 'BK-1204', bookingStatus: 'Completed', returnedAtUtc: '2026-08-01T10:00:00.000Z', releaseLocation: { nodeId: null, code: 'GS', name: 'GS Pool' }, returnLocation: { nodeId: null, code: 'GS', name: 'GS Pool' }, odometer: { start: '1000', end: '1124', distanceKm: '124.0', verdict: 'MATCHED' }, fuel: { startEighths: 8, endEighths: 6, deviationPercent: '12.90', verdict: 'ADVISORY' }, key: { outcome: 'Returned', reviewReference: null }, damage: { carriedCount: 0, newCount: 1, reviewRequired: true }, timing: { late: false }, evidenceRefs: [KEY_ID], evidenceCompleteness: 'Complete' }

function renderPage() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/en/handover/${HANDOVER_ID}`]}><Routes><Route path="/:lang/handover/:handoverId" element={<HandoverChainPage />} /></Routes></MemoryRouter></QueryClientProvider>) }

describe('HandoverChainPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); server.use(http.get('*/api/v1/handovers/:id/chain', () => HttpResponse.json(chain)), http.get('*/api/v1/handovers/:id/receipt', () => HttpResponse.json(receipt))) })

  it('renders locked issue/return evidence and the complete reconciliation receipt', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Issue → return chain' })).toBeVisible()
    expect(screen.getByText('Handover evidence')).toBeVisible()
    expect(screen.getByText('Return evidence')).toBeVisible()
    expect(screen.getByText(/New scratch/)).toBeVisible()
    expect(await screen.findByText('Completion receipt')).toBeVisible()
    expect(screen.getByText('1000 → 1124 (124.0 km)')).toBeVisible()
    expect(screen.getByText('8/8 → 6/8')).toBeVisible()
    expect(screen.getByText('0 carried · 1 new')).toBeVisible()
    expect(screen.getByText('No corrections have been appended.')).toBeVisible()
  })

  it('appends a correction using the current chain revision and a durable key', async () => {
    const requests: Array<{ body: Record<string, unknown>; key: string | null }> = []
    server.use(http.post('*/api/v1/handovers/:id/amendments', async ({ request }) => { requests.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') }); return HttpResponse.json({ schemaVersion: 2, id: AMENDMENT_ID, handoverId: HANDOVER_ID, revision: 1, reason: 'Correct return note', evidenceRefs: [], actorPersonId: ACTOR_ID, atUtc: '2026-08-01T11:00:00.000Z' }) }))
    const user = userEvent.setup(); renderPage(); await screen.findByText('No corrections have been appended.')
    await user.type(screen.getByLabelText('Reason for append-only correction'), 'Correct return note')
    await user.click(screen.getByRole('button', { name: 'Append amendment' }))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]?.body).toEqual({ expectedChainRevision: 2, reason: 'Correct return note', evidenceRefs: [] })
    expect(requests[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  })
})
