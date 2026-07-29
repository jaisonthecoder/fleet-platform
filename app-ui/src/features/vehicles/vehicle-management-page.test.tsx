import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { VehicleManagementPage } from './vehicle-management-page'

const vehicle = {
  id: '10000000-0000-4000-8000-000000000001',
  plate: 'AD 40213',
  chassisVin: 'VIN-40213',
  bodyTypeCode: 'SUV',
  makeCode: 'TOYOTA',
  modelCode: 'LAND_CRUISER',
  useCategoryCode: 'PASSENGER',
  fuelTypeCode: 'PETROL',
  fuelEfficiencyKmpl: '8.90',
  ownership: 'Owned',
  purchaseOrLeaseStart: null,
  leaseEnd: null,
  purchaseCost: null,
  monthlyRental: null,
  currency: 'AED',
  vendorId: null,
  leaseContractId: null,
  leaseContractRef: null,
  lifecycleStatus: 'Active',
  operationalStatus: null,
  lastConfirmedOdometer: '61204.0',
  bookingPoolFlag: true,
  assignmentModel: 'Pool',
  assignedDriverPersonId: null,
  fuelCardNumber: null,
  salikTag: null,
  darbTag: null,
  trackerVendor: 'Simulator',
  trackerSerial: 'SIM-40213',
  gpsStatus: 'Online',
  mulkiyaNumber: 'M-40213',
  mulkiyaExpiry: '2027-11-02',
  insuranceProvider: 'Provider',
  insurancePolicyNumber: 'P-40213',
  insuranceExpiry: '2027-08-05',
  hierarchyNodeId: '50000000-0000-4000-8000-000000000001',
  hierarchyNodeName: 'GS Pool — Mina Zayed',
  hierarchyNodeNameAr: 'مجمع GS — ميناء زايد',
}

/** Renders the registry with production query and locale routing providers. */
function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en/vehicles']}>
        <Routes>
          <Route path=":lang/vehicles" element={<VehicleManagementPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VehicleManagementPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(
      http.get('*/api/v1/vehicles/summary', () =>
        HttpResponse.json({
          total: 1,
          active: 1,
          inUse: 0,
          maintenance: 0,
          blocked: 0,
        }),
      ),
      http.get('*/api/v1/vehicles', ({ request }) => {
        const url = new URL(request.url)
        const search = url.searchParams.get('search')?.toLowerCase()
        const haystack =
          `${vehicle.plate} ${vehicle.makeCode} ${vehicle.modelCode}`.toLowerCase()
        const items = search && !haystack.includes(search) ? [] : [vehicle]
        return HttpResponse.json({
          items,
          total: items.length,
          page: 1,
          pageSize: 25,
        })
      }),
      http.get('*/api/v1/vehicles/:id/device', () =>
        HttpResponse.json({ device: null }),
      ),
      http.get('*/api/v1/devices', () => HttpResponse.json([])),
    )
  })

  it('renders the live scoped registry and child actions', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Vehicle management' }),
    ).toBeVisible()
    expect(await screen.findByText('TOYOTA LAND_CRUISER')).toBeVisible()
    expect(screen.getByText('GS Pool — Mina Zayed')).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Onboard vehicle/ }),
    ).toHaveAttribute('href', '/en/vehicles/onboard')
  })

  it('filters the scoped registry without refetching', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('TOYOTA LAND_CRUISER')

    await user.type(
      screen.getByRole('textbox', { name: /Search plate/ }),
      'missing',
    )

    expect(await screen.findByText('No vehicles found')).toBeVisible()
  })

  it('opens the detail drawer when a row is activated', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))

    expect(await screen.findByRole('tab', { name: 'Edit' })).toBeVisible()
    // Details tab shows the immutable VIN, which is not in the table.
    expect(screen.getByText('VIN-40213')).toBeVisible()
  })

  it('patches a mutable attribute from the edit tab', async () => {
    const user = userEvent.setup()
    let patchBody: Record<string, unknown> | undefined
    server.use(
      http.patch('*/api/v1/vehicles/:id', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...vehicle, insuranceProvider: 'Watania' })
      }),
    )
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))
    await user.click(await screen.findByRole('tab', { name: 'Edit' }))

    const provider = screen.getByLabelText('Insurance provider')
    await user.clear(provider)
    await user.type(provider, 'Watania')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(patchBody).toBeTruthy())
    expect(patchBody?.insuranceProvider).toBe('Watania')
  })

  it('records a guarded lifecycle transition', async () => {
    const user = userEvent.setup()
    let transitionBody: Record<string, unknown> | undefined
    server.use(
      http.post('*/api/v1/vehicles/:id/transition', async ({ request }) => {
        transitionBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          ...vehicle,
          lifecycleStatus: 'UnderMaintenance',
        })
      }),
    )
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))
    await user.click(await screen.findByRole('tab', { name: 'Lifecycle' }))
    await user.click(screen.getByRole('button', { name: 'Under maintenance' }))
    await user.click(
      screen.getByRole('button', { name: /Confirm move to Under maintenance/ }),
    )

    await waitFor(() => expect(transitionBody).toBeTruthy())
    expect(transitionBody?.toStatus).toBe('UnderMaintenance')
  })

  it('shows live KM and fuel from the telematics endpoint', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/v1/vehicles/:id/telemetry/live', () =>
        HttpResponse.json({
          vehicleId: vehicle.id,
          lat: 24.4539,
          lon: 54.3773,
          speed: 60,
          ignition: true,
          odometer: 100500,
          fuelLevel: 0.75,
          dtcCodes: [],
          at: new Date().toISOString(),
          online: true,
        }),
      ),
    )
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))
    await user.click(await screen.findByRole('tab', { name: 'Telematics' }))

    expect(await screen.findByText('100,500 km')).toBeVisible()
    expect(screen.getByText('75%')).toBeVisible()
  })

  it('shows the paired GPS device in the telematics tab', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/v1/vehicles/:id/telemetry/live', () =>
        HttpResponse.json({
          vehicleId: vehicle.id,
          lat: null,
          lon: null,
          speed: null,
          ignition: null,
          odometer: null,
          fuelLevel: null,
          dtcCodes: [],
          at: null,
          online: false,
        }),
      ),
      http.get('*/api/v1/vehicles/:id/device', () =>
        HttpResponse.json({
          device: {
            deviceId: '20000000-0000-4000-8000-000000000001',
            identifier: 'IMEI-9988',
            model: 'Teltonika FMB920',
            firmware: '1.2.3',
            sim: '971500000000',
            status: 'Active',
            lastHealthAt: null,
            pairedSince: '2026-01-01T00:00:00.000Z',
          },
        }),
      ),
    )
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))
    await user.click(await screen.findByRole('tab', { name: 'Telematics' }))

    expect(await screen.findByText('IMEI-9988')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Unpair' })).toBeVisible()
  })

  it('lists documents in the documents tab', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/v1/vehicles/:id/documents', () =>
        HttpResponse.json([
          {
            id: '30000000-0000-4000-8000-000000000001',
            docTypeCode: 'INSURANCE',
            issueDate: '2026-01-01',
            expiryDate: '2027-01-01',
            blobRef: null,
            version: 2,
            createdAtUtc: new Date().toISOString(),
          },
        ]),
      ),
    )
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))
    await user.click(await screen.findByRole('tab', { name: 'Documents' }))

    expect(await screen.findByText('Document vault')).toBeVisible()
    expect(screen.getByText('v2')).toBeVisible()
  })

  it('shows alerts and trips in the activity tab', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/v1/vehicles/:id/alerts', () =>
        HttpResponse.json([
          {
            id: '40000000-0000-4000-8000-000000000001',
            vehicleId: vehicle.id,
            deviceId: null,
            alertType: 'Unplug',
            detail: 'Harness disconnected',
            raisedAt: new Date().toISOString(),
            acknowledgedAt: null,
          },
        ]),
      ),
      http.get('*/api/v1/vehicles/:id/trips', () =>
        HttpResponse.json([
          {
            id: '50000000-0000-4000-8000-000000000001',
            vehicleId: vehicle.id,
            deviceId: null,
            bookingId: null,
            driverPersonId: null,
            attributionBasis: 'unattributed',
            startedAt: new Date().toISOString(),
            endedAt: null,
            distanceKm: '42.0',
            startOdometer: null,
            endOdometer: null,
          },
        ]),
      ),
    )
    renderPage()
    await user.click(await screen.findByText('TOYOTA LAND_CRUISER'))
    await user.click(await screen.findByRole('tab', { name: 'Activity' }))

    expect(await screen.findByText('Device unplugged')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeVisible()
  })
})
