import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ClipboardCheck, FileCheck2, History, KeyRound, ListChecks, MapPin, Route, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/components/patterns/drawer'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { defaultLanguage } from '@/i18n/config'
import { ApiRequestError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { HandoverRegisterRow } from './handover.contract'
import { useAppendHandoverAmendment, useHandoverChain, useHandoverReceipt } from './handover.query'

type DetailTab = 'overview' | 'handover' | 'return' | 'keys' | 'receipt' | 'amendments'

interface HandoverDetailDrawerProps {
  record: HandoverRegisterRow | null
  onOpenChange: (open: boolean) => void
}

/** Shows one custody record in the canonical operational drawer with vertical evidence tabs. */
export function HandoverDetailDrawer({ record, onOpenChange }: HandoverDetailDrawerProps) {
  const { t, i18n } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const [tab, setTab] = useState<DetailTab>('overview')
  const [reason, setReason] = useState('')
  const handoverId = record?.handoverId ?? null
  const chain = useHandoverChain(handoverId)
  const receipt = useHandoverReceipt(handoverId, chain.data?.handover.phase === 'Returned' && tab === 'receipt')
  const amendment = useAppendHandoverAmendment()
  const locale = i18n.resolvedLanguage ?? i18n.language

  useEffect(() => {
    if (!record) return
    setTab('overview')
    setReason('')
  }, [record?.handoverId]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Appends a reasoned correction against the drawer's current immutable chain revision. */
  async function appendAmendment() {
    if (!reason.trim() || !handoverId || !chain.data) return
    await amendment.mutateAsync({
      handoverId,
      expectedChainRevision: chain.data.chainRevision,
      reason: reason.trim(),
      idempotencyKey: crypto.randomUUID(),
    })
    setReason('')
  }

  const tabs = [
    { value: 'overview', label: t('handover.chain.drawer.tabs.overview'), icon: ClipboardCheck },
    { value: 'handover', label: t('handover.chain.drawer.tabs.handover'), icon: ListChecks },
    { value: 'return', label: t('handover.chain.drawer.tabs.return'), icon: Route },
    { value: 'keys', label: t('handover.chain.drawer.tabs.keys'), icon: KeyRound },
    { value: 'receipt', label: t('handover.chain.drawer.tabs.receipt'), icon: FileCheck2 },
    { value: 'amendments', label: t('handover.chain.drawer.tabs.amendments'), icon: History },
  ] as const

  return (
    <Drawer
      open={record !== null}
      onOpenChange={onOpenChange}
      eyebrow={t('handover.chain.eyebrow')}
      title={record?.bookingNumber ?? ''}
      description={record ? <><bdi>{record.vehicle.plate}</bdi> · {record.driverName}</> : ''}
      headerAccessory={record ? <StatusChip tone={record.returnedAtUtc ? 'ok' : 'info'} label={t(`handover.chain.phases.${record.returnedAtUtc ? 'Returned' : 'Handover'}`)} /> : null}
      width="3xl"
      bodyClassName="space-y-5"
      closeLabel={t('handover.chain.drawer.close')}
    >
      {record && chain.isLoading ? <p className="py-16 text-center text-sm text-muted-foreground">{t('handover.chain.loading')}</p> : null}
      {record && (chain.isError || !chain.data) && !chain.isLoading ? <div role="alert" className="border border-destructive/30 bg-destructive/5 p-4"><p>{t('handover.chain.loadError')}</p><Button className="mt-3" size="sm" variant="secondary" onClick={() => void chain.refetch()}>{t('common.retry')}</Button></div> : null}
      {record && chain.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
            <aside className="h-fit rounded-[3px] border border-border bg-card p-2 sm:sticky sm:top-0">
              <div role="tablist" aria-label={t('handover.chain.drawer.tabsLabel')} className="flex gap-1 overflow-x-auto sm:flex-col">
                {tabs.map((tabDefinition) => {
                  const active = tab === tabDefinition.value
                  const Icon = tabDefinition.icon
                  const unavailable = tabDefinition.value === 'receipt' && chain.data.handover.phase !== 'Returned'
                  return <button key={tabDefinition.value} type="button" role="tab" aria-selected={active} disabled={unavailable} onClick={() => setTab(tabDefinition.value)} className={cn('flex min-h-10 shrink-0 items-center gap-2.5 rounded-[3px] px-2.5 text-start text-sm transition-colors disabled:opacity-45', active ? 'bg-brand-soft font-semibold text-brand' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground')}><span className={cn('grid size-7 shrink-0 place-items-center rounded-full border', active ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-card text-muted-foreground')}><Icon className="size-3.5" aria-hidden="true" /></span>{tabDefinition.label}</button>
                })}
              </div>
            </aside>

            <div className="min-w-0 rounded-[3px] border border-border bg-card p-4 sm:p-5">
              {tab === 'overview' ? <OverviewTab record={record} chain={chain.data} locale={locale} /> : null}
              {tab === 'handover' ? <InspectionTab phase="Handover" chain={chain.data} /> : null}
              {tab === 'return' ? <InspectionTab phase="Return" chain={chain.data} /> : null}
              {tab === 'keys' ? <KeysTab chain={chain.data} locale={locale} /> : null}
              {tab === 'receipt' ? <ReceiptTab loading={receipt.isLoading} failed={receipt.isError} receipt={receipt.data} /> : null}
              {tab === 'amendments' ? <AmendmentsTab chain={chain.data} locale={locale} reason={reason} setReason={setReason} pending={amendment.isPending} error={amendment.error} onAppend={appendAmendment} /> : null}
            </div>
          </div>
          <div className="flex justify-end border-t border-border pt-4"><Button asChild variant="secondary"><Link to={`/${lang}/handover/${record.handoverId}`}>{t('handover.chain.drawer.openFullRecord')}</Link></Button></div>
        </>
      ) : null}
    </Drawer>
  )
}

/** Renders the custody identity and starting/ending readings. */
function OverviewTab({ record, chain, locale }: { record: HandoverRegisterRow; chain: NonNullable<ReturnType<typeof useHandoverChain>['data']>; locale: string }) {
  const { t } = useTranslation()
  const facts = [
    [t('handover.booking'), record.bookingNumber],
    [t('handover.vehicle'), `${record.vehicle.makeCode ?? ''} ${record.vehicle.modelCode ?? ''} · ${record.vehicle.plate}`.trim()],
    [t('handover.driver'), record.driverName],
    [t('handover.startOdometer'), chain.handover.startOdometer],
    [t('handover.endOdometer'), chain.handover.endOdometer ?? t('booking.notAvailable')],
    [t('handover.chain.phase'), t(`handover.chain.phases.${chain.handover.phase}`)],
  ]
  return <section aria-labelledby="custody-overview"><div className="flex items-center justify-between gap-3"><h2 id="custody-overview" className="font-bold">{t('handover.chain.drawer.tabs.overview')}</h2><StatusChip tone={chain.evidenceCompleteness === 'Complete' ? 'ok' : 'warn'} label={t(`handover.chain.completeness.${chain.evidenceCompleteness}`)} /></div><dl className="mt-4 grid gap-3 sm:grid-cols-2">{facts.map(([label, value]) => <div key={label} className="border border-border bg-surface-2 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold"><bdi>{value}</bdi></dd></div>)}</dl><p className="mt-4 text-xs text-muted-foreground">{t('handover.chain.drawer.lastActivity', { time: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.activityAtUtc)) })}</p></section>
}

/** Renders one immutable inspection phase. */
function InspectionTab({ phase, chain }: { phase: 'Handover' | 'Return'; chain: NonNullable<ReturnType<typeof useHandoverChain>['data']> }) {
  const { t } = useTranslation()
  const items = chain.inspections.filter((item) => item.capturePhase === phase)
  return <section aria-labelledby={`inspection-${phase}`}><div className="flex items-center justify-between"><h2 id={`inspection-${phase}`} className="font-bold">{t(`handover.chain.${phase.toLowerCase()}Evidence`)}</h2><span className="eyebrow">{t('handover.chain.items', { count: items.length })}</span></div>{items.length ? <ul className="mt-4 divide-y divide-border border-y border-border">{items.map((item) => <li key={`${phase}-${item.code}`} className="flex items-start gap-3 py-4"><span className={item.verdict === 'Pass' ? 'text-success' : 'text-destructive'}>{item.verdict === 'Pass' ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}</span><div><strong className="text-sm">{t(`handover.capturePage.checks.${item.code}.label`)}</strong><p className="mt-1 text-xs text-muted-foreground">{t(`handover.chain.verdicts.${item.verdict}`)}{item.note ? ` · ${item.note}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">{t('handover.chain.evidenceCount', { count: item.evidenceRefs.length })}</p></div></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{t('handover.chain.noEvidence')}</p>}</section>
}

/** Renders append-only key custody events. */
function KeysTab({ chain, locale }: { chain: NonNullable<ReturnType<typeof useHandoverChain>['data']>; locale: string }) {
  const { t } = useTranslation()
  return <section aria-labelledby="key-history"><h2 id="key-history" className="font-bold">{t('handover.chain.keyHistory')}</h2><div className="mt-4 space-y-3">{chain.keys.map((key) => <article key={key.id} className="border-s-2 border-brand bg-surface-2 p-3"><strong>{t(`handover.chain.keyStates.${key.custodyState}`, { defaultValue: key.custodyState })}</strong><p className="mt-1 text-xs text-muted-foreground"><bdi>{key.keyRef ?? t('booking.notAvailable')}</bdi> · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(key.atUtc))}</p></article>)}</div></section>
}

/** Renders the server-authoritative completion receipt. */
function ReceiptTab({ loading, failed, receipt }: { loading: boolean; failed: boolean; receipt: ReturnType<typeof useHandoverReceipt>['data'] }) {
  const { t } = useTranslation()
  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">{t('handover.chain.drawer.loadingReceipt')}</p>
  if (failed || !receipt) return <p role="alert" className="text-sm text-destructive">{t('handover.chain.drawer.receiptError')}</p>
  return <section aria-labelledby="completion-receipt"><h2 id="completion-receipt" className="font-bold">{t('handover.chain.receipt')}</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><DrawerFact label={t('handover.chain.odometer')} value={`${receipt.odometer.start} → ${receipt.odometer.end} (${receipt.odometer.distanceKm} km)`} /><DrawerFact label={t('handover.chain.fuel')} value={`${receipt.fuel.startEighths}/8 → ${receipt.fuel.endEighths}/8`} /><DrawerFact label={t('handover.chain.key')} value={t(`handover.chain.keyOutcomes.${receipt.key.outcome}`)} /><DrawerFact label={t('handover.chain.damage')} value={t('handover.chain.damageCounts', { carried: receipt.damage.carriedCount, added: receipt.damage.newCount })} /></dl><div className="mt-4 space-y-2 text-sm"><p className="flex items-center gap-2"><MapPin className="size-4" />{t('handover.chain.releaseLocation')}: {receipt.releaseLocation.name ?? t('booking.notAvailable')}</p><p className="flex items-center gap-2"><MapPin className="size-4" />{t('handover.chain.returnLocation')}: {receipt.returnLocation.name ?? t('booking.notAvailable')}</p></div></section>
}

/** Renders amendment history and its append-only correction form. */
function AmendmentsTab({ chain, locale, reason, setReason, pending, error, onAppend }: { chain: NonNullable<ReturnType<typeof useHandoverChain>['data']>; locale: string; reason: string; setReason: (value: string) => void; pending: boolean; error: Error | null; onAppend: () => Promise<void> }) {
  const { t } = useTranslation()
  return <section aria-labelledby="amendments"><h2 id="amendments" className="font-bold">{t('handover.chain.amendments')}</h2>{chain.amendments.length ? <ol className="mt-4 space-y-3">{chain.amendments.map((item) => <li key={item.id} className="border-s-2 border-brand ps-3"><strong>{t('handover.chain.amendmentRevision', { revision: item.revision })}</strong><p className="mt-1 text-sm">{item.reason}</p><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.atUtc))}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">{t('handover.chain.noAmendments')}</p>}<label htmlFor="drawer-handover-amendment" className="mt-5 block text-sm font-bold">{t('handover.chain.amendmentReason')}</label><textarea id="drawer-handover-amendment" className="mt-2 min-h-24 w-full border border-input bg-background p-3" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />{error ? <p role="alert" className="mt-2 text-sm text-destructive">{error instanceof ApiRequestError && error.status === 409 ? t('handover.chain.stale') : t('handover.chain.amendmentError')}</p> : null}<div className="mt-3 flex justify-end"><Button disabled={!reason.trim() || pending} onClick={() => void onAppend()}>{t('handover.chain.appendAmendment')}</Button></div></section>
}

/** Displays one compact receipt fact. */
function DrawerFact({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface-2 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold"><bdi>{value}</bdi></dd></div>
}