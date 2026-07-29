import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeocodingService } from '../services/geocoding.service';

/**
 * Authenticated geocoding proxy so the browser never calls the upstream provider
 * directly (no CORS, controlled rate/limit, server-managed key when Azure Maps
 * is adopted). Used by the organization location picker; reusable elsewhere.
 */
@Controller({ path: 'geocode', version: '1' })
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  /** Forward geocode: address text → coordinates + address parts. */
  @Get('search')
  search(@Query('q') q: string, @Query('lang') lang?: string) {
    const query = (q ?? '').trim();
    if (query.length < 3) {
      throw new BadRequestException({ title: 'Query too short', reasons: ['geocode-query-too-short'] });
    }
    return this.geocoding.forward(query, lang === 'ar' ? 'ar' : 'en');
  }

  /** Reverse geocode: coordinates → address parts. */
  @Get('reverse')
  reverse(@Query('lat') lat: string, @Query('lon') lon: string, @Query('lang') lang?: string) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException({ title: 'Invalid coordinates', reasons: ['geocode-invalid-coordinates'] });
    }
    return this.geocoding.reverse(latitude, longitude, lang === 'ar' ? 'ar' : 'en');
  }
}
