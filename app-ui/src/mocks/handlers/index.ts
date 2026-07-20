import { http, HttpResponse, type RequestHandler } from 'msw'
import { configHandlers } from './config'
import { identityHandlers } from './identity'
import { platformHandlers } from './platform'

/**
 * Default MSW handlers. The dev-users list defaults to empty so the login page
 * falls back to manual entry in tests; specific tests override via `server.use`.
 * Platform reads (`/me`, `/hierarchy`) back every authenticated screen so the
 * shell (Scope Switcher, role-driven nav) renders without unhandled requests.
 */
export const handlers: RequestHandler[] = [
  http.get('/api/v1/dev/users', () => HttpResponse.json([])),
  ...platformHandlers,
  ...configHandlers,
  ...identityHandlers,
]
