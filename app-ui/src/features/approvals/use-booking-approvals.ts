import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideBooking, decideEntitlement, getApprovalHistory, getBookingApprovals, getBookingPreparation, getEntitlementApprovals, interveneApproval } from './booking-approvals.contract'

export const BOOKING_APPROVALS_KEY = ['booking', 'approvals'] as const

/** Queries the caller's assigned/delegated Booking approval tasks. */
export function useBookingApprovals() {
  return useQuery({ queryKey: BOOKING_APPROVALS_KEY, queryFn: getBookingApprovals })
}

/** Decides one task and refreshes the queue after committed success. */
export function useBookingDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: decideBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOOKING_APPROVALS_KEY }),
  })
}

/** Queries the caller's scoped read-only Fleet preparation queue. */
export function useBookingPreparation() {
  return useQuery({ queryKey: ['booking', 'preparation'], queryFn: getBookingPreparation })
}

export const ENTITLEMENT_APPROVALS_KEY = ['entitlements', 'approvals'] as const
export const APPROVAL_HISTORY_KEY = ['approvals', 'history'] as const

/** Queries the caller's assigned/delegated Dedicated approval tasks. */
export function useEntitlementApprovals() {
  return useQuery({ queryKey: ENTITLEMENT_APPROVALS_KEY, queryFn: getEntitlementApprovals })
}

/** Decides one Dedicated task and refreshes the queue after committed success. */
export function useEntitlementDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: decideEntitlement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENTITLEMENT_APPROVALS_KEY }),
  })
}

/** Queries Pool and Dedicated history under one approver-facing cache boundary. */
export function useApprovalHistory() {
  return useQuery({ queryKey: APPROVAL_HISTORY_KEY, queryFn: getApprovalHistory })
}

/** Applies an intervention and refreshes history plus downstream operational queues. */
export function useApprovalIntervention() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: interveneApproval,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: APPROVAL_HISTORY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['booking', 'preparation'] }),
        queryClient.invalidateQueries({ queryKey: ['handover'] }),
        queryClient.invalidateQueries({ queryKey: ['entitlements', 'allocation'] }),
      ])
    },
  })
}