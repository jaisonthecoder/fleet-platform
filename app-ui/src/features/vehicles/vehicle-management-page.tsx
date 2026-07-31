import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CarFront,
  Download,
  Import,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusChip } from '@/components/ui/status-chip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { defaultLanguage } from '@/i18n/config'
import { notify } from '@/hooks/use-toast'
import { fetchVehicle, fetchVehiclesCsv, type Vehicle } from './vehicle.contract'
import { useVehicles, useVehicleSummary } from './hooks/use-vehicles'
import { VehicleDetailDrawer } from './vehicle-detail-drawer'

const lifecycleBadge = (status: string) => {
  if (status === 'Active') return 'success' as const
  if (status === 'UnderMaintenance' || status === 'OffHirePending') {
    return 'warning' as const
  }
  if (status === 'Decommissioned' || status === 'Sold') {
    return 'destructive' as const
  }
  return 'secondary' as const
}

/** Renders one localized date without changing server-owned date semantics. */
function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`))
}

/** Compliance state for a document expiry (missing / expired / valid). */
function complianceState(value: string | null): {
  tone: 'ok' | 'danger' | 'neutral'
  key: 'valid' | 'expired' | 'missing'
} {
  if (!value) return { tone: 'neutral', key: 'missing' }
  if (value < new Date().toISOString().slice(0, 10))
    return { tone: 'danger', key: 'expired' }
  return { tone: 'ok', key: 'valid' }
}

/** GPS status → StatusChip tone. */
function gpsTone(status: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (status === 'Online') return 'ok'
  if (status === 'Installed') return 'info'
  if (status === 'Faulty' || status === 'UnderReplacement') return 'danger'
  if (status === 'Offline') return 'warn'
  return 'neutral'
}

/** A compliance status chip + its expiry date, for listing table cells. */
function ComplianceCell({
  value,
  locale,
  t,
}: {
  value: string | null
  locale: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const state = complianceState(value)
  return (
    <div className="space-y-1">
      <StatusChip
        tone={state.tone}
        label={t(`vehicleManagement.detail.compliance.${state.key}`)}
      />
      <p className="text-xs text-muted-foreground">{formatDate(value, locale)}</p>
    </div>
  )
}

/** The scoped Vehicle Management registry and parent surface for Vehicle actions. */
export function VehicleManagementPage() {
  const { t, i18n } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('createdAt:desc')
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [exporting, setExporting] = useState(false)
  const [blockedOnly, setBlockedOnly] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandled = useRef<string | null>(null)
  const deferredSearch = useDeferredValue(search.trim())
  // Deep-link: ?vehicle=<id> (e.g. live-map click-through) opens the drawer.
  useEffect(() => {
    const id = searchParams.get('vehicle')
    if (!id || deepLinkHandled.current === id) return
    deepLinkHandled.current = id
    void fetchVehicle(id)
      .then((vehicle) => setSelected(vehicle))
      .catch(() => notify.danger(t('vehicleManagement.deepLinkFailed')))
      .finally(() =>
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('vehicle')
            return next
          },
          { replace: true },
        ),
      )
  }, [searchParams, setSearchParams, t])
  useEffect(() => {
    setPageNum(1)
  }, [deferredSearch, sort, pageSize])
  const vehicles = useVehicles({
    search: deferredSearch || undefined,
    sort,
    page: pageNum,
    pageSize,
  })
  const summary = useVehicleSummary()
  const data = vehicles.data?.items ?? []
  const rows = blockedOnly
    ? data.filter(
        (v) =>
          complianceState(v.mulkiyaExpiry).key !== 'valid' ||
          complianceState(v.insuranceExpiry).key !== 'valid',
      )
    : data
  const total = vehicles.data?.total ?? data.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // Tiles reflect the full authorized scope (server summary).
  const s = summary.data
  const metrics = [
    ['total', s?.total ?? total],
    ['available', s?.active ?? 0],
    ['inUse', s?.inUse ?? 0],
    ['maintenance', s?.maintenance ?? 0],
    ['blocked', s?.blocked ?? 0],
  ] as const

  const toggleSort = (field: string) =>
    setSort((current) => {
      const [currentField, dir] = current.split(':')
      if (currentField !== field) return `${field}:asc`
      return dir === 'asc' ? `${field}:desc` : `${field}:asc`
    })

  const SortIcon = ({ field }: { field: string }) => {
    const [currentField, dir] = sort.split(':')
    if (currentField !== field)
      return (
        <ArrowUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      )
    return dir === 'asc' ? (
      <ArrowUp className="size-3.5" aria-hidden="true" />
    ) : (
      <ArrowDown className="size-3.5" aria-hidden="true" />
    )
  }

  const onExport = async () => {
    setExporting(true)
    try {
      const csv = await fetchVehiclesCsv({
        search: deferredSearch || undefined,
        sort,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'vehicles.csv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      notify.danger(t('vehicleManagement.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
    >
      {label}
      <SortIcon field={field} />
    </button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('vehicleManagement.eyebrow')}
        title={t('vehicleManagement.title')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="railGhost">
              <Link to={`/${lang}/vehicles/import`}>
                <Import aria-hidden="true" />
                {t('vehicleManagement.import')}
              </Link>
            </Button>
            <Button asChild variant="signal">
              <Link to={`/${lang}/vehicles/onboard`}>
                <Plus aria-hidden="true" />
                {t('vehicleManagement.onboard')}
              </Link>
            </Button>
          </div>
        }
      />

      <section
        aria-label={t('vehicleManagement.summary')}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {metrics.map(([key, value]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t(`vehicleManagement.metrics.${key}`)}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`vehicleManagement.metrics.${key}Hint`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-semibold">
                {t('vehicleManagement.allVehicles')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('vehicleManagement.resultCount', { count: total })}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <label className="relative w-full sm:w-72">
                <span className="sr-only">{t('vehicleManagement.search')}</span>
                <Search
                  aria-hidden="true"
                  className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('vehicleManagement.search')}
                  className="ps-9"
                />
              </label>
              <Button
                variant={blockedOnly ? 'default' : 'secondary'}
                aria-pressed={blockedOnly}
                onClick={() => setBlockedOnly((v) => !v)}
              >
                <ShieldAlert aria-hidden="true" />
                {t('vehicleManagement.blockedOnly')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void onExport()}
                disabled={exporting}
              >
                <Download aria-hidden="true" />
                {exporting
                  ? t('vehicleManagement.exporting')
                  : t('vehicleManagement.export')}
              </Button>
            </div>
          </div>

          {vehicles.isPending ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t('vehicleManagement.loading')}
            </div>
          ) : vehicles.isError ? (
            <Alert tone="danger" className="m-4 w-auto">
              <AlertTitle>{t('vehicleManagement.errorTitle')}</AlertTitle>
              <AlertDescription>
                {t('vehicleManagement.errorBody')}
              </AlertDescription>
            </Alert>
          ) : rows.length === 0 ? (
            <div className="grid justify-items-center gap-2 p-10 text-center">
              <CarFront
                aria-hidden="true"
                className="size-8 text-muted-foreground"
              />
              <p className="font-semibold">
                {t('vehicleManagement.emptyTitle')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('vehicleManagement.emptyBody')}
              </p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton
                      field="plate"
                      label={t('vehicleManagement.columns.vehicle')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      field="node"
                      label={t('vehicleManagement.columns.node')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      field="lifecycle"
                      label={t('vehicleManagement.columns.lifecycle')}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      field="operational"
                      label={t('vehicleManagement.columns.operational')}
                    />
                  </TableHead>
                  <TableHead>{t('vehicleManagement.columns.gps')}</TableHead>
                  <TableHead>
                    <SortButton
                      field="mulkiyaExpiry"
                      label={t('vehicleManagement.columns.mulkiya')}
                    />
                  </TableHead>
                  <TableHead>
                    {t('vehicleManagement.columns.insurance')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((vehicle: Vehicle) => {
                  const nodeName =
                    i18n.resolvedLanguage === 'ar'
                      ? vehicle.hierarchyNodeNameAr
                      : vehicle.hierarchyNodeName
                  return (
                    <TableRow
                      key={vehicle.id}
                      onClick={() => setSelected(vehicle)}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="button"
                      aria-label={t('vehicleManagement.openDetail', {
                        plate: vehicle.plate,
                      })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelected(vehicle)
                        }
                      }}
                    >
                      <TableCell>
                        <p className="font-semibold">
                          {[vehicle.makeCode, vehicle.modelCode]
                            .filter(Boolean)
                            .join(' ') || vehicle.bodyTypeCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <bdi>{vehicle.plate}</bdi>
                          {' · '}
                          {vehicle.lastConfirmedOdometer
                            ? t('vehicleManagement.kilometres', {
                                value: new Intl.NumberFormat(
                                  i18n.language,
                                ).format(Number(vehicle.lastConfirmedOdometer)),
                              })
                            : t('vehicleManagement.odometerUnavailable')}
                        </p>
                      </TableCell>
                      <TableCell>
                        {nodeName ?? t('vehicleManagement.unassigned')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={lifecycleBadge(vehicle.lifecycleStatus)}
                        >
                          {t(
                            `vehicleManagement.status.${vehicle.lifecycleStatus}`,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {vehicle.operationalStatus ? (
                          <StatusChip
                            tone="neutral"
                            label={t(
                              `vehicleManagement.status.${vehicle.operationalStatus}`,
                            )}
                          />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          tone={gpsTone(vehicle.gpsStatus)}
                          label={t(
                            `vehicleManagement.status.${vehicle.gpsStatus}`,
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <ComplianceCell
                          value={vehicle.mulkiyaExpiry}
                          locale={i18n.language}
                          t={t}
                        />
                      </TableCell>
                      <TableCell>
                        <ComplianceCell
                          value={vehicle.insuranceExpiry}
                          locale={i18n.language}
                          t={t}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{t('vehicleManagement.perPage')}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => setPageSize(Number(value))}
                >
                  <SelectTrigger className="h-8 w-20" aria-label={t('vehicleManagement.perPage')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>
                  {t('vehicleManagement.pageInfo', {
                    page: pageNum,
                    pages: totalPages,
                    total,
                  })}
                </span>
              </div>
              {totalPages > 1 ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pageNum <= 1}
                    onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                  >
                    {t('vehicleManagement.prev')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pageNum >= totalPages}
                    onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                  >
                    {t('vehicleManagement.next')}
                  </Button>
                </div>
              ) : null}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <VehicleDetailDrawer
        vehicle={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onUpdated={(vehicle) => setSelected(vehicle)}
      />
    </div>
  )
}
