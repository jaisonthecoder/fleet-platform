import { Injectable } from '@nestjs/common';
import { BookingService } from '../../bookings/services/booking.service';
import type { ActiveBooking, BookingLookupPort } from './bookings-port';

/**
 * Real bookings adapter for the telematics trip-attach port (closes P1B-R1-1).
 * Resolves the booking that was active for a vehicle at a point in time via the
 * bookings module, so a derived trip attributes to the right driver. Replaces
 * the Phase-0 stub now that the `bookings` module (M4) exists.
 */
@Injectable()
export class BookingLookupAdapter implements BookingLookupPort {
  constructor(private readonly bookings: BookingService) {}

  async findActiveBooking(vehicleId: string, at: Date): Promise<ActiveBooking | null> {
    return this.bookings.findActiveBooking(vehicleId, at);
  }
}
