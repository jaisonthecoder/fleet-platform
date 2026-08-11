import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { ProfilePage } from './profile-page'

const CREDENTIALS = {
  licence: {
    number: 'L-123',
    expiry: '2030-01-01',
    status: 'Valid',
    source: 'seed',
    verified: true,
  },
  emiratesId: {
    number: null,
    expiry: null,
    status: 'Missing',
    source: null,
    verified: false,
  },
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en/profile']}>
        <Routes>
          <Route path=":lang/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProfilePage credentials', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(
      http.get('*/api/v1/me/credentials', () => HttpResponse.json(CREDENTIALS)),
    )
  })

  it('renders licence and Emirates ID status', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'My profile' }),
    ).toBeVisible()
    expect(await screen.findByText('L-123')).toBeVisible()
    expect(screen.getByText('Valid')).toBeVisible()
    expect(screen.getByText('Missing')).toBeVisible()
  })

  it('captures a self-service credential update', async () => {
    const user = userEvent.setup()
    let patchBody: Record<string, unknown> | undefined
    server.use(
      http.patch('*/api/v1/me/credentials', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          ...CREDENTIALS,
          emiratesId: {
            number: '784-1990-1',
            expiry: '2029-05-01',
            status: 'Valid',
            source: 'manual',
            verified: false,
          },
        })
      }),
    )
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Update' }))

    await user.type(screen.getByLabelText('Emirates ID number'), '784-1990-1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(patchBody).toBeTruthy())
    expect(patchBody?.emiratesId).toBe('784-1990-1')
    // The refreshed record now shows the captured value + Unverified badge.
    expect(await screen.findByText('784-1990-1')).toBeVisible()
    expect(screen.getByText('Unverified — pending review')).toBeVisible()
  })
})
