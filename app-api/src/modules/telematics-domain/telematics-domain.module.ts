import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PlatformModule } from '../platform/platform.module';
import { TelematicsController } from './controllers/telematics.controller';
import { BookingLookupAdapter } from './internal/bookings-adapter';
import { BOOKINGS_PORT } from './internal/bookings-port';
import { TelematicsRepository } from './repositories/telematics.repository';
import { AlertService } from './services/alert.service';
import { DeviceService } from './services/device.service';
import { LiveMapService } from './services/live-map.service';
import { TripService } from './services/trip.service';

/**
 * Telematics domain (M10, in `api`): device registry + pairing, live map,
 * derived trips with booking attribution via the bookings **port**, and alerts.
 * The `telematics-ingest` pipe (separate deployable) stays free of domain logic.
 * BOOKINGS_PORT now uses the real bookings adapter (closes P1B-R1-1).
 */
@Module({
  imports: [PlatformModule, BookingsModule],
  controllers: [TelematicsController],
  providers: [
    TelematicsRepository,
    DeviceService,
    TripService,
    AlertService,
    LiveMapService,
    BookingLookupAdapter,
    { provide: BOOKINGS_PORT, useExisting: BookingLookupAdapter },
  ],
  exports: [AlertService, TripService],
})
export class TelematicsDomainModule {}
