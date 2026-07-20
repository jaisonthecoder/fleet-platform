import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from '../mocks/server'

// Lazy route chunks can take >1s to resolve on their first (cold) dynamic import
// under vitest's transform pipeline; give async queries headroom so the first
// screen render is not a false timeout (real Vite/prod imports are fast).
configure({ asyncUtilTimeout: 5000 })

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub

// jsdom lacks the pointer-capture + scroll APIs Radix primitives (dropdown /
// select / etc.) call on open; stub them so overlay menus can open in tests.
const elementProto = globalThis.Element?.prototype as
  | (Element & Record<string, unknown>)
  | undefined
if (elementProto) {
  elementProto.hasPointerCapture ??= () => false
  elementProto.setPointerCapture ??= () => {}
  elementProto.releasePointerCapture ??= () => {}
  elementProto.scrollIntoView ??= () => {}
}
