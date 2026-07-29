import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { LiveMapPage } from './live-map-page'

// MapLibre needs WebGL, which jsdom lacks — stub it; we assert the DOM list.
vi.mock('maplibre-gl', () => {
  const marker = {
    setLngLat: vi.fn().mockReturnThis(),
    setPopup: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    togglePopup: vi.fn(),
  }
  return {
    default: {
      Map: vi.fn(() => ({
        addControl: vi.fn(),
        on: vi.fn(),
        resize: vi.fn(),
        remove: vi.fn(),
        flyTo: vi.fn(),
      })),
      NavigationControl: vi.fn(),
      Marker: vi.fn(() => marker),
      Popup: vi.fn(() => ({ setText: vi.fn().mockReturnThis() })),
    },
  }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en/live-map']}>
        <Routes>
          <Route path=":lang/live-map" element={<LiveMapPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LiveMapPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    server.use(
      http.get('*/api/v1/telematics/live', () =>
        HttpResponse.json([
          {
            vehicleId: '10000000-0000-4000-8000-000000000001',
            plate: 'AD 40213',
            lat: 24.4539,
            lon: 54.3773,
            speed: 48,
            at: new Date().toISOString(),
            online: true,
          },
        ]),
      ),
    )
  })

  it('lists live scoped vehicles from telematics', async () => {
    renderPage()
    expect(
      await screen.findByRole('heading', { name: 'Live map' }),
    ).toBeVisible()
    expect(await screen.findByText('AD 40213')).toBeVisible()
    expect(screen.getByText('48 km/h')).toBeVisible()
  })
})
