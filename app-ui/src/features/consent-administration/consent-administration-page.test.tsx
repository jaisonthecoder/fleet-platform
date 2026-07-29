import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { ConsentAdministrationPage } from './consent-administration-page'

vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => ({ me: { roles: [{ role: 'SystemAdmin' }] } }) }))
const ID = '10000000-0000-4000-8000-000000000001'
const draft = {
  id: ID, domain: 'Booking', version: 'booking-policy-2026-v1', status: 'Draft', contentHash: 'a'.repeat(64),
  effectiveAtUtc: '2026-08-01T00:00:00Z', content: { en: 'I accept the governed fleet Booking responsibilities for this trip.', ar: 'أوافق على مسؤوليات حجز الأسطول المنظمة لهذه الرحلة الحالية.' },
  createdByPersonId: '20000000-0000-4000-8000-000000000001', activatedByPersonId: null, activatedAtUtc: null, retiredAtUtc: null, createdAtUtc: '2026-07-29T00:00:00Z',
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><ConsentAdministrationPage /></QueryClientProvider>)
}

describe('ConsentAdministrationPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })

  it('creates bilingual immutable wording and explicitly activates it', async () => {
    const creates: Record<string, unknown>[] = []
    let active = false
    server.use(
      http.get('*/api/v1/admin/consents', () => HttpResponse.json(active ? [{ ...draft, status: 'Active', activatedByPersonId: draft.createdByPersonId, activatedAtUtc: '2026-07-29T01:00:00Z' }] : creates.length ? [draft] : [])),
      http.post('*/api/v1/admin/consents', async ({ request }) => { creates.push(await request.json() as Record<string, unknown>); return HttpResponse.json(draft) }),
      http.post('*/api/v1/admin/consents/:id/activate', () => { active = true; return HttpResponse.json({ ...draft, status: 'Active', activatedByPersonId: draft.createdByPersonId, activatedAtUtc: '2026-07-29T01:00:00Z' }) }),
    )
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Consent management' })).toBeVisible()
    await user.type(screen.getByLabelText('Version'), 'booking-policy-2026-v1')
    await user.type(screen.getByLabelText('Effective date and time'), '2026-08-01T00:00')
    await user.type(screen.getByLabelText('English wording'), draft.content.en)
    await user.type(screen.getByLabelText('Arabic wording'), draft.content.ar)
    await user.click(screen.getByRole('button', { name: 'Save immutable Draft' }))
    await waitFor(() => expect(creates).toHaveLength(1))
    expect(creates[0]).toMatchObject({ domain: 'Booking', version: 'booking-policy-2026-v1', content: draft.content })
    await user.click(await screen.findByRole('button', { name: 'Activate as approved' }))
    expect(await screen.findByText('Active')).toBeVisible()
  }, 10_000)

  it('renders Arabic governance copy in RTL-aware fields', async () => {
    await i18n.changeLanguage('ar')
    server.use(http.get('*/api/v1/admin/consents', () => HttpResponse.json([])))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'إدارة الموافقات' })).toBeVisible()
    expect(screen.getByLabelText('الصياغة العربية')).toHaveAttribute('dir', 'rtl')
  })
})
