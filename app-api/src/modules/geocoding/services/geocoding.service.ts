import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
}

const BASE_URL = 'https://nominatim.openstreetmap.org';
// Nominatim requires an identifying User-Agent; browsers cannot set one (and it
// sends no CORS header), which is why geocoding is proxied server-side here.
const USER_AGENT = 'wayfinder-fleet-platform/1.0 (organization geocoding)';

/** Best available city-like label from Nominatim address parts. */
function pickCity(parts: Record<string, string> = {}): string {
  return (
    parts.city ||
    parts.town ||
    parts.village ||
    parts.municipality ||
    parts.county ||
    parts.state ||
    ''
  );
}

/**
 * Server-side geocoding proxy (keyless OpenStreetMap Nominatim). Swap the base
 * URL / provider for Azure Maps Search in production behind this same interface.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  /** Address text → coordinates + normalised address parts (or null). */
  async forward(query: string, lang: 'en' | 'ar' = 'en'): Promise<GeocodeResult | null> {
    const url = `${BASE_URL}/search?format=jsonv2&addressdetails=1&limit=1&accept-language=${lang}&q=${encodeURIComponent(query)}`;
    const rows = await this.fetchJson<
      Array<{ lat: string; lon: string; display_name: string; address?: Record<string, string> }>
    >(url);
    const hit = rows?.[0];
    if (!hit) return null;
    return {
      latitude: Number(Number(hit.lat).toFixed(6)),
      longitude: Number(Number(hit.lon).toFixed(6)),
      address: hit.display_name,
      city: pickCity(hit.address),
      country: hit.address?.country ?? '',
    };
  }

  /** Coordinates → normalised address parts (or null). */
  async reverse(
    latitude: number,
    longitude: number,
    lang: 'en' | 'ar' = 'en',
  ): Promise<Omit<GeocodeResult, 'latitude' | 'longitude'> | null> {
    const url = `${BASE_URL}/reverse?format=jsonv2&addressdetails=1&accept-language=${lang}&lat=${latitude}&lon=${longitude}`;
    const hit = await this.fetchJson<{ display_name?: string; address?: Record<string, string> }>(url);
    if (!hit?.display_name) return null;
    return {
      address: hit.display_name,
      city: pickCity(hit.address),
      country: hit.address?.country ?? '',
    };
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        this.logger.warn(`geocoding upstream returned ${response.status}`);
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(`geocoding request failed: ${(error as Error).message}`);
      return null;
    }
  }
}
