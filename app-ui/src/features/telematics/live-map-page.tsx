import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CarFront } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import { DEFAULT_CENTER, MAP_STYLE } from '@/lib/map-style'
import { defaultLanguage } from '@/i18n/config'
import { useFleetLive } from './hooks/use-fleet-live'
import type { LiveFleetPosition } from './live-map.contract'

/** Fleet live map (M10): scoped vehicle positions from telematics, polled 30s. */
export function LiveMapPage() {
  const { t, i18n } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const live = useFleetLive()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const markers = markersRef.current
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 9,
    })
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    )
    map.on('load', () => map.resize())
    requestAnimationFrame(() => map.resize())
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markers.clear()
    }
  }, [])

  const positions = useMemo(() => live.data ?? [], [live.data])

  // Sync markers with the latest online positions.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    positions
      .filter((p) => p.online && p.lat != null && p.lon != null)
      .forEach((p) => {
        seen.add(p.vehicleId)
        const lngLat: [number, number] = [p.lon as number, p.lat as number]
        const existing = markersRef.current.get(p.vehicleId)
        if (existing) {
          existing.setLngLat(lngLat)
          return
        }
        const element = document.createElement('div')
        element.className =
          'size-3.5 rounded-full border-2 border-white bg-success shadow'
        element.setAttribute('aria-label', p.plate)
        const marker = new maplibregl.Marker({ element })
          .setLngLat(lngLat)
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(p.plate))
          .addTo(map)
        markersRef.current.set(p.vehicleId, marker)
      })
    // Drop markers for vehicles no longer online/present.
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })
  }, [positions])

  const flyTo = (p: LiveFleetPosition) => {
    if (p.lat == null || p.lon == null) return
    mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 14, duration: 600 })
    markersRef.current.get(p.vehicleId)?.togglePopup()
  }

  const online = positions.filter((p) => p.online)
  const offline = positions.filter((p) => !p.online)
  const ordered = [...online, ...offline]

  const lastSeen = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
          new Date(iso),
        )
      : t('liveMap.never')

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('liveMap.eyebrow')}
        title={t('liveMap.title')}
        action={
          <Button asChild variant="railGhost">
            <Link to={`/${lang}/vehicles`}>{t('liveMap.registry')}</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="font-semibold">{t('liveMap.vehicles')}</h2>
              <span className="text-xs text-muted-foreground">
                {t('liveMap.onlineCount', {
                  online: online.length,
                  total: positions.length,
                })}
              </span>
            </div>

            {live.isPending ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t('liveMap.loading')}
              </p>
            ) : live.isError ? (
              <p className="p-4 text-sm text-destructive">{t('liveMap.error')}</p>
            ) : ordered.length === 0 ? (
              <div className="grid justify-items-center gap-2 p-8 text-center">
                <CarFront
                  aria-hidden="true"
                  className="size-7 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  {t('liveMap.empty')}
                </p>
              </div>
            ) : (
              <ul className="max-h-[62vh] divide-y divide-border overflow-y-auto">
                {ordered.map((p) => (
                  <li key={p.vehicleId}>
                    <button
                      type="button"
                      onClick={() => flyTo(p)}
                      disabled={!p.online}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-surface-hover disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          <bdi>{p.plate}</bdi>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {p.online && p.speed != null
                            ? t('liveMap.speed', { value: Math.round(p.speed) })
                            : t('liveMap.lastSeen', { value: lastSeen(p.at) })}
                        </span>
                      </span>
                      <StatusChip
                        tone={p.online ? 'ok' : 'neutral'}
                        label={t(p.online ? 'liveMap.online' : 'liveMap.offline')}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div
          ref={containerRef}
          role="region"
          aria-label={t('liveMap.mapLabel')}
          className="h-[68vh] overflow-hidden rounded-[3px] border border-border"
        />
      </div>

      <p className="text-xs text-muted-foreground">{t('liveMap.masked')}</p>
    </div>
  )
}
