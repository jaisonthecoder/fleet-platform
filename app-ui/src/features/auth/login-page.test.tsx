import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from './auth-context'
import { LoginPage } from './login-page'
import { clearAuthCredential } from '@/lib/auth-headers'
import { server } from '@/mocks/server'

function renderLogin() {
  const router = createMemoryRouter(
    [{ path: '/:lang/login', element: <LoginPage /> }],
    { initialEntries: ['/en/login'] },
  )
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

afterEach(() => clearAuthCredential())

describe('LoginPage', () => {
  it('offers Skip login when there are no seeded users', async () => {
    renderLogin()

    expect(
      await screen.findByRole('button', { name: 'Skip login' }),
    ).toBeVisible()
  })

  it('lists seeded dev users with their roles', async () => {
    server.use(
      http.get('/api/v1/dev/users', () =>
        HttpResponse.json([
          {
            personId: 'p1',
            fullName: 'Aisha Rahman',
            email: 'aisha@example.ae',
            grade: 'G3',
            roles: [{ role: 'Employee', scopeName: 'Khalifa Port Pool' }],
          },
        ]),
      ),
    )
    renderLogin()

    expect(await screen.findByText('Aisha Rahman')).toBeVisible()
    expect(screen.getByText('Employee')).toBeVisible()
  })
})
