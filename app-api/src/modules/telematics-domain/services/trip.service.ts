import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { toDbException } from '../../../common/database/pg-error';
import type { EndTrip, StartTrip, TripDto } from '../../../contracts/telematics.contract';
import { AuditService } from '../../platform/services/audit.service';
import { BOOKINGS_PORT, type BookingLookupPort } from '../internal/bookings-port';
import { TelematicsRepository } from '../repositories/telematics.repository';

type TripRow = NonNullable<Awaited<ReturnType<TelematicsRepository['findTrip']>>>;

/**
 * Derived-trip lifecycle + attribution. On end, the trip is attached to the
 * booking that was active for the vehicle (via the bookings **port** — a
 * test-double until 1D, P1B-R1-1), else marked unattributed. Telematics is the
 * system of record for odometer, so the vehicle's last-confirmed odometer is
 * updated from the trip's end reading.
 */
@Injectable()
export class TripService {
  constructor(
    private readonly repo: TelematicsRepository,
    @Inject(BOOKINGS_PORT) private readonly bookings: BookingLookupPort,
    private readonly audit: AuditService,
  ) {}

  async startTrip(input: StartTrip): Promise<TripDto> {
    try {
      const created = await this.repo.insertTrip({
        vehicleId: input.vehicleId,
        deviceId: input.deviceId ?? null,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        startOdometer: input.startOdometer ?? null,
      });
      return this.toDto(created);
    } catch (error) {
      throw toDbException(error);
    }
  }

  async endTrip(tripId: string, input: EndTrip, actorRef = 'system'): Promise<TripDto> {
    const existing = await this.repo.findTrip(tripId);
    if (!existing) {
      throw new NotFoundException({ title: 'Unknown trip', reasons: [`trip-not-found:${tripId}`] });
    }
    if (existing.endedAt) {
      throw new ConflictException({ title: 'Trip already ended', reasons: [`trip-already-ended:${tripId}`] });
    }
    const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
    const booking = await this.bookings.findActiveBooking(existing.vehicleId, endedAt);
    const updated = await this.repo.updateTrip(tripId, {
      endedAt,
      endOdometer: input.endOdometer ?? null,
      distanceKm: input.distanceKm ?? null,
      bookingId: booking?.bookingId ?? null,
      driverPersonId: booking?.driverPersonId ?? null,
      attributionBasis: booking ? 'booking' : 'unattributed',
    });
    if (input.endOdometer) {
      await this.repo.updateVehicleOdometer(existing.vehicleId, input.endOdometer);
    }
    await this.audit.record({
      actorRef,
      action: 'TRIP_ENDED',
      entityRef: `trip:${tripId}`,
      after: { bookingId: booking?.bookingId ?? null, attribution: updated.attributionBasis },
    });
    return this.toDto(updated);
  }

  private toDto(t: TripRow): TripDto {
    return {
      id: t.id,
      vehicleId: t.vehicleId,
      bookingId: t.bookingId,
      driverPersonId: t.driverPersonId,
      attributionBasis: t.attributionBasis,
      endedAt: t.endedAt ? t.endedAt.toISOString() : null,
    };
  }
}
