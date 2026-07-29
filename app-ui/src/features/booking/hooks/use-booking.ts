import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelBooking,
  createBooking,
  extendBooking,
  getBooking,
  getBookingEvents,
  getAvailabilityTimeline,
  getBookablePeople,
  getBookingContext,
  getMyBookings,
  modifyBooking,
  searchAvailableVehicles,
  signBookingConsent,
  submitBooking,
  type BookingSearchInput,
  type CreateBookingInput,
  type AvailabilityTimelineInput,
} from '../booking.contract'

/** Loads the authenticated self-booking context. */
export function useBookingContext() {
  return useQuery({ queryKey: ['booking', 'context'], queryFn: getBookingContext })
}

/** Loads only people covered by the caller's persisted Booking authority. */
export function useBookablePeople(enabled: boolean) {
  return useQuery({
    queryKey: ['booking', 'people'],
    queryFn: getBookablePeople,
    enabled,
  })
}

/** Queries the authenticated person's persisted Booking history. */
export function useMyBookings() {
  return useQuery({ queryKey: ['booking', 'mine'], queryFn: getMyBookings })
}

/** Queries available Vehicles for the submitted search window. */
export function useAvailableVehicles(input: BookingSearchInput | null) {
  return useQuery({
    queryKey: ['booking', 'availability', input],
    queryFn: () => searchAvailableVehicles(input!),
    enabled: input !== null,
  })
}

/** Queries the privacy-safe timeline for the selected day. */
export function useAvailabilityTimeline(input: AvailabilityTimelineInput | null) {
  return useQuery({
    queryKey: ['booking', 'timeline', input],
    queryFn: () => getAvailabilityTimeline(input!),
    enabled: input !== null,
  })
}

/** Creates one retry-safe Draft using the caller-stable command key. */
export function useCreateBooking() {
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateBookingInput; idempotencyKey: string }) =>
      createBooking(input, idempotencyKey),
  })
}

export function useSignBookingConsent() {
  return useMutation({
    mutationFn: (input: {
      bookingId: string
      driverPersonId: string
      consentDocumentVersion: string
      idempotencyKey: string
    }) => signBookingConsent(
      input.bookingId,
      input.driverPersonId,
      input.consentDocumentVersion,
      input.idempotencyKey,
    ),
  })
}

export function useSubmitBooking() {
  return useMutation({
    mutationFn: ({ bookingId, idempotencyKey }: { bookingId: string; idempotencyKey: string }) =>
      submitBooking(bookingId, idempotencyKey),
  })
}

/** Reconciles a Booking after an ambiguous consent or submit timeout. */
export function useBookingReconciliation() {
  return useMutation({ mutationFn: (bookingId: string) => getBooking(bookingId) })
}

/** Loads immutable owner-visible events only while a Booking detail is open. */
export function useBookingEvents(bookingId: string | null) {
  return useQuery({
    queryKey: ['booking', bookingId, 'events'],
    queryFn: () => getBookingEvents(bookingId!),
    enabled: bookingId !== null,
  })
}

/** Invalidates Booking collection and chronology after one lifecycle command. */
function useBookingLifecycleMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['booking'] })
    },
  })
}

/** Modifies an owner Booking and refreshes all owner projections. */
export function useModifyBooking() {
  return useBookingLifecycleMutation(modifyBooking)
}

/** Extends an owner Booking and refreshes all owner projections. */
export function useExtendBooking() {
  return useBookingLifecycleMutation(extendBooking)
}

/** Cancels an owner Booking and refreshes all owner projections. */
export function useCancelBooking() {
  return useBookingLifecycleMutation(cancelBooking)
}
