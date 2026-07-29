import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DEFAULT_CENTER, MAP_STYLE } from '@/lib/map-style'
import { reverseGeocode } from './geocoding'

interface Props {
  latitude: number | null
  longitude: number | null
  onChange: (location: {
    latitude: number
    longitude: number
    address?: string
  }) => void
  label?: string
}

/**
 * Interactive location picker: click the map to drop/move a marker and capture
 * the coordinates. Stays in sync when the coordinate fields are edited manually.
 */
export function LocationPicker({ latitude, longitude, onChange, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const hasPoint = latitude != null && longitude != null
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: hasPoint ? [longitude as number, latitude as number] : DEFAULT_CENTER,
      zoom: hasPoint ? 12 : 9,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (event) => {
      const latitude = Number(event.lngLat.lat.toFixed(6))
      const longitude = Number(event.lngLat.lng.toFixed(6))
      onChangeRef.current({ latitude, longitude })
      void reverseGeocode(latitude, longitude).then((resolved) => {
        if (resolved) onChangeRef.current({ latitude, longitude, address: resolved.address })
      })
    })
    map.on('load', () => map.resize())
    requestAnimationFrame(() => map.resize())
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; coordinate sync lives in the effect below.
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (latitude == null || longitude == null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const lngLat: [number, number] = [longitude, latitude]
    if (markerRef.current) markerRef.current.setLngLat(lngLat)
    else markerRef.current = new maplibregl.Marker({ color: '#0b3d5c' }).setLngLat(lngLat).addTo(map)
    // Point the map at the coordinates (e.g. after an address is geocoded).
    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 13), duration: 600 })
  }, [latitude, longitude])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={label ?? 'Location map'}
      className="h-56 w-full overflow-hidden rounded-[3px] border border-border"
    />
  )
}
