import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { BookVehiclePage } from './book-vehicle-page'

const PERSON_ID = '10000000-0000-4000-8000-000000000001'
const SCOPE_ID = '20000000-0000-4000-8000-000000000001'
const VEHICLE_ID = '30000000-0000-4000-8000-000000000001'
const BOOKING_ID = '40000000-0000-4000-8000-000000000001'

const AVAILABLE_CONSENT_CONTEXT = {
  actor: { personId: PERSON_ID, fullName: 'Amina Khoury', email: 'amina@example.test', roles: ['Employee'] },
  modes: {
    self: { enabled: true, blockingReasons: [] },
    onBehalf: { enabled: false, blockingReasons: ['booking-on-behalf-scope-contract-pending'] },
    emergency: { enabled: false, blockingReasons: ['booking-emergency-not-enabled'] },
  },
  defaults: { requestedByPersonId: PERSON_ID, driverPersonId: PERSON_ID, scopeNodeId: SCOPE_ID, scopeName: 'Khalifa Port Pool' },
  consent: {
    status: 'AVAILABLE',
    version: 'booking-consent-test-v1',
    contentHash: 'test-content-hash',
    effectiveAtUtc: '2026-01-01T00:00:00.000Z',
    content: { en: 'TEST ONLY - Booking driver consent fixture.', ar: 'للاختبار فقط.' },
  },
  dependencies: [
    { key: 'vehicleAvailability', status: 'AVAILABLE' },
    { key: 'eligibility', status: 'AVAILABLE' },
    { key: 'consentTemplate', status: 'AVAILABLE' },
  ],
}

/** Creates a valid Booking API projection for interaction tests. */
function bookingResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID, bookingNumber: null, vehicleId: VEHICLE_ID,
    driverPersonId: PERSON_ID, requestedByPersonId: PERSON_ID, status: 'Draft',
    pickupAtUtc: '2999-01-01T08:00:00.000Z', returnAtUtc: '2999-01-01T10:00:00.000Z',
    reservationStartUtc: '2999-01-01T08:00:00.000Z', reservationEndUtc: '2999-01-01T10:15:00.000Z',
    bufferMinutes: 15, destination: 'Khalifa Port Gate 4', purpose: null, passengerCount: 1,
    consentRecordId: null, workflowInstanceId: null, policyVersion: 'buffer-v1',
    createdAtUtc: '2026-07-24T00:00:00.000Z',
    ...overrides,
  }
}

/** Renders the live Booking page with query and routing providers. */
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en/booking']}>
        <BookVehiclePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BookVehiclePage', () => {
  let createRequest: { body: Record<string, unknown>; idempotencyKey: string | null } | null
  let availabilityRequests: number
  let lastSeatingCapacity: string | null

  beforeEach(async () => {
    await i18n.changeLanguage('en')
    createRequest = null
    availabilityRequests = 0
    lastSeatingCapacity = null
    server.use(
      http.get('*/api/v1/bookings/context', () => HttpResponse.json({
        actor: { personId: PERSON_ID, fullName: 'Amina Khoury', email: 'amina@example.test', roles: ['Employee'] },
        modes: {
          self: { enabled: true, blockingReasons: [] },
          onBehalf: { enabled: false, blockingReasons: ['booking-on-behalf-scope-contract-pending'] },
          emergency: { enabled: false, blockingReasons: ['booking-emergency-not-enabled'] },
        },
        defaults: { requestedByPersonId: PERSON_ID, driverPersonId: PERSON_ID, scopeNodeId: SCOPE_ID, scopeName: 'Khalifa Port Pool' },
        consent: { status: 'PENDING_APPROVAL', version: null, contentHash: null, effectiveAtUtc: null, content: null },
        dependencies: [
          { key: 'vehicleAvailability', status: 'AVAILABLE' },
          { key: 'eligibility', status: 'AVAILABLE' },
          { key: 'consentTemplate', status: 'PENDING_APPROVAL' },
        ],
      })),
      http.get('*/api/v1/bookings', () => HttpResponse.json([])),
      http.get('*/api/v1/bookings/:id/events', () => HttpResponse.json([])),
      http.get('*/api/v1/vehicles/available', ({ request }) => {
        availabilityRequests += 1
        lastSeatingCapacity = new URL(request.url).searchParams.get('seatingCapacity')
        return HttpResponse.json([{
          vehicleId: VEHICLE_ID,
          plate: 'LIVE-21',
          makeCode: 'TOYOTA',
          modelCode: 'LAND_CRUISER',
          bodyTypeCode: 'SUV',
          useCategoryCode: 'POOL',
          seatingCapacity: 7,
          fuelTypeCode: 'HYBRID',
          locationName: 'Khalifa Port Pool',
        }])
      }),
      http.get('*/api/v1/vehicles/availability-timeline', ({ request }) => {
        const url = new URL(request.url)
        const startAtUtc = url.searchParams.get('startAtUtc')!
        const endAtUtc = url.searchParams.get('endAtUtc')!
        return HttpResponse.json({
          startAtUtc,
          endAtUtc,
          rows: [{
            vehicleId: VEHICLE_ID,
            plate: 'LIVE-21',
            makeCode: 'TOYOTA',
            modelCode: 'LAND_CRUISER',
            bodyTypeCode: 'SUV',
            seatingCapacity: 7,
            fuelTypeCode: 'HYBRID',
            locationName: 'Khalifa Port Pool',
            segments: [{ startAtUtc, endAtUtc, state: 'OPEN' }],
          }],
        })
      }),
      http.post('*/api/v1/bookings', async ({ request }) => {
        createRequest = {
          body: await request.json() as Record<string, unknown>,
          idempotencyKey: request.headers.get('idempotency-key'),
        }
        return HttpResponse.json({
          id: BOOKING_ID,
          bookingNumber: null,
          vehicleId: VEHICLE_ID,
          driverPersonId: PERSON_ID,
          requestedByPersonId: PERSON_ID,
          status: 'Draft',
          pickupAtUtc: '2999-01-01T08:00:00.000Z',
          returnAtUtc: '2999-01-01T10:00:00.000Z',
          reservationStartUtc: '2999-01-01T08:00:00.000Z',
          reservationEndUtc: '2999-01-01T10:15:00.000Z',
          bufferMinutes: 15,
          destination: 'Khalifa Port Gate 4',
          purpose: null,
          passengerCount: 1,
          consentRecordId: null,
          workflowInstanceId: null,
          policyVersion: 'buffer-v1',
          createdAtUtc: '2026-07-24T00:00:00.000Z',
        })
      }),
    )
  })

  it('renders scoped timeline and Vehicle data from live endpoints', async () => {
    renderPage()

    expect(await screen.findByRole('tab', { name: 'Book a vehicle' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Available vehicles' })).toBeVisible()
    expect(screen.getByText('LIVE-21')).toBeVisible()
    expect(screen.getByText('Available vehicles')).toBeVisible()
    expect(screen.getAllByText('Khalifa Port Pool')).toHaveLength(2)
    expect(screen.queryByText('AD 40213')).not.toBeInTheDocument()
  })

  it('filters live results by governed vehicle class', async () => {
    server.use(http.get('*/api/v1/vehicles/available', () => HttpResponse.json([
      { vehicleId: VEHICLE_ID, plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', useCategoryCode: 'POOL', seatingCapacity: 7, fuelTypeCode: 'HYBRID', locationName: 'Khalifa Port Pool' },
      { vehicleId: '30000000-0000-4000-8000-000000000002', plate: 'LIVE-22', makeCode: 'TOYOTA', modelCode: 'HIACE', bodyTypeCode: 'VAN', useCategoryCode: 'POOL', seatingCapacity: 12, fuelTypeCode: 'DIESEL', locationName: 'Khalifa Port Pool' },
    ])))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('LIVE-22')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'SUV 1' }))

    expect(screen.getByText('LIVE-21')).toBeVisible()
    expect(screen.queryByText('LIVE-22')).not.toBeInTheDocument()
    expect(screen.getByText('1 matching your trip')).toBeVisible()
  })

  it('validates the trip before Select without posting an invalid Draft', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })

    await user.click(screen.getByRole('button', { name: 'Select' }))

    expect(await screen.findByText('Enter a destination.')).toBeVisible()
    expect(createRequest).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Digital consent' })).not.toBeInTheDocument()
  })

  it('opens persisted owner Booking details from My bookings', async () => {
    server.use(http.get('*/api/v1/bookings', () => HttpResponse.json([{
      ...bookingResponse({ bookingNumber: 'BK-2026-000321', status: 'Approved', revision: 3 }),
      vehicle: { plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', fuelTypeCode: 'HYBRID', seatingCapacity: 7 },
      scopeName: 'Khalifa Port Pool',
      capabilities: { consent: false, modify: false, extend: true, cancel: true, returnVehicle: false },
    }])))
    server.use(http.get('*/api/v1/bookings/:id/events', () => HttpResponse.json([{
      id: '80000000-0000-4000-8000-000000000001', bookingId: BOOKING_ID,
      eventType: 'SubmittedForApproval', detail: null, actorRef: PERSON_ID,
      atUtc: '2026-07-24T10:00:00.000Z',
    }])))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: 'My bookings (1)' }))
    await user.click(screen.getByRole('button', { name: /TOYOTA LAND CRUISER/ }))

    const detail = screen.getByRole('dialog', { name: 'Booking details' })
    expect(detail).toBeVisible()
    expect(within(detail).getByText('BK-2026-000321')).toBeVisible()
    expect(within(detail).getByText('Record revision')).toBeVisible()
    expect(within(detail).getByText('3')).toBeVisible()
    expect(within(detail).getByRole('button', { name: 'Extend Booking' })).toBeVisible()
    expect(within(detail).getByRole('button', { name: 'Cancel Booking' })).toBeVisible()
    expect(await within(detail).findByText('Submitted for approval')).toBeVisible()
  })

  it('cancels an authorized owner Booking with revision, reason, and durable key', async () => {
    const commands: Array<{ body: Record<string, unknown>; key: string | null }> = []
    const owned = {
      ...bookingResponse({ bookingNumber: null, status: 'Draft', revision: 2 }),
      vehicle: { plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', fuelTypeCode: 'HYBRID', seatingCapacity: 7 },
      scopeName: 'Khalifa Port Pool',
      capabilities: { consent: true, modify: true, extend: false, cancel: true, returnVehicle: false },
    }
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json([owned])),
      http.post('*/api/v1/bookings/:id/cancel', async ({ request }) => {
        commands.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
        return HttpResponse.json(bookingResponse({ status: 'Cancelled', revision: 3 }))
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My bookings (1)' }))
    await user.click(screen.getByRole('button', { name: /TOYOTA LAND CRUISER/ }))
    await user.type(screen.getByLabelText('Cancellation reason'), 'Trip no longer required')
    await user.click(screen.getByRole('button', { name: 'Cancel Booking' }))

    await waitFor(() => expect(commands).toHaveLength(1))
    expect(commands[0]?.body).toEqual({ expectedRevision: 2, reason: 'Trip no longer required' })
    expect(commands[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('does not offer cancellation while physical custody is Active', async () => {
    server.use(http.get('*/api/v1/bookings', () => HttpResponse.json([{
      ...bookingResponse({ bookingNumber: 'BK-2026-000654', status: 'Active', revision: 4 }),
      vehicle: { plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', fuelTypeCode: 'HYBRID', seatingCapacity: 7 },
      scopeName: 'Khalifa Port Pool',
      capabilities: { consent: false, modify: false, extend: true, cancel: false, returnVehicle: true },
    }])))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My bookings (1)' }))
    await user.click(screen.getByRole('tab', { name: 'Active (1)' }))
    await user.click(screen.getByRole('button', { name: /TOYOTA LAND CRUISER/ }))

    const detail = screen.getByRole('dialog', { name: 'Booking details' })
    expect(within(detail).queryByRole('button', { name: 'Cancel Booking' })).not.toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Extend Booking' })).toBeVisible()
  })

  it('modifies a Draft with revision-bound UTC window and durable key', async () => {
    const commands: Array<{ body: Record<string, unknown>; key: string | null }> = []
    const owned = {
      ...bookingResponse({ status: 'Draft', revision: 2 }),
      vehicle: { plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', fuelTypeCode: 'HYBRID', seatingCapacity: 7 },
      scopeName: 'Khalifa Port Pool',
      capabilities: { consent: true, modify: true, extend: false, cancel: true, returnVehicle: false },
    }
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json([owned])),
      http.patch('*/api/v1/bookings/:id', async ({ request }) => {
        commands.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
        return HttpResponse.json(bookingResponse({ status: 'Draft', revision: 3 }))
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My bookings (1)' }))
    await user.click(screen.getByRole('button', { name: /TOYOTA LAND CRUISER/ }))
    await user.clear(screen.getByLabelText('New return'))
    await user.type(screen.getByLabelText('New return'), '2999-01-01T15:00')
    await user.click(screen.getByRole('button', { name: 'Update Booking' }))

    await waitFor(() => expect(commands).toHaveLength(1))
    expect(commands[0]?.body).toMatchObject({ expectedRevision: 2 })
    expect(String(commands[0]?.body.returnAtUtc)).toContain('2999-01-01T')
    expect(commands[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  }, 10_000)

  it('shows a privacy-safe stale message when an extension conflicts', async () => {
    const owned = {
      ...bookingResponse({ bookingNumber: 'BK-2026-000777', status: 'Approved', revision: 4 }),
      vehicle: { plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', fuelTypeCode: 'HYBRID', seatingCapacity: 7 },
      scopeName: 'Khalifa Port Pool',
      capabilities: { consent: false, modify: false, extend: true, cancel: true, returnVehicle: false },
    }
    server.use(
      http.get('*/api/v1/bookings', () => HttpResponse.json([owned])),
      http.post('*/api/v1/bookings/:id/extend', () => HttpResponse.json({
        title: 'Vehicle is no longer available', reasons: ['booking-vehicle-unavailable'],
      }, { status: 409 })),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My bookings (1)' }))
    await user.click(screen.getByRole('button', { name: /TOYOTA LAND CRUISER/ }))
    await user.clear(screen.getByLabelText('Extended return time'))
    await user.type(screen.getByLabelText('Extended return time'), '2999-01-01T15:00')
    await user.click(screen.getByRole('button', { name: 'Extend Booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This Booking changed before the action completed')
    expect(screen.queryByText(/other employee|other booking|requester/i)).not.toBeInTheDocument()
  }, 10_000)

  it('resumes governed consent for an existing Draft from My bookings', async () => {
    server.use(
      http.get('*/api/v1/bookings/context', () => HttpResponse.json(AVAILABLE_CONSENT_CONTEXT)),
      http.get('*/api/v1/bookings', () => HttpResponse.json([{
        ...bookingResponse({ status: 'Draft', revision: 5 }),
        vehicle: { plate: 'LIVE-21', makeCode: 'TOYOTA', modelCode: 'LAND_CRUISER', bodyTypeCode: 'SUV', fuelTypeCode: 'HYBRID', seatingCapacity: 7 },
        scopeName: 'Khalifa Port Pool',
        capabilities: { consent: true, modify: true, extend: false, cancel: true, returnVehicle: false },
      }])),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My bookings (1)' }))
    await user.click(screen.getByRole('button', { name: /TOYOTA LAND CRUISER/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue consent and submission' }))

    expect(await screen.findByRole('heading', { name: 'Digital consent' })).toBeVisible()
    expect(screen.getByText('TEST ONLY - Booking driver consent fixture.')).toBeVisible()
  }, 10_000)

  it('creates a self Draft from Select and opens the Consent stage', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })

    await user.type(screen.getByLabelText('Destination'), 'Khalifa Port Gate 4')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(createRequest).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Select' }))
    expect(await screen.findByText('Consent is not available yet')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Digital consent' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Sign & confirm booking' })).not.toBeInTheDocument()
    await waitFor(() => expect(createRequest).not.toBeNull())
    expect(createRequest?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(createRequest?.body).toMatchObject({
      vehicleId: VEHICLE_ID,
      requestedByPersonId: PERSON_ID,
      driverPersonId: PERSON_ID,
      destination: 'Khalifa Port Gate 4',
      passengerCount: 1,
    })
    expect(lastSeatingCapacity).toBe('1')
  })

  it('signs the server template, submits once, and confirms persisted state', async () => {
    const consentRequests: Array<{ body: Record<string, unknown>; key: string | null }> = []
    const submitKeys: Array<string | null> = []
    server.use(
      http.get('*/api/v1/bookings/context', () => HttpResponse.json(AVAILABLE_CONSENT_CONTEXT)),
      http.post('*/api/v1/bookings/:id/consent', async ({ request }) => {
        consentRequests.push({
          body: await request.json() as Record<string, unknown>,
          key: request.headers.get('idempotency-key'),
        })
        return HttpResponse.json({
          id: BOOKING_ID, bookingNumber: 'BK-2026-000001', vehicleId: VEHICLE_ID,
          driverPersonId: PERSON_ID, requestedByPersonId: PERSON_ID, status: 'PendingApproval',
          pickupAtUtc: '2999-01-01T08:00:00.000Z', returnAtUtc: '2999-01-01T10:00:00.000Z',
          reservationStartUtc: '2999-01-01T08:00:00.000Z', reservationEndUtc: '2999-01-01T10:15:00.000Z',
          bufferMinutes: 15, destination: 'Khalifa Port Gate 4', purpose: null, passengerCount: 1,
          consentRecordId: '50000000-0000-4000-8000-000000000001', workflowInstanceId: null,
          policyVersion: 'buffer-v1', createdAtUtc: '2026-07-24T00:00:00.000Z',
        })
      }),
      http.post('*/api/v1/bookings/:id/submit', ({ request }) => {
        submitKeys.push(request.headers.get('idempotency-key'))
        return HttpResponse.json({
          id: BOOKING_ID, bookingNumber: 'BK-2026-000001', vehicleId: VEHICLE_ID,
          driverPersonId: PERSON_ID, requestedByPersonId: PERSON_ID, status: 'PendingApproval',
          pickupAtUtc: '2999-01-01T08:00:00.000Z', returnAtUtc: '2999-01-01T10:00:00.000Z',
          reservationStartUtc: '2999-01-01T08:00:00.000Z', reservationEndUtc: '2999-01-01T10:15:00.000Z',
          bufferMinutes: 15, destination: 'Khalifa Port Gate 4', purpose: null, passengerCount: 1,
          consentRecordId: '50000000-0000-4000-8000-000000000001',
          workflowInstanceId: '60000000-0000-4000-8000-000000000001',
          policyVersion: 'buffer-v1', createdAtUtc: '2026-07-24T00:00:00.000Z',
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })
    await user.type(screen.getByLabelText('Destination'), 'Khalifa Port Gate 4')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('button', { name: 'Select' }))

    expect(await screen.findByText('TEST ONLY - Booking driver consent fixture.')).toBeVisible()
    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByLabelText('Type your full name to sign'), 'Amina Khoury')
    await user.click(screen.getByRole('button', { name: 'Sign & confirm booking' }))

    expect(await screen.findByText('BK-2026-000001')).toBeVisible()
    expect(screen.getByText('Pending approval')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    expect(screen.getByText('TOYOTA LAND CRUISER')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add to calendar' })).toBeVisible()
    expect(consentRequests).toHaveLength(1)
    expect(consentRequests[0]?.body).toMatchObject({
      driverPersonId: PERSON_ID,
      consentDocumentVersion: 'booking-consent-test-v1',
      signatureRef: 'ui-typed-name-agreement',
    })
    expect(consentRequests[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(submitKeys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(submitKeys[0]).not.toBe(consentRequests[0]?.key)
  })

  it('reconciles committed consent after a 500 and resumes submit with the stable key', async () => {
    const submitKeys: Array<string | null> = []
    server.use(
      http.get('*/api/v1/bookings/context', () => HttpResponse.json(AVAILABLE_CONSENT_CONTEXT)),
      http.post('*/api/v1/bookings/:id/consent', () => HttpResponse.json(
        { title: 'Ambiguous upstream response' },
        { status: 500 },
      )),
      http.get('*/api/v1/bookings/:id', () => HttpResponse.json(bookingResponse({
        bookingNumber: 'BK-2026-000042',
        status: 'PendingApproval',
        consentRecordId: '50000000-0000-4000-8000-000000000001',
      }))),
      http.post('*/api/v1/bookings/:id/submit', ({ request }) => {
        submitKeys.push(request.headers.get('idempotency-key'))
        return HttpResponse.json(bookingResponse({
          bookingNumber: 'BK-2026-000042',
          status: 'PendingApproval',
          consentRecordId: '50000000-0000-4000-8000-000000000001',
          workflowInstanceId: '60000000-0000-4000-8000-000000000001',
        }))
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })
    await user.type(screen.getByLabelText('Destination'), 'Khalifa Port Gate 4')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('button', { name: 'Select' }))
    await screen.findByText('TEST ONLY - Booking driver consent fixture.')
    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByLabelText('Type your full name to sign'), 'Amina Khoury')
    await user.click(screen.getByRole('button', { name: 'Sign & confirm booking' }))

    expect(await screen.findByText('BK-2026-000042')).toBeVisible()
    expect(submitKeys).toHaveLength(1)
    expect(submitKeys[0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('preserves the search and refreshes availability after a stale 409', async () => {
    server.use(
      http.post('*/api/v1/bookings', () => HttpResponse.json(
        { title: 'Vehicle not bookable', reasons: ['booking-vehicle-not-bookable'] },
        { status: 409 },
      )),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })

    await user.type(screen.getByLabelText('Destination'), 'Khalifa Port Gate 4')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('button', { name: 'Select' }))

    expect(await screen.findByText(/This vehicle changed after your search/)).toBeVisible()
    expect(screen.getByLabelText('Destination')).toHaveValue('Khalifa Port Gate 4')
    await waitFor(() => expect(availabilityRequests).toBeGreaterThan(1))
  })

  it('explains a capacity conflict without refetching an unchanged result', async () => {
    server.use(
      http.post('*/api/v1/bookings', () => HttpResponse.json(
        { title: 'Vehicle capacity is insufficient', reasons: ['booking-vehicle-capacity-insufficient'] },
        { status: 409 },
      )),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })
    await user.type(screen.getByLabelText('Destination'), 'Khalifa Port Gate 4')
    const addPassenger = screen.getByRole('button', { name: 'Add passenger' })
    for (let count = 1; count < 7; count += 1) await user.click(addPassenger)
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await screen.findByText('7 seats')
    const requestsBeforeDraft = availabilityRequests
    await user.click(screen.getByRole('button', { name: 'Select' }))

    expect(await screen.findByText(/cannot accommodate 7 passengers/)).toBeVisible()
    expect(availabilityRequests).toBe(requestsBeforeDraft)
  })

  it('retries a failed Draft with the same idempotency key', async () => {
    const keys: Array<string | null> = []
    server.use(
      http.post('*/api/v1/bookings', ({ request }) => {
        keys.push(request.headers.get('idempotency-key'))
        return HttpResponse.json({ title: 'Gateway timeout' }, { status: 504 })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Available vehicles' })
    await user.type(screen.getByLabelText('Destination'), 'Khalifa Port Gate 4')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('button', { name: 'Select' }))
    await screen.findByText(/Draft could not be saved/)
    await user.click(screen.getByRole('button', { name: 'Select' }))

    await waitFor(() => expect(keys).toHaveLength(2))
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])
  })
})