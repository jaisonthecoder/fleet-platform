import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProviders } from './providers/app-providers'
import { AuthProvider } from '@/features/auth/auth-context'
import { appRoutes } from './routing/router'
import { clearAuthCredential, setDevCredential } from '@/lib/auth-headers'
import { server } from '@/mocks/server'

const mePerson = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  personId: 'p1',
  fullName: 'Dev User',
  email: 'dev@example.com',
  grade: 'G12',
  employmentStatus: 'Active',
  homePoolNodeId: null,
  roles: [{ role: 'Employee', scopeNodeId: 's1', scopeName: 'Mina Zayed' }],
}

/** Signs in via the dev-login stand-in and mocks the backend `/me`. */
function authenticate(roles = mePerson.roles) {
  setDevCredential('p1')
  server.use(http.get('/api/v1/me', () => HttpResponse.json({ ...mePerson, roles })))
}

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath],
  })
  return render(
    <AppProviders>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppProviders>,
  )
}

afterEach(() => clearAuthCredential())

describe('Application shell (authenticated)', () => {
  it('redirects to the default locale and renders the home page', async () => {
    authenticate()
    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Fleet operations' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /Open design system/ }),
    ).toBeInTheDocument()
  })

  it('renders Arabic when the URL locale is /ar', async () => {
    authenticate()
    renderApp('/ar')

    expect(
      await screen.findByRole('heading', { name: 'عمليات الأسطول' }),
    ).toBeVisible()
  })

  it('renders live Fleet operations without calling audit-only reconciliation', async () => {
    let reconciliationCalls = 0
    authenticate([
      { role: 'FleetManager', scopeNodeId: 's1', scopeName: 'Mina Zayed' },
    ])
    server.use(
      http.get('/api/v1/operations/overview', () => HttpResponse.json({ scope: { id: 'all', label: 'All pools' }, generatedAt: '2026-07-28T12:00:00Z', summary: { availableVehicles: 8, totalVehicles: 10, bookingsToday: 3, activeBookings: 2, attentionCount: 1, complianceAttentionCount: 1, utilizationPercent: 20, utilizationChangePercent: 0 }, availability: { available: 8, inUse: 2, reserved: 0, unavailable: 0 }, attentionItems: [], upcomingBookings: [] })),
      http.get('/api/v1/dashboards/entitlement-inventory', () => HttpResponse.json({ allocated: 4, pendingApproval: 2, awaitingConsent: 1, returned: 3, expired: 0, bsdActive: 1, bsdConflict: 0, byCategory: [] })),
      http.get('/api/v1/entitlements/reconciliation', () => { reconciliationCalls += 1; return HttpResponse.json({ detectedAtUtc: '2026-07-28T12:00:00Z', findingCount: 0, findings: [], metrics: {}, unavailableMetrics: [] }) }),
    )
    renderApp('/en/operations')

    expect(await screen.findByRole('heading', { name: 'Operations dashboard' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Dedicated Vehicle health' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Dedicated reconciliation' })).not.toBeInTheDocument()
    expect(reconciliationCalls).toBe(0)
  })

  it('renders read-only reconciliation for SystemAdmin without Fleet mutation modules', async () => {
    authenticate([
      { role: 'SystemAdmin', scopeNodeId: 's1', scopeName: 'Mina Zayed' },
    ])
    server.use(
      http.get('/api/v1/operations/overview', () => HttpResponse.json({ scope: { id: 'all', label: 'All pools' }, generatedAt: '2026-07-28T12:00:00Z', summary: { availableVehicles: 8, totalVehicles: 10, bookingsToday: 3, activeBookings: 2, attentionCount: 1, complianceAttentionCount: 1, utilizationPercent: 20, utilizationChangePercent: 0 }, availability: { available: 8, inUse: 2, reserved: 0, unavailable: 0 }, attentionItems: [], upcomingBookings: [] })),
      http.get('/api/v1/dashboards/entitlement-inventory', () => HttpResponse.json({ allocated: 4, pendingApproval: 2, awaitingConsent: 1, returned: 3, expired: 0, bsdActive: 1, bsdConflict: 0, byCategory: [] })),
      http.get('/api/v1/entitlements/reconciliation', () => HttpResponse.json({ detectedAtUtc: '2026-07-28T12:00:00Z', findingCount: 1, findings: [{ reasonCode: 'allocated-entitlement-missing-active-allocation', entitlementRef: 'entitlement:opaque-1', vehicleRef: null, relatedRef: null, detectedAtUtc: '2026-07-28T12:00:00Z', recommendedOwner: 'FleetOperations' }], metrics: {}, unavailableMetrics: [] })),
    )
    renderApp('/en/operations')

    expect(await screen.findByRole('heading', { name: 'Dedicated reconciliation' })).toBeVisible()
    expect(screen.getByText('Allocated request has no active allocation')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Upcoming Bookings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Attention queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Dedicated allocation/i })).not.toBeInTheDocument()
  })

  it('shows a 404 for unknown routes', async () => {
    authenticate()
    renderApp('/en/does-not-exist')

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
  })

  it('denies an Employee direct access to Fleet Handover', async () => {
    authenticate()
    renderApp('/en/handover')

    expect(await screen.findByRole('heading', { name: 'Access restricted' })).toBeVisible()
  })
})

describe('Authentication gate', () => {
  it('redirects unauthenticated users to the login page', async () => {
    renderApp('/en')

    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
  })

  it('renders the login page with SSO and a dev fallback', async () => {
    renderApp('/en/login')

    expect(
      await screen.findByRole('button', { name: /organisation account/i }),
    ).toBeVisible()
    expect(
      await screen.findByRole('button', { name: 'Skip login' }),
    ).toBeVisible()
  })

  it('skips login to enter the app when no users are seeded', async () => {
    const user = userEvent.setup()
    renderApp('/en')

    await user.click(await screen.findByRole('button', { name: 'Skip login' }))

    expect(
      await screen.findByRole('heading', { name: 'Fleet operations' }),
    ).toBeVisible()
  })

  it('signs in via the dev picker and enters the app', async () => {
    server.use(
      http.get('/api/v1/dev/users', () =>
        HttpResponse.json([
          {
            personId: 'p1',
            fullName: 'Dev User',
            email: 'dev@example.com',
            grade: 'G12',
            roles: [{ role: 'Employee', scopeName: 'Mina Zayed' }],
          },
        ]),
      ),
      http.get('/api/v1/me', () => HttpResponse.json(mePerson)),
    )
    const user = userEvent.setup()
    renderApp('/en')

    await user.click(await screen.findByText('Dev User'))

    expect(
      await screen.findByRole('heading', { name: 'Fleet operations' }),
    ).toBeVisible()
  })
})
