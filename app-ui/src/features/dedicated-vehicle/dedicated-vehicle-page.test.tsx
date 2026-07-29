import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n/config'
import { server } from '@/mocks/server'
import { DedicatedVehiclePage } from './dedicated-vehicle-page'

const PERSON_ID = '10000000-0000-4000-8000-000000000001'
const SCOPE_ID = '20000000-0000-4000-8000-000000000001'
const ENTITLEMENT_ID = '30000000-0000-4000-8000-000000000001'
const PREVIEW_ID = '40000000-0000-4000-8000-000000000001'
const POLICY_RULE_ID = '50000000-0000-4000-8000-000000000001'
const POLICY_VERSION_ID = '60000000-0000-4000-8000-000000000001'
const VEHICLE_ID = '70000000-0000-4000-8000-000000000001'

const context = {
  actor: { personId: PERSON_ID, fullName: 'Amina Khoury', grade: 'G12' },
  defaults: {
    requesterPersonId: PERSON_ID,
    requestedByPersonId: PERSON_ID,
    locationNodeId: SCOPE_ID,
    locationName: 'Khalifa Port Pool',
  },
  capabilities: {
    createDraft: { enabled: true, blockingReasons: [] },
    eligibilityPreview: { enabled: true, blockingReasons: [] },
    submit: { enabled: true, blockingReasons: [] },
    withDriver: { enabled: false, blockingReasons: ['entitlement-with-driver-not-approved'] },
    allocation: { enabled: false, blockingReasons: ['entitlement-allocation-exclusivity-pending'] },
  },
  dependencies: [
    { key: 'eligibilityPolicy', status: 'AVAILABLE' },
    { key: 'justificationCategories', status: 'AVAILABLE' },
    { key: 'consentTemplate', status: 'PENDING_APPROVAL' },
    { key: 'allocationExclusivity', status: 'PENDING_APPROVAL' },
  ],
}

function entitlement(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTITLEMENT_ID,
    requestType: 'LongTerm',
    driverOption: 'WithoutDriver',
    requesterPersonId: PERSON_ID,
    requestedByPersonId: PERSON_ID,
    assignedDriverPersonId: null,
    justificationCategory: 'operational-need',
    justificationText: 'Frequent travel between sites',
    vehicleCategoryCode: 'SUV',
    preferredVehicleId: null,
    preferenceNote: 'Toyota Fortuner if available',
    vehicleId: null,
    durationStart: '2026-08-01',
    durationEnd: '2026-12-31',
    locationNodeId: SCOPE_ID,
    businessUnit: null,
    costCentre: null,
    status: 'Draft',
    revision: 1,
    workflowInstanceId: null,
    policyVersion: null,
    eligibilityResult: null,
    approvalRouteProvenance: null,
    eligibilityPreviewId: null,
    consentSignedAtUtc: null,
    allocatedAtUtc: null,
    renewedFromEntitlementId: null,
    capabilities: { edit: true, submit: true, consent: false, cancel: true, renew: false, returnVehicle: false, blockingReasons: [] },
    createdAtUtc: '2026-07-25T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><DedicatedVehiclePage /></QueryClientProvider>)
}

async function chooseOption(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByLabelText(label))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function completeEligibility(user: ReturnType<typeof userEvent.setup>) {
  await chooseOption(user, 'Justification category reference', 'Operational requirement')
  await chooseOption(user, 'Requested vehicle class (optional)', 'SUV')
  await user.click(screen.getByRole('button', { name: 'Check eligibility' }))
  expect(await screen.findByText('Eligible for this request')).toBeVisible()
}

describe('DedicatedVehiclePage', () => {
  let createRequest: { body: Record<string, unknown>; key: string | null } | null
  let updateRequest: { body: Record<string, unknown>; key: string | null } | null

  beforeEach(async () => {
    await i18n.changeLanguage('en')
    createRequest = null
    updateRequest = null
    server.use(
      http.get('*/api/v1/entitlements/context', () => HttpResponse.json(context)),
      http.get('*/api/v1/entitlements', () => HttpResponse.json([])),
      http.get('*/api/v1/entitlements/justification-categories', () => HttpResponse.json([
        { id: '80000000-0000-4000-8000-000000000001', code: 'OPERATIONAL_REQUIREMENT', labelEn: 'Operational requirement', labelAr: 'متطلب تشغيلي', descriptionEn: null, descriptionAr: null, parentId: null, sortOrder: 10 },
      ])),
      http.get('*/api/v1/entitlements/vehicle-classes', () => HttpResponse.json([
        { id: '90000000-0000-4000-8000-000000000001', code: 'SUV', labelEn: 'SUV', labelAr: 'دفع رباعي', descriptionEn: null, descriptionAr: null, parentId: null, sortOrder: 20 },
      ])),
      http.get('*/api/v1/entitlements/consent-context', () => HttpResponse.json({
        available: false,
        blockingReasons: ['entitlement-consent-template-pending'],
        version: null,
        effectiveAtUtc: null,
        content: null,
      })),
      http.post('*/api/v1/entitlements/eligibility-preview', () => HttpResponse.json({
        previewId: PREVIEW_ID,
        decision: 'ALLOW',
        reasons: ['dedicated-manual-policy-eligible'],
        policyVersion: 'manual-dedicated-eligibility-v1',
        policyRuleId: POLICY_RULE_ID,
        policyVersionId: POLICY_VERSION_ID,
        requestedScopeNodeId: SCOPE_ID,
        resolvedScopeNodeId: SCOPE_ID,
        factFingerprint: 'abc123',
        evaluatedAtUtc: '2026-07-25T00:00:00.000Z',
        permittedVehicleClasses: ['SUV'],
        eligibleVehicleOptions: [{ vehicleId: VEHICLE_ID, plate: 'AUH-12345', makeCode: 'TOYOTA', modelCode: 'FORTUNER', vehicleClass: 'SUV', fuelTypeCode: 'PETROL', locationName: 'Khalifa Port Pool' }],
      })),
      http.post('*/api/v1/entitlements', async ({ request }) => {
        createRequest = {
          body: await request.json() as Record<string, unknown>,
          key: request.headers.get('idempotency-key'),
        }
        return HttpResponse.json(entitlement())
      }),
      http.patch('*/api/v1/entitlements/:id', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>
        updateRequest = { body, key: request.headers.get('idempotency-key') }
        return HttpResponse.json(entitlement({
          revision: 2,
          justificationText: body.justificationText,
          preferenceNote: body.preferenceNote,
        }))
      }),
    )
  })

  it('renders configured eligibility while keeping later gates and with-driver disabled', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Dedicated vehicle request' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'With driver' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Check eligibility' })).toBeVisible()
    expect(screen.getByLabelText('Preferred eligible vehicle (optional)')).toBeDisabled()
    expect(screen.getByText(/Preferences are not guaranteed/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Submit|Allocate/ })).not.toBeInTheDocument()
  })

  it('saves a principal-bound Draft with a preference note and idempotency key', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Dedicated vehicle request' })
    await completeEligibility(user)
    await user.type(screen.getByLabelText('Business justification'), 'Frequent travel between sites')
    await user.type(screen.getByLabelText('Preference note (optional)'), 'Toyota Fortuner if available')
    await chooseOption(user, 'Preferred eligible vehicle (optional)', 'AUH-12345 · TOYOTA FORTUNER')
    await user.click(screen.getByRole('button', { name: 'Save request Draft' }))

    expect(await screen.findByText('Request Draft saved')).toBeVisible()
    await waitFor(() => expect(createRequest).not.toBeNull())
    expect(createRequest?.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(createRequest?.body).toMatchObject({
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      locationNodeId: SCOPE_ID,
      preferenceNote: 'Toyota Fortuner if available',
      preferredVehicleId: VEHICLE_ID,
      eligibilityPreviewId: PREVIEW_ID,
    })
    expect(createRequest?.body).not.toHaveProperty('requesterPersonId')
    expect(createRequest?.body).not.toHaveProperty('vehicleId')
  })

  it('submits a preview-backed Draft with its current revision and a durable key', async () => {
    const submissions: Array<{ body: Record<string, unknown>; key: string | null }> = []
    let current = entitlement({ eligibilityPreviewId: PREVIEW_ID })
    server.use(
      http.get('*/api/v1/entitlements', () => HttpResponse.json([current])),
      http.post('*/api/v1/entitlements/:id/submit', async ({ request }) => {
        submissions.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
        current = entitlement({ status: 'PendingApproval', revision: 2, workflowInstanceId: POLICY_VERSION_ID, eligibilityPreviewId: PREVIEW_ID })
        return HttpResponse.json(current)
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My requests (1)' }))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    await waitFor(() => expect(submissions).toHaveLength(1))
    expect(submissions[0]?.body).toEqual({ expectedRevision: 1 })
    expect(submissions[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByText('The pinned approval route is in progress.')).toBeVisible()
  }, 10_000)

  it('uses server capability to cancel with revision, reason and a durable key', async () => {
    const cancellations: Array<{ body: Record<string, unknown>; key: string | null }> = []
    let current = entitlement({ status: 'PendingApproval', revision: 2, capabilities: { edit: false, submit: false, consent: false, cancel: true, renew: false, returnVehicle: false, blockingReasons: [] } })
    server.use(
      http.get('*/api/v1/entitlements', () => HttpResponse.json([current])),
      http.post('*/api/v1/entitlements/:id/cancel', async ({ request }) => {
        cancellations.push({ body: await request.json() as Record<string, unknown>, key: request.headers.get('idempotency-key') })
        current = entitlement({ ...current, status: 'Cancelled', revision: 3, capabilities: { edit: false, submit: false, consent: false, cancel: false, renew: false, returnVehicle: false, blockingReasons: [] } })
        return HttpResponse.json(current)
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My requests (1)' }))
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    await user.type(screen.getByLabelText('Cancellation reason'), 'No longer required')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(cancellations).toHaveLength(1))
    expect(cancellations[0]?.body).toEqual({ expectedRevision: 2, reason: 'No longer required' })
    expect(cancellations[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
  }, 10_000)

  it('reopens and revision-safely updates an owner Draft', async () => {
    server.use(http.get('*/api/v1/entitlements', () => HttpResponse.json([entitlement()])))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('tab', { name: 'My requests (1)' }))
    await user.click(screen.getByRole('button', { name: 'Edit Draft' }))
    expect(screen.getByRole('heading', { name: 'Edit request Draft' })).toBeVisible()
    const justification = screen.getByLabelText('Business justification')
    await user.clear(justification)
    await user.type(justification, 'Updated cross-site operational need')
    await user.click(screen.getByRole('button', { name: 'Check eligibility' }))
    expect(await screen.findByText('Eligible for this request')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Update request Draft' }))

    expect(await screen.findByText(/Eligibility must be run again/)).toBeVisible()
    await waitFor(() => expect(updateRequest).not.toBeNull())
    expect(updateRequest?.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(updateRequest?.body).toMatchObject({
      expectedRevision: 1,
      justificationText: 'Updated cross-site operational need',
      locationNodeId: SCOPE_ID,
    })
    expect(updateRequest?.body).not.toHaveProperty('requesterPersonId')
    expect(updateRequest?.body).not.toHaveProperty('vehicleId')
  })

  it('explains a stale revision and offers a safe refresh without losing edits', async () => {
    server.use(
      http.get('*/api/v1/entitlements', () => HttpResponse.json([entitlement()])),
      http.patch('*/api/v1/entitlements/:id', () => HttpResponse.json({
        title: 'Entitlement was changed by another request',
        reasons: ['entitlement-revision-conflict'],
      }, { status: 409 })),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'My requests (1)' }))
    await user.click(screen.getByRole('button', { name: 'Edit Draft' }))
    const justification = screen.getByLabelText('Business justification')
    await user.clear(justification)
    await user.type(justification, 'Keep this unsaved edit visible')
    await user.click(screen.getByRole('button', { name: 'Check eligibility' }))
    expect(await screen.findByText('Eligible for this request')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Update request Draft' }))

    expect(await screen.findByText(/changed before your update/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Refresh My requests' })).toBeVisible()
    expect(justification).toHaveValue('Keep this unsaved edit visible')
  })

  it('renders the gated four-step progression in Arabic', async () => {
    await i18n.changeLanguage('ar')
    renderPage()

    expect(await screen.findByRole('heading', { name: 'طلب مركبة مخصصة' })).toBeVisible()
    expect(screen.getByText('التفاصيل')).toBeVisible()
    expect(screen.getByText('الأهلية')).toBeVisible()
    expect(screen.getByText('التحقق مطلوب')).toBeVisible()
    expect(screen.getByRole('button', { name: 'حفظ مسودة الطلب' })).toBeVisible()
  })
})