import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { HandoverRegisterPage } from './handover-register-page'

const OPEN_HANDOVER_ID = '10000000-0000-4000-8000-000000000001'
const RETURNED_HANDOVER_ID = '10000000-0000-4000-8000-000000000002'
const OPEN_BOOKING_ID = '20000000-0000-4000-8000-000000000001'
const RETURNED_BOOKING_ID = '20000000-0000-4000-8000-000000000002'
const VEHICLE_ID = '30000000-0000-4000-8000-000000000001'
const DRIVER_ID = '40000000-0000-4000-8000-000000000001'
const KEY_ID = '50000000-0000-4000-8000-000000000001'

const returnedChain = {
  schemaVersion: 2,
  handover: { schemaVersion: 2, id: RETURNED_HANDOVER_ID, bookingId: RETURNED_BOOKING_ID, vehicleId: VEHICLE_ID, driverPersonId: DRIVER_ID, phase: 'Returned', handoverAtUtc: '2026-07-28T13:00:00.000Z', startOdometer: '1000', startFuelEighths: 8, gpsStatus: 'MATCHED', keyIssueRef: 'KEY-01', offlineCaptured: false, returnAtUtc: '2026-07-28T17:42:00.000Z', endOdometer: '1124', endFuelEighths: 6, returnCondition: 'Good', keyReturnRef: 'KEY-01', expectedFuelConsumedLitres: null, actualFuelConsumedLitres: null, fuelDeviationPercent: null, fuelDeviationFlagged: false, odometerConflict: false, lateReturn: false, damage: [] },
  inspections: [{ capturePhase: 'Handover', definitionVersion: 1, code: 'body', verdict: 'Pass', note: null, evidenceRefs: [] }, { capturePhase: 'Return', definitionVersion: 1, code: 'body', verdict: 'Fail', note: 'New scratch', evidenceRefs: [KEY_ID] }],
  evidenceRefs: [KEY_ID], keys: [{ id: KEY_ID, vehicleId: VEHICLE_ID, handoverId: RETURNED_HANDOVER_ID, custodyState: 'Returned', keyRef: 'KEY-01', personId: DRIVER_ID, atUtc: '2026-07-28T17:42:00.000Z' }], amendments: [], chainRevision: 2, evidenceCompleteness: 'Complete',
}

const rows = [
  {
    handoverId: OPEN_HANDOVER_ID,
    bookingId: OPEN_BOOKING_ID,
    bookingNumber: 'BK-1198',
    driverName: 'S. Al Hammadi',
    vehicle: { id: VEHICLE_ID, plate: 'AD 77120', makeCode: 'TOYOTA', modelCode: 'COROLLA' },
    issuedAtUtc: '2026-07-29T08:10:00.000Z',
    returnedAtUtc: null,
    distanceKm: null,
    chargeSummary: { status: 'NOT_CONFIGURED', amount: null, currency: null, labels: [] },
    primaryStatus: 'ON_TRIP',
    signals: ['ON_TRIP'],
    capabilities: { view: true, editOpenCustody: true, returnVehicle: true },
    activityAtUtc: '2026-07-29T08:10:00.000Z',
  },
  {
    handoverId: RETURNED_HANDOVER_ID,
    bookingId: RETURNED_BOOKING_ID,
    bookingNumber: 'BK-1192',
    driverName: 'M. Rashed',
    vehicle: { id: VEHICLE_ID, plate: 'AD 90044', makeCode: 'KIA', modelCode: 'EV6' },
    issuedAtUtc: '2026-07-28T13:00:00.000Z',
    returnedAtUtc: '2026-07-28T17:42:00.000Z',
    distanceKm: '124.0',
    chargeSummary: { status: 'NOT_CONFIGURED', amount: null, currency: null, labels: [] },
    primaryStatus: 'ON_TIME',
    signals: ['ON_TIME'],
    capabilities: { view: true, editOpenCustody: false, returnVehicle: false },
    activityAtUtc: '2026-07-28T17:42:00.000Z',
  },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/en/handover']}>
        <Routes><Route path="/:lang/handover" element={<HandoverRegisterPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HandoverRegisterPage', () => {
  const queries: URLSearchParams[] = []

  beforeEach(async () => {
    queries.length = 0
    await i18n.changeLanguage('en')
    server.use(
      http.get('*/api/v1/handovers/register', ({ request }) => {
        queries.push(new URL(request.url).searchParams)
        return HttpResponse.json({ items: rows, page: 1, pageSize: 5, total: 6, totalPages: 2 })
      }),
      http.get('*/api/v1/handovers/work-items', () => HttpResponse.json([
        { bookingId: OPEN_BOOKING_ID, bookingNumber: 'BK-1198', handoverId: OPEN_HANDOVER_ID, phase: 'ActiveCustody', vehicleId: VEHICLE_ID, vehiclePlate: 'AD 77120', driverPersonId: DRIVER_ID, driverName: 'S. Al Hammadi', pickupAtUtc: '2026-07-29T08:00:00.000Z', returnAtUtc: '2026-07-29T10:00:00.000Z', scopeName: 'GS Pool' },
        { bookingId: '20000000-0000-4000-8000-000000000003', bookingNumber: 'BK-1204', handoverId: null, phase: 'AwaitingHandover', vehicleId: VEHICLE_ID, vehiclePlate: 'AD 88914', driverPersonId: DRIVER_ID, driverName: 'Amina Khoury', pickupAtUtc: '2026-07-30T08:00:00.000Z', returnAtUtc: '2026-07-30T10:00:00.000Z', scopeName: 'GS Pool' },
        { bookingId: '20000000-0000-4000-8000-000000000004', bookingNumber: 'BK-1205', handoverId: null, phase: 'AwaitingHandover', vehicleId: VEHICLE_ID, vehiclePlate: 'AD 88915', driverPersonId: DRIVER_ID, driverName: 'Omar Saleh', pickupAtUtc: '2026-07-30T11:00:00.000Z', returnAtUtc: '2026-07-30T13:00:00.000Z', scopeName: 'GS Pool' },
      ])),
      http.get('*/api/v1/handovers/:id/chain', () => HttpResponse.json(returnedChain)),
    )
  })

  it('renders screen 26 columns, actions and locked completed records', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Handover and return' })).toBeVisible()
    for (const column of ['Booking', 'Driver', 'Vehicle', 'Issued → returned', 'KM', 'Charges', 'Status']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeVisible()
    }
    expect(screen.getByRole('link', { name: 'New handover' })).toHaveAttribute('href', '#awaiting-handovers')
    expect(screen.getByRole('link', { name: 'Log return' })).toHaveAttribute('href', '#custody-register')
    expect(screen.getAllByRole('link', { name: 'Start handover' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Start handover' })[0]).toHaveAttribute('href', '/en/handover/new?bookingId=20000000-0000-4000-8000-000000000003')
    expect(screen.getAllByRole('link', { name: 'Start handover' })[1]).toHaveAttribute('href', '/en/handover/new?bookingId=20000000-0000-4000-8000-000000000004')
    const openRow = screen.getByText('BK-1198').closest('tr')!
    const returnedRow = screen.getByText('BK-1192').closest('tr')!
    expect(within(openRow).getByRole('link', { name: 'Edit' })).toBeVisible()
    expect(within(returnedRow).getByRole('button', { name: 'Locked' })).toBeDisabled()
  })

  it('drives filters and pagination through bounded URL/API parameters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('BK-1198')
    await user.click(screen.getByRole('button', { name: 'On trip' }))
    await waitFor(() => expect(queries.at(-1)?.get('filter')).toBe('OnTrip'))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(queries.at(-1)?.get('page')).toBe('2'))
    expect(queries.at(-1)?.get('pageSize')).toBe('5')
  })

  it('opens View in the custody drawer with vertical evidence tabs and a full-record link', async () => {
    const user = userEvent.setup()
    renderPage()
    const returnedRow = (await screen.findByText('BK-1192')).closest('tr')!
    expect(within(returnedRow).getByRole('button', { name: 'Locked' })).toBeDisabled()
    await user.click(within(returnedRow).getByRole('button', { name: 'View' }))
    expect(await screen.findByRole('dialog')).toBeVisible()
    const tabs = screen.getByRole('tablist', { name: 'Custody record sections' })
    for (const label of ['Overview', 'Handover evidence', 'Return evidence', 'Key custody', 'Receipt', 'Amendments']) expect(within(tabs).getByRole('tab', { name: label })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open full record' })).toHaveAttribute('href', `/en/handover/${RETURNED_HANDOVER_ID}`)
  })
})
