import { http, HttpResponse } from 'msw'
import type {
  LeaseContract,
  Vendor,
  VendorDocument,
  VendorOnboarding,
  VendorOnboardingProfile,
  VendorApprovalWorkItem,
} from '@/features/vendors/vendors.contract'

/** Sample vendors backing the vendors admin screen + tests. */
export const mockVendors: Vendor[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    legalName: 'AutoLease Gulf',
    tradeName: null,
    tradeLicenceNumber: 'CN-0102',
    tradeLicenceEmirate: 'Abu Dhabi',
    taxRegistrationNumber: '100482977300003',
    categoryCode: 'LESSOR',
    primaryContactName: 'R. Haddad',
    primaryContactRole: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    paymentTerms: 'Net 45',
    currency: 'AED',
    bankIbanMasked: 'AE****************3456',
    sourceMode: 'Manual',
    sourceSystem: null,
    externalRef: null,
    dataQualityFlag: false,
    vendorPortalEnabled: true,
    status: 'Active',
    notes: null,
    createdAtUtc: '2026-07-20T08:00:00.000Z',
    updatedAtUtc: '2026-07-20T08:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    legalName: 'Gulf Fleet Leasing',
    tradeName: null,
    tradeLicenceNumber: 'CN-0145',
    tradeLicenceEmirate: 'Dubai',
    taxRegistrationNumber: null,
    categoryCode: 'LESSOR',
    primaryContactName: null,
    primaryContactRole: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    paymentTerms: null,
    currency: 'AED',
    bankIbanMasked: null,
    sourceMode: 'Manual',
    sourceSystem: null,
    externalRef: null,
    dataQualityFlag: true,
    vendorPortalEnabled: false,
    status: 'Draft',
    notes: null,
    createdAtUtc: '2026-07-21T08:00:00.000Z',
    updatedAtUtc: '2026-07-21T08:00:00.000Z',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    legalName: 'Future Fusion Supplier',
    tradeName: null,
    tradeLicenceNumber: 'CN-EXT-01',
    tradeLicenceEmirate: 'Abu Dhabi',
    taxRegistrationNumber: null,
    categoryCode: 'LESSOR',
    primaryContactName: null,
    primaryContactRole: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    paymentTerms: null,
    currency: 'AED',
    bankIbanMasked: null,
    sourceMode: 'Integrated',
    sourceSystem: 'Oracle Fusion',
    externalRef: 'SUP-FUTURE-01',
    dataQualityFlag: true,
    vendorPortalEnabled: false,
    status: 'Active',
    notes: null,
    createdAtUtc: '2026-07-22T08:00:00.000Z',
    updatedAtUtc: '2026-07-22T08:00:00.000Z',
  },
]

const mockLeases: LeaseContract[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    vendorId: '11111111-1111-4111-8111-111111111111',
    contractRef: 'LC-2023-0441',
    scopeNodeId: null,
    monthlyAmount: '302000.00',
    currency: 'AED',
    startDate: '2023-01-01',
    endDate: '2027-09-30',
    offHireNoticeDays: '30',
    earlyTerminationPenalty: 'AED 4,500/vehicle',
    renewalOptions: '2 × 12-month',
    escalationClause: 'CPI-linked · max 3% p.a.',
    replacementClause: 'Like-for-like within 48h',
    alertLadder: '90/60/30',
    status: 'Active',
    renewedIntoContractRef: null,
    createdAtUtc: '2026-07-20T08:00:00.000Z',
    updatedAtUtc: '2026-07-20T08:00:00.000Z',
  },
]

const mockDocuments: VendorDocument[] = []
const mockProfiles = new Map<string, VendorOnboardingProfile>()
const pendingApprovalVendor: Vendor = {
  ...mockVendors[1],
  id: '77777777-7777-4777-8777-777777777777',
  legalName: 'Harbour Mobility Services',
  primaryContactName: 'M. Harbour',
  primaryContactEmail: 'fleet@harbour.test',
  primaryContactPhone: '+971500000001',
  paymentTerms: 'Net 45',
  status: 'PendingApproval',
}
mockVendors.push(pendingApprovalVendor)
const initialApprovalWorkItem: VendorApprovalWorkItem = {
    vendorId: pendingApprovalVendor.id,
    legalName: pendingApprovalVendor.legalName,
    categoryCode: pendingApprovalVendor.categoryCode,
    sourceMode: 'Manual',
    makerActorRef: 'vendor-maker-01',
    submitterActorRef: 'vendor-submitter-02',
    submittedAtUtc: '2026-07-23T10:00:00.000Z',
    assignedAuthorityRole: 'Procurement',
    updatedAtUtc: '2026-07-23T10:00:00.000Z',
    completeness: {
      completed: 16,
      required: 16,
      missing: [],
      canSubmit: false,
      canActivate: true,
    },
    documentRequirements: [
      {
        code: 'TRADE_LICENCE',
        required: true,
        tracksExpiry: true,
        state: 'Confirmed',
      },
      {
        code: 'LIABILITY_INSURANCE',
        required: true,
        tracksExpiry: true,
        state: 'Confirmed',
      },
      {
        code: 'MASTER_SERVICE_AGREEMENT',
        required: true,
        tracksExpiry: false,
        state: 'Confirmed',
      },
    ],
    changeSummary: {
      identityUpdated: true,
      termsCaptured: true,
      confirmedDocuments: 3,
      pendingDocuments: 0,
    },
}
let mockApprovalWorkItems: VendorApprovalWorkItem[] = [
  structuredClone(initialApprovalWorkItem),
]

/** Resets mutable Vendor approval fixtures between component tests. */
export function resetVendorApprovalMocks(): void {
  pendingApprovalVendor.status = 'PendingApproval'
  mockApprovalWorkItems = [structuredClone(initialApprovalWorkItem)]
}

/** Builds the same persisted onboarding shape exposed by the backend. */
function onboardingFor(vendor: Vendor): VendorOnboarding {
  const profile = mockProfiles.get(vendor.id) ?? null
  const requiredCodes = [
    'TRADE_LICENCE',
    'LIABILITY_INSURANCE',
    'MASTER_SERVICE_AGREEMENT',
  ]
  const documentRequirements = [
    ...requiredCodes,
    'SIGNATORY_AUTHORIZATION',
  ].map((code) => ({
    code,
    required: requiredCodes.includes(code),
    tracksExpiry: ['TRADE_LICENCE', 'LIABILITY_INSURANCE'].includes(code),
    state: (mockDocuments.some(
      (document) =>
        document.vendorId === vendor.id &&
        document.documentTypeCode === code &&
        document.status === 'Confirmed',
    )
      ? 'Confirmed'
      : mockDocuments.some(
            (document) =>
              document.vendorId === vendor.id &&
              document.documentTypeCode === code &&
              document.status === 'PendingConfirmation',
          )
        ? 'PendingConfirmation'
        : 'Missing') as VendorOnboarding['documentRequirements'][number]['state'],
  }))
  const values = [
    vendor.legalName,
    vendor.categoryCode,
    vendor.primaryContactName,
    vendor.primaryContactEmail,
    vendor.primaryContactPhone,
    vendor.paymentTerms,
    profile?.standardOffHireNoticeDays,
    profile?.earlyTerminationPenalty,
    profile?.renewalOptions,
    profile?.escalationClause,
    profile?.replacementClause,
    profile?.alertLadder,
    profile?.accessMode,
    ...documentRequirements
      .filter((document) => document.required)
      .map((document) => document.state === 'Confirmed'),
  ]
  const completed = values.filter(Boolean).length
  return {
    vendor,
    profile,
    documentRequirements,
    completeness: {
      completed,
      required: values.length,
      missing: values
        .map((value, index) => (value ? null : `field.${index}`))
        .filter((value): value is string => Boolean(value)),
      canSubmit: vendor.status === 'Draft',
      canActivate: completed === values.length,
    },
  }
}

export const vendorHandlers = [
  http.get('/api/v1/vendors', () => HttpResponse.json(mockVendors)),
  http.get('/api/v1/vendors/approvals', () =>
    HttpResponse.json(mockApprovalWorkItems),
  ),
  http.get('/api/v1/vendors/:id/lease-contracts', ({ params }) =>
    HttpResponse.json(mockLeases.filter((l) => l.vendorId === params.id)),
  ),
  http.post(
    '/api/v1/vendors/:id/lease-contracts',
    async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const created: LeaseContract = {
        id: '44444444-4444-4444-8444-444444444444',
        vendorId: String(params.id),
        contractRef: String(body.contractRef),
        scopeNodeId: null,
        monthlyAmount: body.monthlyAmount ? String(body.monthlyAmount) : null,
        currency: String(body.currency ?? 'AED'),
        startDate: body.startDate ? String(body.startDate) : null,
        endDate: body.endDate ? String(body.endDate) : null,
        offHireNoticeDays: body.offHireNoticeDays
          ? String(body.offHireNoticeDays)
          : null,
        earlyTerminationPenalty: body.earlyTerminationPenalty
          ? String(body.earlyTerminationPenalty)
          : null,
        renewalOptions: body.renewalOptions
          ? String(body.renewalOptions)
          : null,
        escalationClause: body.escalationClause
          ? String(body.escalationClause)
          : null,
        replacementClause: body.replacementClause
          ? String(body.replacementClause)
          : null,
        alertLadder: String(body.alertLadder ?? '90/60/30'),
        status: 'Active',
        renewedIntoContractRef: null,
        createdAtUtc: '2026-07-23T08:00:00.000Z',
        updatedAtUtc: '2026-07-23T08:00:00.000Z',
      }
      mockLeases.push(created)
      return HttpResponse.json(created, { status: 201 })
    },
  ),
  http.get('/api/v1/vendors/:id/documents', ({ params }) =>
    HttpResponse.json(
      mockDocuments.filter((document) => document.vendorId === params.id),
    ),
  ),
  http.get('/api/v1/vendors/:id/onboarding', ({ params }) => {
    const vendor = mockVendors.find((item) => item.id === params.id)
    return vendor
      ? HttpResponse.json(onboardingFor(vendor))
      : HttpResponse.json({ title: 'Unknown vendor' }, { status: 404 })
  }),
  http.patch('/api/v1/vendors/:id/onboarding', async ({ params, request }) => {
    const vendor = mockVendors.find((item) => item.id === params.id)
    if (!vendor)
      return HttpResponse.json({ title: 'Unknown vendor' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    const existing = mockProfiles.get(vendor.id)
    mockProfiles.set(vendor.id, {
      vendorId: vendor.id,
      standardOffHireNoticeDays:
        body.standardOffHireNoticeDays === null
          ? null
          : Number(
              body.standardOffHireNoticeDays ??
                existing?.standardOffHireNoticeDays ??
                30,
            ),
      earlyTerminationPenalty: String(
        body.earlyTerminationPenalty ??
          existing?.earlyTerminationPenalty ??
          '',
      ),
      renewalOptions: String(
        body.renewalOptions ?? existing?.renewalOptions ?? '',
      ),
      escalationClause: String(
        body.escalationClause ?? existing?.escalationClause ?? '',
      ),
      replacementClause: String(
        body.replacementClause ?? existing?.replacementClause ?? '',
      ),
      alertLadder: String(body.alertLadder ?? existing?.alertLadder ?? ''),
      accessMode: 'ManualInternal',
      updatedAtUtc: '2026-07-24T08:00:00.000Z',
    })
    return HttpResponse.json(onboardingFor(vendor))
  }),
  http.post('/api/v1/vendors/:id/documents', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const created: VendorDocument = {
      id: '66666666-6666-4666-8666-666666666666',
      vendorId: String(params.id),
      documentTypeCode: String(body.documentTypeCode),
      version: 1,
      documentReference: body.documentReference
        ? String(body.documentReference)
        : null,
      blobRef: String(body.blobRef),
      issueDate: body.issueDate ? String(body.issueDate) : null,
      expiryDate: body.expiryDate ? String(body.expiryDate) : null,
      status: 'PendingConfirmation',
      extractedMetadata: null,
      confirmedMetadata: null,
      confirmedByActorRef: null,
      confirmedAtUtc: null,
      supersededById: null,
      createdByActorRef: 'mock-admin',
      createdAtUtc: '2026-07-23T09:00:00.000Z',
      updatedAtUtc: '2026-07-23T09:00:00.000Z',
    }
    mockDocuments.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.post(
    '/api/v1/vendors/:id/documents/:documentId/confirm',
    ({ params }) => {
      const document = mockDocuments.find(
        (item) => item.id === params.documentId,
      )
      if (!document) return HttpResponse.json({}, { status: 404 })
      document.status = 'Confirmed'
      document.confirmedByActorRef = 'mock-procurement'
      document.confirmedAtUtc = '2026-07-23T09:05:00.000Z'
      return HttpResponse.json(document)
    },
  ),
  http.post(
    '/api/v1/vendors/:id/documents/:documentId/reject',
    ({ params }) => {
      const document = mockDocuments.find(
        (item) => item.id === params.documentId,
      )
      if (!document) return HttpResponse.json({}, { status: 404 })
      document.status = 'Rejected'
      return HttpResponse.json(document)
    },
  ),
  http.post('/api/v1/vendors', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const created = {
      ...mockVendors[1],
      id: '99999999-9999-4999-8999-999999999999',
      legalName: String(body.legalName ?? 'New Vendor'),
      categoryCode: String(body.categoryCode ?? 'LESSOR'),
      tradeLicenceNumber: body.tradeLicenceNumber
        ? String(body.tradeLicenceNumber)
        : null,
      tradeLicenceEmirate: body.tradeLicenceEmirate
        ? String(body.tradeLicenceEmirate)
        : null,
      taxRegistrationNumber: body.taxRegistrationNumber
        ? String(body.taxRegistrationNumber)
        : null,
      primaryContactName: body.primaryContactName
        ? String(body.primaryContactName)
        : null,
      primaryContactEmail: body.primaryContactEmail
        ? String(body.primaryContactEmail)
        : null,
      primaryContactPhone: body.primaryContactPhone
        ? String(body.primaryContactPhone)
        : null,
      status: 'Draft',
      dataQualityFlag: true,
    } satisfies Vendor
    const existingIndex = mockVendors.findIndex((item) => item.id === created.id)
    if (existingIndex >= 0) mockVendors[existingIndex] = created
    else mockVendors.push(created)
    return HttpResponse.json(created)
  }),
  http.patch('/api/v1/vendors/:id', async ({ params, request }) => {
    const index = mockVendors.findIndex((item) => item.id === params.id)
    if (index < 0)
      return HttpResponse.json({ title: 'Unknown vendor' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    const updated = { ...mockVendors[index], ...body } as Vendor
    if (body.bankIban) updated.bankIbanMasked = 'AE************1234'
    mockVendors[index] = updated
    return HttpResponse.json(updated)
  }),
  http.post('/api/v1/vendors/:id/:action', ({ params }) => {
    const vendor = mockVendors.find((item) => item.id === params.id)
    if (!vendor) return HttpResponse.json({}, { status: 404 })
    const action = String(params.action)
    vendor.status =
      action === 'approve'
        ? 'Active'
        : ['reject', 'request-change'].includes(action)
          ? 'Draft'
          : action === 'submit'
            ? 'PendingApproval'
            : vendor.status
    if (['approve', 'reject', 'request-change'].includes(action)) {
      mockApprovalWorkItems = mockApprovalWorkItems.filter(
        (item) => item.vendorId !== vendor.id,
      )
    }
    return HttpResponse.json(vendor)
  }),
]
