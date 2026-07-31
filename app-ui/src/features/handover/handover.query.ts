import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  appendHandoverAmendment,
  getHandoverChain,
  getHandoverReceipt,
  getHandoverRegister,
  getHandoverCaptureContext,
  getHandoverWorkItems,
  type HandoverRegisterInput,
} from './handover.contract'

export const handoverKeys = {
  all: ['handover'] as const,
  register: (input: HandoverRegisterInput) => ['handover', 'register', input] as const,
  workItems: () => ['handover', 'work-items'] as const,
  chain: (handoverId: string) => ['handover', 'chain', handoverId] as const,
  receipt: (handoverId: string) => ['handover', 'receipt', handoverId] as const,
  captureContext: (bookingId: string) => ['handover', 'capture-context', bookingId] as const,
}

/** Loads a URL-controlled historical custody-register page. */
export function useHandoverRegister(input: HandoverRegisterInput) {
  return useQuery({
    queryKey: handoverKeys.register(input),
    queryFn: () => getHandoverRegister(input),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })
}

/** Loads current capture candidates without mixing them into register history. */
export function useHandoverWorkItems() {
  return useQuery({
    queryKey: handoverKeys.workItems(),
    queryFn: getHandoverWorkItems,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })
}

/** Loads persisted Booking, consent, telematics and carried-damage capture facts. */
export function useHandoverCaptureContext(bookingId: string | null) {
  return useQuery({
    queryKey: handoverKeys.captureContext(bookingId ?? ''),
    queryFn: () => getHandoverCaptureContext(bookingId!),
    enabled: bookingId !== null,
  })
}

/** Loads one immutable custody chain. */
export function useHandoverChain(handoverId: string | null) {
  return useQuery({ queryKey: handoverKeys.chain(handoverId ?? ''), queryFn: () => getHandoverChain(handoverId!), enabled: handoverId !== null })
}

/** Loads a completion receipt only for Returned custody. */
export function useHandoverReceipt(handoverId: string | null, enabled: boolean) {
  return useQuery({ queryKey: handoverKeys.receipt(handoverId ?? ''), queryFn: () => getHandoverReceipt(handoverId!), enabled: handoverId !== null && enabled })
}

/** Appends a correction and refreshes all chain/register projections. */
export function useAppendHandoverAmendment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: appendHandoverAmendment,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: handoverKeys.all }),
  })
}