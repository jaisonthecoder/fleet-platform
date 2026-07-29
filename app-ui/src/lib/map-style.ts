import { type StyleSpecification } from 'maplibre-gl'

/** Abu Dhabi fallback centre ([lng, lat]) when no coordinates are set yet. */
export const DEFAULT_CENTER: [number, number] = [54.3773, 24.4539]

/**
 * Google Maps raster basemap (roads style, `lyrs=m`). Dev/default only — for
 * production supply an official vector style (Azure Maps / MapTiler) through
 * `VITE_MAP_STYLE_URL`.
 */
const GOOGLE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    google: {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '© Google',
    },
  },
  layers: [{ id: 'google', type: 'raster', source: 'google' }],
}

/** Resolved basemap: the configured style URL, else the Google raster fallback. */
export const MAP_STYLE: string | StyleSpecification =
  (import.meta.env as Record<string, string | undefined>).VITE_MAP_STYLE_URL ??
  GOOGLE_STYLE
