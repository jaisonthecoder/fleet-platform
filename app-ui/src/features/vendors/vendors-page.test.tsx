import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { resetVendorApprovalMocks } from '@/mocks/handlers/vendors'
import { VendorsPage } from './vendors-page'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    me: {
      roles: [{ role: 'Procurement', scopeNodeId: 'scope-1' }],
    },
  }),
}))

/** Renders the vendors admin page with production query + locale routing. */
function renderPage(language = 'en') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/${language}/admin/vendors-leases`]}>
        <Routes>
          <Route path=":lang/admin/vendors-leases" element={<VendorsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VendorsPage', () => {
  beforeEach(async () => {
    resetVendorApprovalMocks()
    await i18n.changeLanguage('en')
  })

  it('renders the vendor master list with status and source', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Vendors & lease contracts' }),
    ).toBeVisible()
    expect(await screen.findByText('AutoLease Gulf')).toBeVisible()
    expect(screen.getByText('Gulf Fleet Leasing')).toBeVisible()
    expect(screen.getAllByText(/Unverified/).length).toBeGreaterThan(0)
  })

  it('opens a vendor detail drawer with lifecycle actions and lease contracts', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('AutoLease Gulf'))

    // Active vendor → suspend/retire actions and its lease contract are shown.
    expect(await screen.findByRole('button', { name: 'Suspend' })).toBeVisible()
    expect(await screen.findByText('LC-2023-0441')).toBeVisible()
    expect(
      await screen.findByText('No Vendor documents recorded yet.'),
    ).toBeVisible()
  })

  it('opens the onboarding drawer', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Onboard vendor/ }),
    )
    expect(await screen.findByLabelText('Legal name')).toBeVisible()
  })

  it('protects unsaved Vendor onboarding fields when the wizard closes', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Onboard vendor/ }),
    )
    await user.type(screen.getByLabelText('Legal name'), 'Unsaved Vendor')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(confirm).toHaveBeenCalledWith(
      'Discard changes that have not been saved to the Vendor draft?',
    )
    expect(screen.getByLabelText('Legal name')).toBeVisible()
    confirm.mockRestore()
  })

  it('persists and submits the five-step Vendor onboarding journey', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('button', { name: /Onboard vendor/ }),
    )
    await user.type(screen.getByLabelText('Legal name'), 'Harbour Fleet LLC')
    expect(await screen.findByText('Lessor')).toBeVisible()
    await user.type(screen.getByLabelText('Primary contact'), 'M. Harbour')
    await user.type(
      screen.getByLabelText('Contact email'),
      'fleet@harbour.test',
    )
    await user.type(screen.getByLabelText('Contact phone'), '+971500000001')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Compliance and commercial documents',
      }),
    ).toBeVisible()
    await user.type(screen.getByLabelText('Payment terms'), 'Net 45')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Default terms and service levels',
      }),
    ).toBeVisible()
    await user.type(
      screen.getByLabelText('Early-termination penalty'),
      'AED 4,500 per vehicle',
    )
    await user.type(
      screen.getByLabelText('Renewal options'),
      '2 x 12 months',
    )
    await user.type(
      screen.getByLabelText('Escalation clause'),
      'CPI capped at 3%',
    )
    await user.type(
      screen.getByLabelText('Replacement clause'),
      'Like-for-like within 48h',
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findAllByText('Future integration')).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Review and submit to Procurement',
      }),
    ).toBeVisible()
    expect(
      screen.getByText(/activation remains blocked/i),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Submit for approval' }),
    )
    expect(
      screen.queryByRole('heading', {
        name: 'Review and submit to Procurement',
      }),
    ).not.toBeInTheDocument()
  }, 10_000)

  it('creates a lease contract for an active vendor', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('AutoLease Gulf'))
    await user.click(await screen.findByRole('button', { name: 'Add lease' }))
    await user.type(screen.getByLabelText('Contract reference'), 'LC-NEW-2026')
    await user.type(screen.getByLabelText('Monthly amount'), '4200')
    await user.click(
      screen.getByRole('button', { name: 'Create lease contract' }),
    )

    expect(await screen.findByText('LC-NEW-2026')).toBeVisible()
  })

  it('renders the lease action and form in Arabic', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('ar')
    renderPage('ar')

    await user.click(await screen.findByText('AutoLease Gulf'))
    await user.click(await screen.findByRole('button', { name: 'إضافة عقد' }))
    expect(await screen.findByLabelText('مرجع العقد')).toBeVisible()
    expect(screen.getByLabelText('القيمة الشهرية')).toBeVisible()
  })

  it('shows integrated vendors as read-only without mutation actions', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('Future Fusion Supplier'))
    expect(
      await screen.findByText(/mastered by an external provider/),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Suspend' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add lease' }),
    ).not.toBeInTheDocument()
  })

  it('creates and confirms a manually captured Vendor document', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('AutoLease Gulf'))
    await user.click(
      await screen.findByRole('button', { name: 'Add document' }),
    )
    await user.click(screen.getByRole('combobox', { name: 'Document type' }))
    await user.click(
      await screen.findByRole('option', { name: 'Trade licence' }),
    )
    await user.type(screen.getByLabelText('Document reference'), 'CN-DOC-100')
    await user.type(
      screen.getByLabelText('Storage object key'),
      'vendor-documents/autolease/trade-licence.pdf',
    )
    await user.click(
      screen.getByRole('button', { name: 'Save for confirmation' }),
    )

    expect(await screen.findByText('Pending confirmation')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirm evidence' }))
    expect(await screen.findByText('Confirmed')).toBeVisible()
  })

  it('renders Vendor document controls in Arabic', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('ar')
    renderPage('ar')

    await user.click(await screen.findByText('AutoLease Gulf'))
    expect(await screen.findByText('مستندات الامتثال')).toBeVisible()
    expect(screen.getByText(/يبقى OCR تكاملاً مستقبلياً/)).toBeVisible()
  })

  it('shows a retryable error when Vendor documents cannot be loaded', async () => {
    server.use(
      http.get('/api/v1/vendors/:id/documents', () =>
        HttpResponse.json(
          { title: 'Document store unavailable' },
          { status: 503 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('AutoLease Gulf'))
    expect(
      await screen.findByText('Vendor documents could not be loaded.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  it('shows Procurement decision evidence and approves a complete Vendor', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('tab', { name: 'Approval inbox' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Harbour Mobility Services' }),
    ).toBeVisible()
    expect(screen.getByText('vendor-maker-01')).toBeVisible()
    expect(screen.getByText('vendor-submitter-02')).toBeVisible()
    expect(screen.getByText('3 confirmed documents')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    expect(
      await screen.findByText('No Vendor approvals pending'),
    ).toBeVisible()
  })

  it('requires and records a Vendor request-change reason', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      await screen.findByRole('tab', { name: 'Approval inbox' }),
    )
    const requestChange = await screen.findByRole('button', {
      name: 'Request changes',
    })
    expect(requestChange).toBeDisabled()
    await user.type(
      screen.getByLabelText('Decision reason'),
      'Provide current insurance evidence.',
    )
    expect(requestChange).toBeEnabled()
    await user.click(requestChange)
    expect(
      await screen.findByText('No Vendor approvals pending'),
    ).toBeVisible()
  })

  it('renders the Vendor approval inbox in Arabic', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('ar')
    renderPage('ar')

    await user.click(
      await screen.findByRole('tab', { name: 'صندوق الاعتمادات' }),
    )
    expect(await screen.findByText('أدلة القرار')).toBeVisible()
    expect(screen.getByLabelText('سبب القرار')).toBeVisible()
    expect(screen.getByRole('button', { name: 'طلب تغييرات' })).toBeDisabled()
  })
})
