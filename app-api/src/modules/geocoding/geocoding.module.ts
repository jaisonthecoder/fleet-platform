import { Module } from '@nestjs/common';
import { GeocodingController } from './controllers/geocoding.controller';
import { GeocodingService } from './services/geocoding.service';

/** Server-side geocoding proxy (forward + reverse) for map/location features. */
@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
