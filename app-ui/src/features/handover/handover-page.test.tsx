import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { HandoverPage } from './handover-page'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ me: { fullName: 'Khalid Rashed' } }),
}))

const BOOKING_ID = '10000000-0000-4000-8000-000000000001'
const HANDOVER_ID = '20000000-0000-4000-8000-000000000001'
const VEHICLE_ID = '30000000-0000-4000-8000-000000000001'
const DRIVER_ID = '40000000-0000-4000-8000-000000000001'
const workItem = {
  bookingId: BOOKING_ID,
  bookingNumber: 'BK-2026-000401',
  handoverId: null,
  phase: 'AwaitingHandover',
  vehicleId: VEHICLE_ID,
  vehiclePlate: 'AD-401',
  driverPersonId: DRIVER_ID,
  driverName: 'Amina Khoury',
  pickupAtUtc: '2026-08-01T08:00:00Z',
  returnAtUtc: '2026-08-01T10:00:00Z',
  scopeName: 'Khalifa Port Pool',
}

function handoverResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: HANDOVER_ID, bookingId: BOOKING_ID, vehicleId: VEHICLE_ID, driverPersonId: DRIVER_ID,
    phase: 'Handover', handoverAtUtc: '2026-08-01T08:00:00Z', startOdometer: '1200', startFuelEighths: 7,
    gpsStatus: null, keyIssueRef: 'KEY-401', offlineCaptured: false, returnAtUtc: null, endOdometer: null,
    endFuelEighths: null, returnCondition: null, keyReturnRef: null, expectedFuelConsumedLitres: null,
    actualFuelConsumedLitres: null, fuelDeviationPercent: null, fuelDeviationFlagged: false,
    odometerConflict: false, lateReturn: false, damage: [], ...overrides,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><HandoverPage /></QueryClientProvider>)
}

async function completeChecks(user: ReturnType<typeof userEvent.setup>) {
  for (const label of [
    'Body panels and glass checked', 'Tyres and spare checked', 'Lights and indicators checked',
    'On-Vehicle assets checked', 'Cabin condition checked',
  ]) await user.click(screen.getByLabelText(label))
}

describe('HandoverPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(http.get('*/api/v1/handovers', () => HttpResponse.json([workItem])))
  })

  it('opens custody using the scoped worklist Booking and driver', async () => {
    const commands: Array<{ body: Record<string, unknown>; key: string | null }> = []
    server.use(http.post('*/api/v1/handovers', async ({ request }) => {
      commands.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
      return HttpResponse.json(handoverResponse())
    }))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Handover and return' })).toBeVisible()
    expect(screen.getAllByText('BK-2026-000401')).toHaveLength(2)
    await completeChecks(user)
    await user.type(screen.getByLabelText('Starting odometer (km)'), '1200')
    await user.type(screen.getByLabelText('Issued key reference'), 'KEY-401')
    await user.type(screen.getByLabelText('Type signer name exactly: Amina Khoury'), 'Amina Khoury')
    await user.click(screen.getByRole('button', { name: 'Hand over Vehicle' }))

    await waitFor(() => expect(commands).toHaveLength(1))
    expect(commands[0]?.body).toMatchObject({ bookingId: BOOKING_ID, employeePersonId: DRIVER_ID, startOdometer: 1200, keyIssueRef: 'KEY-401' })
    expect(commands[0]?.body.signatureRef).toMatch(/^typed-name:/)
    expect(commands[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByText('Vehicle custody opened')).toBeVisible()
  }, 10_000)

  it('returns Active custody through the persisted Handover and shows advisory review', async () => {
    const returns: Record<string, unknown>[] = []
    server.use(
      http.get('*/api/v1/handovers', () => HttpResponse.json([{ ...workItem, handoverId: HANDOVER_ID, phase: 'ActiveCustody' }])),
      http.post('*/api/v1/handovers/:id/return', async ({ request }) => {
        returns.push(await request.json() as Record<string, unknown>)
        return HttpResponse.json(handoverResponse({ phase: 'Returned', returnAtUtc: '2026-08-01T10:30:00Z', endOdometer: '1300', endFuelEighths: 2, returnCondition: 'Clean', keyReturnRef: 'KEY-401', fuelDeviationFlagged: true, lateReturn: true }))
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Active custody')
    await completeChecks(user)
    await user.type(screen.getByLabelText('Ending odometer (km)'), '1300')
    await user.type(screen.getByLabelText('Returned key reference'), 'KEY-401')
    await user.type(screen.getByLabelText('Return condition'), 'Clean')
    await user.type(screen.getByLabelText('Type signer name exactly: Khalid Rashed'), 'Khalid Rashed')
    await user.click(screen.getByRole('button', { name: 'Confirm return' }))

    await waitFor(() => expect(returns).toHaveLength(1))
    expect(returns[0]).toMatchObject({ endOdometer: 1300, returnCondition: 'Clean', keyReturnRef: 'KEY-401' })
    expect(await screen.findByText('Vehicle return completed')).toBeVisible()
    expect(screen.getByText(/Liability is not assigned automatically/)).toBeVisible()
  }, 10_000)

  it('blocks incomplete evidence before any custody command', async () => {
    let calls = 0
    server.use(http.post('*/api/v1/handovers', () => { calls += 1; return HttpResponse.json(handoverResponse()) }))
    renderPage()
    await screen.findByRole('heading', { name: 'Handover and return' })
    fireEvent.click(screen.getByRole('button', { name: 'Hand over Vehicle' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Complete every inspection')
    expect(calls).toBe(0)
  })

  it('retries an ambiguous open command with the same idempotency key', async () => {
    const keys: Array<string | null> = []
    server.use(http.post('*/api/v1/handovers', ({ request }) => {
      keys.push(request.headers.get('idempotency-key'))
      return keys.length === 1
        ? HttpResponse.json({ title: 'Temporary failure' }, { status: 500 })
        : HttpResponse.json(handoverResponse())
    }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Handover and return' })
    await completeChecks(user)
    await user.type(screen.getByLabelText('Starting odometer (km)'), '1200')
    await user.type(screen.getByLabelText('Issued key reference'), 'KEY-401')
    await user.type(screen.getByLabelText('Type signer name exactly: Amina Khoury'), 'Amina Khoury')
    await user.click(screen.getByRole('button', { name: 'Hand over Vehicle' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be completed')
    await user.click(screen.getByRole('button', { name: 'Hand over Vehicle' }))

    await waitFor(() => expect(keys).toHaveLength(2))
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])
    expect(await screen.findByText('Vehicle custody opened')).toBeVisible()
  }, 10_000)
})
