import { Injectable } from '@nestjs/common';

/** DI token for the bookings lookup port (real adapter lands in Sub-Phase 1D). */
export const BOOKINGS_PORT = Symbol('BOOKINGS_PORT');

/** The active booking a trip should attribute to. */
export interface ActiveBooking {
  bookingId: string;
  driverPersonId: string;
}

/**
 * Port the telematics domain uses to attach a derived trip to the booking that
 * was active for a vehicle at a point in time (P1B-R1-1). The real adapter over
 * the `bookings` module is wired at the start of 1D; until then the stub keeps
 * trips unattributed so this module builds and tests independently.
 */
export interface BookingLookupPort {
  findActiveBooking(vehicleId: string, at: Date): Promise<ActiveBooking | null>;
}

/** Default no-op adapter — no bookings module yet, so trips stay unattributed. */
@Injectable()
export class StubBookingLookup implements BookingLookupPort {
  async findActiveBooking(): Promise<ActiveBooking | null> {
    return null;
  }
}
