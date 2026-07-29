import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

/** Vendor lifecycle (mirrors backend `fleet_vendor_status`). */
export const VENDOR_STATUSES = [
  'Draft',
  'PendingApproval',
  'Active',
  'Suspended',
  'Retired',
] as const
export type VendorStatus = (typeof VENDOR_STATUSES)[number]

/** How a vendor record is mastered (plug-and-play seam). */
export const VENDOR_SOURCE_MODES = ['Manual', 'Integrated'] as const
export type VendorSourceMode = (typeof VENDOR_SOURCE_MODES)[number]

export const VENDOR_DOCUMENT_STATUSES = [
  'Uploaded',
  'PendingConfirmation',
  'Confirmed',
  'Superseded',
  'Rejected',
] as const
export type VendorDocumentStatus = (typeof VENDOR_DOCUMENT_STATUSES)[number]

export const vendorSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  tradeName: z.string().nullable(),
  tradeLicenceNumber: z.string().nullable(),
  tradeLicenceEmirate: z.string().nullable(),
  taxRegistrationNumber: z.string().nullable(),
  categoryCode: z.string(),
  primaryContactName: z.string().nullable(),
  primaryContactRole: z.string().nullable(),
  primaryContactEmail: z.string().nullable(),
  primaryContactPhone: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  currency: z.string(),
  bankIbanMasked: z.string().nullable(),
  sourceMode: z.string(),
  sourceSystem: z.string().nullable(),
  externalRef: z.string().nullable(),
  dataQualityFlag: z.boolean(),
  vendorPortalEnabled: z.boolean(),
  status: z.string(),
  notes: z.string().nullable(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
})
export type Vendor = z.infer<typeof vendorSchema>

export const vendorOnboardingProfileSchema = z.object({
  vendorId: z.string().uuid(),
  standardOffHireNoticeDays: z.number().int().nonnegative().nullable(),
  earlyTerminationPenalty: z.string().nullable(),
  renewalOptions: z.string().nullable(),
  escalationClause: z.string().nullable(),
  replacementClause: z.string().nullable(),
  alertLadder: z.string().nullable(),
  accessMode: z.literal('ManualInternal'),
  updatedAtUtc: z.string(),
})
export type VendorOnboardingProfile = z.infer<
  typeof vendorOnboardingProfileSchema
>

export const vendorOnboardingSchema = z.object({
  vendor: vendorSchema,
  profile: vendorOnboardingProfileSchema.nullable(),
  documentRequirements: z.array(
    z.object({
      code: z.string(),
      required: z.boolean(),
      tracksExpiry: z.boolean(),
      state: z.enum([
        'Missing',
        'PendingConfirmation',
        'Confirmed',
        'Expired',
      ]),
    }),
  ),
  completeness: z.object({
    completed: z.number().int().nonnegative(),
    required: z.number().int().positive(),
    missing: z.array(z.string()),
    canSubmit: z.boolean(),
    canActivate: z.boolean(),
  }),
})
export type VendorOnboarding = z.infer<typeof vendorOnboardingSchema>

export const vendorApprovalWorkItemSchema = z.object({
  vendorId: z.string().uuid(),
  legalName: z.string(),
  categoryCode: z.string(),
  sourceMode: z.enum(VENDOR_SOURCE_MODES),
  makerActorRef: z.string(),
  submitterActorRef: z.string(),
  submittedAtUtc: z.string().nullable(),
  assignedAuthorityRole: z.literal('Procurement'),
  updatedAtUtc: z.string(),
  completeness: vendorOnboardingSchema.shape.completeness,
  documentRequirements: vendorOnboardingSchema.shape.documentRequirements,
  changeSummary: z.object({
    identityUpdated: z.boolean(),
    termsCaptured: z.boolean(),
    confirmedDocuments: z.number().int().nonnegative(),
    pendingDocuments: z.number().int().nonnegative(),
  }),
})
export type VendorApprovalWorkItem = z.infer<
  typeof vendorApprovalWorkItemSchema
>

export const leaseContractSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid(),
  contractRef: z.string(),
  scopeNodeId: z.string().nullable(),
  monthlyAmount: z.string().nullable(),
  currency: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  offHireNoticeDays: z.string().nullable(),
  earlyTerminationPenalty: z.string().nullable(),
  renewalOptions: z.string().nullable(),
  escalationClause: z.string().nullable(),
  replacementClause: z.string().nullable(),
  alertLadder: z.string(),
  status: z.string(),
  renewedIntoContractRef: z.string().nullable(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
})
export type LeaseContract = z.infer<typeof leaseContractSchema>

export const vendorDocumentSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid(),
  documentTypeCode: z.string(),
  version: z.number().int().positive(),
  documentReference: z.string().nullable(),
  blobRef: z.string(),
  issueDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  status: z.enum(VENDOR_DOCUMENT_STATUSES),
  extractedMetadata: z.record(z.string(), z.unknown()).nullable(),
  confirmedMetadata: z.record(z.string(), z.unknown()).nullable(),
  confirmedByActorRef: z.string().nullable(),
  confirmedAtUtc: z.string().nullable(),
  supersededById: z.string().uuid().nullable(),
  createdByActorRef: z.string(),
  createdAtUtc: z.string(),
  updatedAtUtc: z.string(),
})
export type VendorDocument = z.infer<typeof vendorDocumentSchema>

export interface CreateVendorInput {
  legalName: string
  categoryCode: string
  tradeName?: string
  tradeLicenceNumber?: string
  tradeLicenceEmirate?: string
  taxRegistrationNumber?: string
  primaryContactName?: string
  primaryContactRole?: string
  primaryContactEmail?: string
  primaryContactPhone?: string
  paymentTerms?: string
  currency?: string
  bankIban?: string
  sourceMode?: VendorSourceMode
  sourceSystem?: string
  externalRef?: string
  vendorPortalEnabled?: boolean
  notes?: string
}

export type UpdateVendorInput = Partial<CreateVendorInput>

export interface UpdateVendorOnboardingProfileInput {
  standardOffHireNoticeDays?: number | null
  earlyTerminationPenalty?: string | null
  renewalOptions?: string | null
  escalationClause?: string | null
  replacementClause?: string | null
  alertLadder?: string | null
  accessMode?: 'ManualInternal'
}

export interface CreateLeaseContractInput {
  contractRef: string
  monthlyAmount?: string
  currency?: string
  startDate?: string
  endDate?: string
  offHireNoticeDays?: number
  earlyTerminationPenalty?: string
  renewalOptions?: string
  escalationClause?: string
  replacementClause?: string
  alertLadder?: string
}

export interface CreateVendorDocumentInput {
  documentTypeCode: string
  documentReference?: string
  blobRef: string
  issueDate?: string
  expiryDate?: string
}

export interface ConfirmVendorDocumentInput {
  documentReference?: string
  issueDate?: string | null
  expiryDate?: string | null
  confirmedMetadata?: Record<string, unknown>
}

/** Lifecycle actions available on a vendor (map 1:1 to backend endpoints). */
export type VendorAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'request-change'
  | 'suspend'
  | 'reactivate'
  | 'retire'

/** Lists vendors visible to the authenticated principal. */
export async function fetchVendors(): Promise<Vendor[]> {
  return z.array(vendorSchema).parse(await apiClient.get('/v1/vendors'))
}

/** Lists Pending Approval Vendor work assigned to Procurement authority. */
export async function fetchVendorApprovals(): Promise<
  VendorApprovalWorkItem[]
> {
  return z
    .array(vendorApprovalWorkItemSchema)
    .parse(await apiClient.get('/v1/vendors/approvals'))
}

/** Loads one vendor. */
export async function fetchVendor(id: string): Promise<Vendor> {
  return vendorSchema.parse(await apiClient.get(`/v1/vendors/${id}`))
}

/** Creates a vendor (defaults to Manual source; starts in Draft). */
export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  return vendorSchema.parse(await apiClient.post('/v1/vendors', input))
}

/** Updates mutable identity and commercial fields on a manual Vendor. */
export async function updateVendor(
  id: string,
  input: UpdateVendorInput,
): Promise<Vendor> {
  return vendorSchema.parse(await apiClient.patch(`/v1/vendors/${id}`, input))
}

/** Loads persisted wizard state and server-owned completeness. */
export async function fetchVendorOnboarding(
  id: string,
): Promise<VendorOnboarding> {
  return vendorOnboardingSchema.parse(
    await apiClient.get(`/v1/vendors/${id}/onboarding`),
  )
}

/** Persists reusable Vendor defaults and returns refreshed completeness. */
export async function updateVendorOnboardingProfile(
  id: string,
  input: UpdateVendorOnboardingProfileInput,
): Promise<VendorOnboarding> {
  return vendorOnboardingSchema.parse(
    await apiClient.patch(`/v1/vendors/${id}/onboarding`, input),
  )
}

/** Applies a lifecycle action; `reason` is recorded on the audit trail. */
export async function actOnVendor(
  id: string,
  action: VendorAction,
  reason?: string,
): Promise<Vendor> {
  return vendorSchema.parse(
    await apiClient.post(`/v1/vendors/${id}/${action}`, { reason }),
  )
}

/** Lists a vendor's lease contracts. */
export async function fetchVendorLeases(
  vendorId: string,
): Promise<LeaseContract[]> {
  return z
    .array(leaseContractSchema)
    .parse(await apiClient.get(`/v1/vendors/${vendorId}/lease-contracts`))
}

/** Creates a lease contract under a vendor (vendor must be Active). */
export async function createVendorLease(
  vendorId: string,
  input: CreateLeaseContractInput,
): Promise<LeaseContract> {
  return leaseContractSchema.parse(
    await apiClient.post(`/v1/vendors/${vendorId}/lease-contracts`, input),
  )
}

/** Lists every immutable document version for one Vendor. */
export async function fetchVendorDocuments(
  vendorId: string,
): Promise<VendorDocument[]> {
  return z
    .array(vendorDocumentSchema)
    .parse(await apiClient.get(`/v1/vendors/${vendorId}/documents`))
}

/** Creates a pending Vendor document version for manual review. */
export async function createVendorDocument(
  vendorId: string,
  input: CreateVendorDocumentInput,
): Promise<VendorDocument> {
  return vendorDocumentSchema.parse(
    await apiClient.post(`/v1/vendors/${vendorId}/documents`, input),
  )
}

/** Confirms one pending Vendor document version. */
export async function confirmVendorDocument(
  vendorId: string,
  documentId: string,
  input: ConfirmVendorDocumentInput,
): Promise<VendorDocument> {
  return vendorDocumentSchema.parse(
    await apiClient.post(
      `/v1/vendors/${vendorId}/documents/${documentId}/confirm`,
      input,
    ),
  )
}

/** Rejects one pending Vendor document version while retaining evidence. */
export async function rejectVendorDocument(
  vendorId: string,
  documentId: string,
  reason: string,
): Promise<VendorDocument> {
  return vendorDocumentSchema.parse(
    await apiClient.post(
      `/v1/vendors/${vendorId}/documents/${documentId}/reject`,
      { reason },
    ),
  )
}
