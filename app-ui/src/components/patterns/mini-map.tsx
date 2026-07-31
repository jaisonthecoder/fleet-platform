import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE } from '@/lib/map-style'
import { cn } from '@/lib/utils'

interface MiniMapProps {
  latitude: number
  longitude: number
  zoom?: number
  className?: string
}

/**
 * A compact read-only map centred on a single point with a marker. Used to
 * visualise a live telematics position. Map init is guarded so it degrades
 * gracefully where WebGL is unavailable (e.g. jsdom under test).
 */
export function MiniMap({
  latitude,
  longitude,
  zoom = 13,
  className,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [longitude, latitude],
        zoom,
        attributionControl: false,
      })
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right',
      )
      markerRef.current = new maplibregl.Marker({ color: '#0b3d5c' })
        .setLngLat([longitude, latitude])
        .addTo(map)
      map.on('load', () => map.resize())
      requestAnimationFrame(() => map.resize())
      mapRef.current = map
    } catch {
      // WebGL unavailable (e.g. test env) — render the empty container.
    }
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; point sync lives in the effect below.
  }, [])

  // Keep the marker + centre in sync as the live position updates.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const lngLat: [number, number] = [longitude, latitude]
    markerRef.current?.setLngLat(lngLat)
    map.easeTo({ center: lngLat, duration: 400 })
  }, [latitude, longitude])

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-52 w-full overflow-hidden rounded-[3px] border border-border bg-muted',
        className,
      )}
    />
  )
}
