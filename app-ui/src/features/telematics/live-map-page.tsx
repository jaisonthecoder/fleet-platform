import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CarFront } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import { DEFAULT_CENTER, MAP_STYLE } from '@/lib/map-style'
import { defaultLanguage } from '@/i18n/config'
import { useFleetLive } from './hooks/use-fleet-live'

/** Fleet live map (M10): scoped vehicle positions from telematics, polled 30s. */
export function LiveMapPage() {
  const { t, i18n } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const navigate = useNavigate()
  const live = useFleetLive()

  const openVehicle = (vehicleId: string) =>
    navigate(`/${lang}/vehicles?vehicle=${vehicleId}`)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const readyRef = useRef(false)

  const SOURCE_ID = 'fleet-live'

  // Initialise the map + clustered source/layers once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
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
    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 15,
      })
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1f3a5f',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16,
            10,
            22,
            50,
            28,
          ],
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'unclustered',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#12805c',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-radius': 7,
        },
      })
      // Zoom into a cluster on click.
      map.on('click', 'clusters', (event) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ['clusters'],
        })[0]
        const clusterId = feature?.properties?.cluster_id as number | undefined
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
        if (clusterId == null || !source) return
        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const geom = feature.geometry
            if (geom.type === 'Point') {
              map.easeTo({
                center: geom.coordinates as [number, number],
                zoom,
              })
            }
          })
          .catch(() => undefined)
      })
      // Open the vehicle drawer on point click (deep-link through registry).
      map.on('click', 'unclustered', (event) => {
        const id = event.features?.[0]?.properties?.vehicleId as
          | string
          | undefined
        if (id) openVehicle(id)
      })
      const pointer = (value: string) => () => {
        map.getCanvas().style.cursor = value
      }
      map.on('mouseenter', 'clusters', pointer('pointer'))
      map.on('mouseleave', 'clusters', pointer(''))
      map.on('mouseenter', 'unclustered', pointer('pointer'))
      map.on('mouseleave', 'unclustered', pointer(''))
      readyRef.current = true
      map.resize()
    })
    requestAnimationFrame(() => map.resize())
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const positions = useMemo(() => live.data ?? [], [live.data])

  // Push the latest online positions into the clustered source.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData({
      type: 'FeatureCollection',
      features: positions
        .filter((p) => p.online && p.lat != null && p.lon != null)
        .map((p) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [p.lon as number, p.lat as number],
          },
          properties: { vehicleId: p.vehicleId, plate: p.plate },
        })),
    })
  }, [positions])

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
                      onClick={() => openVehicle(p.vehicleId)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-surface-hover"
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
