/**
 * Geocoding via the backend proxy (`/v1/geocode/*`). The browser cannot call
 * OpenStreetMap Nominatim directly (it sends no CORS header), so the API proxies
 * it server-side — and can swap to Azure Maps behind the same endpoints later.
 */
import { apiClient } from '@/lib/api-client'

export interface GeocodeResult {
  latitude: number
  longitude: number
  address: string
  city: string
  country: string
}

/** Address text → coordinates + normalised address parts (or null if not found). */
export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  try {
    return await apiClient.get<GeocodeResult | null>(
      `/v1/geocode/search?q=${encodeURIComponent(query)}`,
    )
  } catch {
    return null
  }
}

/** Coordinates → normalised address parts (or null if not found). */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Omit<GeocodeResult, 'latitude' | 'longitude'> | null> {
  try {
    return await apiClient.get<Omit<GeocodeResult, 'latitude' | 'longitude'> | null>(
      `/v1/geocode/reverse?lat=${latitude}&lon=${longitude}`,
    )
  } catch {
    return null
  }
}
