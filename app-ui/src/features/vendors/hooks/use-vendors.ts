import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  actOnVendor,
  confirmVendorDocument,
  createVendorDocument,
  createVendor,
  createVendorLease,
  fetchVendorLeases,
  fetchVendorDocuments,
  fetchVendorOnboarding,
  fetchVendorApprovals,
  fetchVendors,
  rejectVendorDocument,
  type ConfirmVendorDocumentInput,
  type CreateLeaseContractInput,
  type CreateVendorDocumentInput,
  type CreateVendorInput,
  type UpdateVendorInput,
  type UpdateVendorOnboardingProfileInput,
  type VendorAction,
  updateVendor,
  updateVendorOnboardingProfile,
} from '../vendors.contract'

/** Loads the vendor master list. */
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
    staleTime: 30_000,
  })
}

/** Loads Pending Approval Vendor work for Procurement governance roles. */
export function useVendorApprovals(enabled = true) {
  return useQuery({
    queryKey: ['vendors', 'approvals'],
    queryFn: fetchVendorApprovals,
    enabled,
    staleTime: 10_000,
  })
}

/** Loads a vendor's lease contracts (enabled once a vendor is selected). */
export function useVendorLeases(vendorId: string | null) {
  return useQuery({
    queryKey: ['vendors', vendorId, 'leases'],
    queryFn: () => fetchVendorLeases(vendorId as string),
    enabled: Boolean(vendorId),
    staleTime: 30_000,
  })
}

/** Creates a vendor and refreshes the master list. */
export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVendorInput) => createVendor(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

/** Loads persisted onboarding state once a Draft Vendor exists. */
export function useVendorOnboarding(vendorId: string | null) {
  return useQuery({
    queryKey: ['vendors', vendorId, 'onboarding'],
    queryFn: () => fetchVendorOnboarding(vendorId as string),
    enabled: Boolean(vendorId),
    staleTime: 5_000,
  })
}

/** Updates mutable Vendor fields and refreshes list and onboarding state. */
export function useUpdateVendor(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateVendorInput) => updateVendor(vendorId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vendors'] }),
        queryClient.invalidateQueries({
          queryKey: ['vendors', vendorId, 'onboarding'],
        }),
      ])
    },
  })
}

/** Persists reusable Vendor terms and access defaults. */
export function useUpdateVendorOnboardingProfile(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateVendorOnboardingProfileInput) =>
      updateVendorOnboardingProfile(vendorId, input),
    onSuccess: async (onboarding) => {
      queryClient.setQueryData(
        ['vendors', vendorId, 'onboarding'],
        onboarding,
      )
    },
  })
}

/** Runs a vendor lifecycle action (submit/approve/reject/suspend/…). */
export function useVendorAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string
      action: VendorAction
      reason?: string
    }) => actOnVendor(id, action, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
  })
}

/** Creates a lease contract under a vendor and refreshes its lease list. */
export function useCreateVendorLease(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeaseContractInput) =>
      createVendorLease(vendorId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['vendors', vendorId, 'leases'],
      })
    },
  })
}

/** Loads immutable document versions for a selected Vendor. */
export function useVendorDocuments(vendorId: string | null) {
  return useQuery({
    queryKey: ['vendors', vendorId, 'documents'],
    queryFn: () => fetchVendorDocuments(vendorId as string),
    enabled: Boolean(vendorId),
    staleTime: 30_000,
  })
}

/** Creates a pending Vendor document and refreshes its evidence list. */
export function useCreateVendorDocument(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVendorDocumentInput) =>
      createVendorDocument(vendorId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['vendors', vendorId, 'documents'],
      })
    },
  })
}

/** Confirms a pending Vendor document and refreshes version history. */
export function useConfirmVendorDocument(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string
      input: ConfirmVendorDocumentInput
    }) => confirmVendorDocument(vendorId, documentId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['vendors', vendorId, 'documents'],
      })
    },
  })
}

/** Rejects a pending Vendor document and refreshes version history. */
export function useRejectVendorDocument(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      reason,
    }: {
      documentId: string
      reason: string
    }) => rejectVendorDocument(vendorId, documentId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['vendors', vendorId, 'documents'],
      })
    },
  })
}
