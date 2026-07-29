import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CarFront, CheckCircle2, RefreshCw, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useScope } from '@/app/providers/scope-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/features/auth/auth-context'
import { hasAnyRole } from '@/features/auth/roles'
import {
  getEntitlementInventory,
  getEntitlementReconciliation,
  getOperationsOverview,
} from './operations.contract'

const INVENTORY_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'Executive', 'InternalAudit', 'SystemAdmin'] as const
const RECONCILIATION_ROLES = ['InternalAudit', 'SystemAdmin'] as const
const DETAILED_OPERATIONS_ROLES = ['FleetManager', 'ClusterFleetLead', 'GroupFleetLead'] as const

/** Formats a live timestamp in the active locale. */
function formatTimestamp(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

/** Renders live operational and Dedicated read models under role and scope boundaries. */
export function OperationsPage() {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const { selectedScopeId } = useScope()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const canReadInventory = hasAnyRole(me, [...INVENTORY_ROLES])
  const canReconcile = hasAnyRole(me, [...RECONCILIATION_ROLES])
  const canReadOperationalDetails = hasAnyRole(me, [...DETAILED_OPERATIONS_ROLES])
  const overview = useQuery({
    queryKey: ['operations', 'overview', selectedScopeId],
    queryFn: () => getOperationsOverview(selectedScopeId),
  })
  const inventory = useQuery({
    queryKey: ['operations', 'entitlement-inventory', selectedScopeId],
    queryFn: () => getEntitlementInventory(selectedScopeId),
    enabled: canReadInventory,
  })
  const reconciliation = useQuery({
    queryKey: ['entitlements', 'reconciliation'],
    queryFn: getEntitlementReconciliation,
    enabled: canReconcile,
  })

  if (overview.isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t('operations.loading')}</p>
  }
  if (overview.isError || !overview.data) {
    return (
      <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5">
        <p>{t('operations.error')}</p>
        <Button className="mt-3" variant="secondary" onClick={() => void overview.refetch()}>
          <RefreshCw />
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const summary = overview.data.summary
  const availability = overview.data.availability
  const summaryMetrics: Array<[string, number, LucideIcon]> = [
    ['availableVehicles', summary.availableVehicles, CarFront],
    ['bookingsToday', summary.bookingsToday, CalendarClock],
    ['activeBookings', summary.activeBookings, CheckCircle2],
    ['attentionCount', summary.attentionCount, AlertTriangle],
  ]
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('operations.eyebrow')}
        title={t('operations.title')}
        description={t('operations.subtitle')}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-3 text-sm text-muted-foreground">
        <span>{t(overview.data.scope.id === 'all' ? 'operations.scope.all' : 'operations.scope.scoped')}</span>
        <span>{t('operations.generated', { time: formatTimestamp(overview.data.generatedAt, locale) })}</span>
      </div>

      <section aria-labelledby="operations-summary-title">
        <h2 id="operations-summary-title" className="mb-3 text-base font-bold">{t('operations.summary')}</h2>
        <div className="grid border border-border bg-card sm:grid-cols-2 xl:grid-cols-4">
          {summaryMetrics.map(([key, value, Icon], index) => (
            <div key={String(key)} className={`p-4 ${index ? 'border-t border-border sm:border-s sm:border-t-0' : ''}`}>
              <Icon className="mb-3 size-5 text-brand" />
              <p className="text-2xl font-bold tabular-nums">{Number(value).toLocaleString(locale)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(`operations.metrics.${key}`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        {canReadOperationalDetails && (<>
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">{t('operations.availability')}</h2>
            <span className="text-sm font-bold">{summary.utilizationPercent.toLocaleString(locale)}%</span>
          </div>
          <Progress className="mt-3" value={summary.utilizationPercent} />
          <div className="mt-5 grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {(['available', 'inUse', 'reserved', 'unavailable'] as const).map((key) => (
              <div key={key} className="bg-card p-3">
                <p className="text-lg font-bold tabular-nums">{availability[key].toLocaleString(locale)}</p>
                <p className="text-xs text-muted-foreground">{t(`operations.availabilityStates.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <h2 className="font-bold">{t('operations.attention')}</h2>
          {!overview.data.attentionItems.length ? (
            <p className="mt-4 text-sm text-muted-foreground">{t('operations.noAttention')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {overview.data.attentionItems.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm">
                      {item.kind === 'access-block'
                        ? t('operations.attentionItems.accessBlock', { count: item.count ?? 0 })
                        : t(`operations.attentionItems.${item.status === 'Expired' ? 'complianceExpired' : 'complianceExpiring'}`, { itemType: item.itemType ?? '' })}
                    </strong>
                    <Badge variant={item.level === 'danger' ? 'destructive' : 'secondary'}>
                      {t(`operations.levels.${item.level}`)}
                    </Badge>
                  </div>
                  {item.subjectLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <bdi>{item.subjectLabel}</bdi>
                      {item.expiryDate ? ` · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${item.expiryDate}T00:00:00Z`))}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        </>)}
      </section>

      {canReadOperationalDetails && <section className="border border-border bg-card p-5" aria-labelledby="upcoming-bookings-title">
        <h2 id="upcoming-bookings-title" className="font-bold">{t('operations.upcoming.title')}</h2>
        {!overview.data.upcomingBookings.length ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('operations.upcoming.empty')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {overview.data.upcomingBookings.map((booking) => (
              <li key={booking.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[72px_1fr_auto_auto] sm:items-center">
                <time className="font-bold tabular-nums">{booking.time}</time>
                <span>{booking.route}</span>
                <bdi className="text-muted-foreground">{booking.plate}</bdi>
                <Badge variant="secondary">{t(`operations.upcoming.status.${booking.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>}

      {canReadInventory && (
        <section className="border border-border bg-card p-5" aria-labelledby="dedicated-health-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="dedicated-health-title" className="font-bold">{t('operations.dedicated.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('operations.dedicated.subtitle')}</p>
            </div>
            {inventory.isError && <Button size="sm" variant="secondary" onClick={() => void inventory.refetch()}>{t('common.retry')}</Button>}
          </div>
          {inventory.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">{t('operations.dedicated.loading')}</p>
          ) : inventory.isError || !inventory.data ? (
            <p role="alert" className="mt-4 text-sm text-destructive">{t('operations.dedicated.error')}</p>
          ) : (
            <div className="mt-4 grid gap-px bg-border sm:grid-cols-3 xl:grid-cols-7">
              {(['allocated', 'pendingApproval', 'awaitingConsent', 'returned', 'expired', 'bsdActive', 'bsdConflict'] as const).map((key) => (
                <div key={key} className="bg-card p-3">
                  <p className="text-xl font-bold tabular-nums">{inventory.data[key].toLocaleString(locale)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`operations.dedicated.metrics.${key}`)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {canReconcile && (
        <section className="border border-border bg-card p-5" aria-labelledby="reconciliation-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="reconciliation-title" className="font-bold">{t('operations.reconciliation.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('operations.reconciliation.subtitle')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void reconciliation.refetch()} disabled={reconciliation.isFetching}>
              <RefreshCw />
              {t('operations.reconciliation.refresh')}
            </Button>
          </div>
          {reconciliation.isError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">{t('operations.reconciliation.error')}</p>
          ) : reconciliation.data?.findingCount === 0 ? (
            <p className="mt-4 text-sm text-success">{t('operations.reconciliation.clear')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {reconciliation.data?.findings.map((finding) => (
                <li key={`${finding.reasonCode}:${finding.entitlementRef}`} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">{t(`operations.reconciliation.reasons.${finding.reasonCode}`)}</strong>
                    <Badge variant="secondary">{t(`operations.reconciliation.owners.${finding.recommendedOwner}`)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground"><bdi>{finding.entitlementRef}</bdi></p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
