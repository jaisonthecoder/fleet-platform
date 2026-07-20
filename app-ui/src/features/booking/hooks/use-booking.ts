import { useMutation } from '@tanstack/react-query'
import {
  createBooking,
  searchAvailableVehicles,
  signBookingConsent,
  submitBooking,
  type BookingSearchInput,
  type CreateBookingInput,
} from '../booking.contract'

export function useAvailableVehicles() {
  return useMutation({ mutationFn: (input: BookingSearchInput) => searchAvailableVehicles(input) })
}

export function useCreateBooking() {
  return useMutation({ mutationFn: (input: CreateBookingInput) => createBooking(input) })
}

export function useSignBookingConsent() {
  return useMutation({
    mutationFn: ({ bookingId, driverPersonId }: { bookingId: string; driverPersonId: string }) =>
      signBookingConsent(bookingId, driverPersonId),
  })
}

export function useSubmitBooking() {
  return useMutation({ mutationFn: (bookingId: string) => submitBooking(bookingId) })
}
