import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatusChip } from '@/components/ui/status-chip'
import { defaultLanguage } from '@/i18n/config'
import type {
  HandoverRegisterFilter,
  HandoverRegisterRow,
} from './handover.contract'
import { useHandoverRegister, useHandoverWorkItems } from './handover.query'
import { HandoverDetailDrawer } from './handover-detail-drawer'

const PAGE_SIZE = 5
const FILTERS: HandoverRegisterFilter[] = ['All', 'OnTrip', 'ChargesDamage', 'OnTime']

/** Screen 26 custody register: historical, filterable and append-only. */
export function HandoverRegisterPage() {
  const { t, i18n } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedRecord, setSelectedRecord] = useState<HandoverRegisterRow | null>(null)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const parsedFilter = searchParams.get('filter')
  const filter = FILTERS.includes(parsedFilter as HandoverRegisterFilter)
    ? parsedFilter as HandoverRegisterFilter
    : 'All'
  const parsedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const register = useHandoverRegister({ filter, page, pageSize: PAGE_SIZE })
  const workItems = useHandoverWorkItems()
  const nextHandover = workItems.data?.find((item) => item.phase === 'AwaitingHandover')
  const nextReturn = workItems.data?.find((item) => item.phase === 'ActiveCustody')

  /** Changes one URL-backed register filter and returns to the first page. */
  function selectFilter(nextFilter: HandoverRegisterFilter) {
    setSearchParams(nextFilter === 'All' ? {} : { filter: nextFilter })
  }

  /** Changes the URL-backed register page without losing its active filter. */
  function selectPage(nextPage: number) {
    const next = new URLSearchParams()
    if (filter !== 'All') next.set('filter', filter)
    if (nextPage > 1) next.set('page', String(nextPage))
    setSearchParams(next)
  }

  if (register.isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t('handover.loading')}</p>
  }
  if (register.isError) {
    return (
      <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5">
        <p>{t('handover.loadError')}</p>
        <Button className="mt-3" variant="secondary" onClick={() => void register.refetch()}>
          <RefreshCw />{t('common.retry')}
        </Button>
      </div>
    )
  }

  const data = register.data!
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('handover.registerPage.eyebrow')}
        title={t('handover.title')}
        description={t('handover.subtitle')}
        action={
          <div className="flex flex-wrap gap-2">
            {nextReturn ? (
              <Button asChild variant="railGhost">
                <Link to={`/${lang}/handover/return?bookingId=${nextReturn.bookingId}`}>{t('handover.registerPage.logReturn')}</Link>
              </Button>
            ) : (
              <Button variant="railGhost" disabled>{t('handover.registerPage.logReturn')}</Button>
            )}
            {nextHandover ? (
              <Button asChild variant="signal">
                <Link to={`/${lang}/handover/new?bookingId=${nextHandover.bookingId}`}><Plus />{t('handover.registerPage.newHandover')}</Link>
              </Button>
            ) : (
              <Button variant="signal" disabled><Plus />{t('handover.registerPage.newHandover')}</Button>
            )}
          </div>
        }
      />

      <section className="min-w-0 max-w-full border border-border bg-card shadow-[var(--shadow-rest)]" aria-label={t('handover.register')}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t('handover.registerPage.filtersLabel')}</legend>
            {FILTERS.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? 'default' : 'secondary'}
                aria-pressed={filter === value}
                onClick={() => selectFilter(value)}
              >
                {t(`handover.registerPage.filters.${value}`)}
              </Button>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">{t('handover.registerPage.recordCount', { count: data.total })}</p>
        </div>

        {data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{t('handover.registerPage.empty')}</p>
        ) : (
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-surface-2 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <Header>{t('handover.booking')}</Header>
                  <Header>{t('handover.driver')}</Header>
                  <Header>{t('handover.vehicle')}</Header>
                  <Header>{t('handover.registerPage.issuedReturned')}</Header>
                  <Header>{t('handover.registerPage.km')}</Header>
                  <Header>{t('handover.registerPage.charges')}</Header>
                  <Header>{t('handover.registerPage.status')}</Header>
                  <Header ariaLabel={t('handover.registerPage.actions')} />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <RegisterRows
                    key={item.bookingId}
                    item={item}
                    locale={locale}
                    lang={lang}
                    onView={setSelectedRecord}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 p-4 text-xs text-muted-foreground">
          <span>{t('handover.registerPage.pageInfo', { page: data.page, pages: Math.max(1, data.totalPages), count: data.items.length, total: data.total })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => selectPage(data.page - 1)}>{t('handover.registerPage.previous')}</Button>
            <Button size="sm" variant="secondary" disabled={data.page >= data.totalPages} onClick={() => selectPage(data.page + 1)}>{t('handover.registerPage.next')}</Button>
          </div>
        </footer>
      </section>
      <p className="text-xs text-muted-foreground">{t('handover.registerPage.appendOnlyNote')}</p>
      <HandoverDetailDrawer record={selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null) }} />
    </div>
  )
}

function RegisterRows({ item, locale, lang, onView }: {
  item: HandoverRegisterRow
  locale: string
  lang: string
  onView: (item: HandoverRegisterRow) => void
}) {
  const { t } = useTranslation()
  const vehicleName = [item.vehicle.makeCode, item.vehicle.modelCode].filter(Boolean).join(' ').replaceAll('_', ' ') || item.vehicle.plate
  const issued = item.issuedAtUtc ? formatShort(item.issuedAtUtc, locale) : t('booking.notAvailable')
  const returned = item.returnedAtUtc ? formatShort(item.returnedAtUtc, locale) : '—'
  const charge = item.chargeSummary.status === 'AVAILABLE'
    ? [item.chargeSummary.currency, item.chargeSummary.amount].filter(Boolean).join(' ')
    : item.chargeSummary.labels.length
      ? item.chargeSummary.labels.join(' · ')
      : t('handover.registerPage.none')
  return (
    <>
      <tr className="border-t border-border first:border-t-0">
        <Cell><bdi className="font-data font-bold text-brand">{item.bookingNumber}</bdi></Cell>
        <Cell><strong>{item.driverName}</strong></Cell>
        <Cell><strong className="block">{vehicleName}</strong><bdi className="font-data text-xs text-muted-foreground">{item.vehicle.plate}</bdi></Cell>
        <Cell><span className="font-data text-xs"><bdi>{issued}</bdi> → <bdi>{returned}</bdi></span></Cell>
        <Cell><bdi className="font-data">{item.distanceKm ?? '—'}</bdi></Cell>
        <Cell><span className={item.chargeSummary.status === 'AVAILABLE' ? 'text-warning' : 'text-muted-foreground'}>{charge}</span></Cell>
        <Cell><RegisterStatus item={item} /></Cell>
        <Cell>
          <div className="flex justify-end gap-2">
            {item.handoverId && <Button size="sm" variant="secondary" onClick={() => onView(item)}>{t('handover.registerPage.view')}</Button>}
            {item.capabilities.editOpenCustody || item.capabilities.returnVehicle ? (
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/${lang}/handover/return?bookingId=${item.bookingId}`}>{t('handover.registerPage.edit')}</Link>
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled>{t('handover.registerPage.locked')}</Button>
            )}
          </div>
        </Cell>
      </tr>
    </>
  )
}

function RegisterStatus({ item }: { item: HandoverRegisterRow }) {
  const { t } = useTranslation()
  const tone = item.primaryStatus === 'ON_TIME' ? 'ok'
    : item.primaryStatus === 'ON_TRIP' ? 'info'
      : item.primaryStatus === 'DAMAGE_REVIEW' || item.primaryStatus === 'KEY_REVIEW' ? 'danger'
        : 'warn'
  return <StatusChip tone={tone} label={t(`handover.registerPage.signals.${item.primaryStatus}`)} />
}

function Header({ children, ariaLabel }: { children?: React.ReactNode; ariaLabel?: string }) {
  return <th scope="col" aria-label={ariaLabel} className="px-4 py-3 text-start">{children}</th>
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>
}

function formatShort(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
