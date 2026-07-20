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
  roles: [{ role: 'FleetManager', scopeNodeId: 's1', scopeName: 'Mina Zayed' }],
}

/** Signs in via the dev-login stand-in and mocks the backend `/me`. */
function authenticate() {
  setDevCredential('p1')
  server.use(http.get('/api/v1/me', () => HttpResponse.json(mePerson)))
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

  it('shows the coming-soon placeholder for unbuilt areas', async () => {
    authenticate()
    renderApp('/en/approvals')

    expect(await screen.findByText('Coming soon')).toBeVisible()
  })

  it('shows a 404 for unknown routes', async () => {
    authenticate()
    renderApp('/en/does-not-exist')

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
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
            roles: [{ role: 'FleetManager', scopeName: 'Mina Zayed' }],
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
