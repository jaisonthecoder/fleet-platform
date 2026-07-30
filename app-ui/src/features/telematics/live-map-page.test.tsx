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
  class FakeMap {
    addControl() {}
    on() {}
    resize() {}
    remove() {}
    flyTo() {}
  }
  class FakeMarker {
    setLngLat() {
      return this
    }
    setPopup() {
      return this
    }
    addTo() {
      return this
    }
    remove() {}
    togglePopup() {}
  }
  class FakePopup {
    setText() {
      return this
    }
  }
  class FakeNavigationControl {}
  return {
    default: {
      Map: FakeMap,
      Marker: FakeMarker,
      Popup: FakePopup,
      NavigationControl: FakeNavigationControl,
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
