import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FileCheck2, History, KeyRound, MapPin, RefreshCw, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { defaultLanguage } from '@/i18n/config'
import { ApiRequestError } from '@/lib/api-client'
import { useAppendHandoverAmendment, useHandoverChain, useHandoverReceipt } from './handover.query'

/** Full append-only issue-to-return chain, receipt and amendment surface. */
export function HandoverChainPage() {
  const { t, i18n } = useTranslation()
  const { lang = defaultLanguage, handoverId } = useParams()
  const chain = useHandoverChain(handoverId ?? null)
  const receipt = useHandoverReceipt(handoverId ?? null, chain.data?.handover.phase === 'Returned')
  const amendment = useAppendHandoverAmendment()
  const [reason, setReason] = useState('')
  const locale = i18n.resolvedLanguage ?? i18n.language

  if (!handoverId) return <ChainError message={t('handover.chain.invalid')} />
  if (chain.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('handover.chain.loading')}</p>
  if (chain.isError || !chain.data) return <ChainError message={t('handover.chain.loadError')} onRetry={() => void chain.refetch()} />
  const data = chain.data

  /** Appends one reasoned correction against the current chain revision. */
  async function append() {
    if (!reason.trim() || !handoverId) return
    await amendment.mutateAsync({ handoverId, expectedChainRevision: data.chainRevision, reason: reason.trim(), idempotencyKey: crypto.randomUUID() })
    setReason('')
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={`/${lang}/handover`} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{t('handover.chain.back')}</Link>
          <p className="eyebrow">{t('handover.chain.eyebrow')}</p>
          <h1 className="mt-1 text-2xl font-bold">{t('handover.chain.title')}</h1>
        </div>
        <StatusChip tone={data.evidenceCompleteness === 'Complete' ? 'ok' : 'warn'} label={t(`handover.chain.completeness.${data.evidenceCompleteness}`)} />
      </header>

      <section className="rounded-[3px] bg-brand p-5 text-brand-foreground">
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <Fact label={t('handover.booking')} value={data.handover.bookingId} />
          <Fact label={t('handover.vehicle')} value={data.handover.vehicleId} />
          <Fact label={t('handover.driver')} value={data.handover.driverPersonId} />
          <Fact label={t('handover.chain.phase')} value={t(`handover.chain.phases.${data.handover.phase}`)} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['Handover', 'Return'] as const).map((phase) => {
          const items = data.inspections.filter((item) => item.capturePhase === phase)
          return <section key={phase} className="border border-border bg-card"><div className="flex items-center justify-between border-b border-border p-4"><h2 className="font-bold">{t(`handover.chain.${phase.toLowerCase()}Evidence`)}</h2><span className="eyebrow">{t('handover.chain.items', { count: items.length })}</span></div>{items.length ? <ul className="divide-y divide-border">{items.map((item) => <li key={`${phase}-${item.code}`} className="flex items-start gap-3 p-4"><span className={item.verdict === 'Pass' ? 'text-success' : 'text-destructive'}>{item.verdict === 'Pass' ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}</span><div><strong className="text-sm">{t(`handover.capturePage.checks.${item.code}.label`)}</strong><p className="mt-1 text-xs text-muted-foreground">{t(`handover.chain.verdicts.${item.verdict}`)}{item.note ? ` · ${item.note}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">{t('handover.chain.evidenceCount', { count: item.evidenceRefs.length })}</p></div></li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">{t('handover.chain.noEvidence')}</p>}</section>
        })}
      </div>

      <section className="border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold"><KeyRound className="size-4" />{t('handover.chain.keyHistory')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.keys.map((key) => <article key={key.id} className="border border-border bg-surface-2 p-3"><strong>{t(`handover.chain.keyStates.${key.custodyState}`, { defaultValue: key.custodyState })}</strong><p className="mt-1 text-xs text-muted-foreground"><bdi>{key.keyRef ?? t('booking.notAvailable')}</bdi> · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(key.atUtc))}</p></article>)}
        </div>
      </section>

      {receipt.data && <Receipt value={receipt.data} />}

      <section className="border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-bold"><History className="size-4" />{t('handover.chain.amendments')}</h2>
        {data.amendments.length ? <ol className="mt-4 space-y-3">{data.amendments.map((item) => <li key={item.id} className="border-s-2 border-brand ps-3"><strong>{t('handover.chain.amendmentRevision', { revision: item.revision })}</strong><p className="mt-1 text-sm">{item.reason}</p><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.atUtc))}</time></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">{t('handover.chain.noAmendments')}</p>}
        <label htmlFor="handover-amendment" className="mt-5 block text-sm font-bold">{t('handover.chain.amendmentReason')}</label>
        <textarea id="handover-amendment" className="mt-2 min-h-24 w-full border border-input bg-background p-3" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        {amendment.isError && <p role="alert" className="mt-2 text-sm text-destructive">{amendment.error instanceof ApiRequestError && amendment.error.status === 409 ? t('handover.chain.stale') : t('handover.chain.amendmentError')}</p>}
        <div className="mt-3 flex justify-end"><Button disabled={!reason.trim() || amendment.isPending} onClick={() => void append()}>{t('handover.chain.appendAmendment')}</Button></div>
      </section>
    </div>
  )
}

function Receipt({ value }: { value: NonNullable<ReturnType<typeof useHandoverReceipt>['data']> }) {
  const { t } = useTranslation()
  return <section className="border border-border bg-card p-5"><h2 className="flex items-center gap-2 font-bold"><FileCheck2 className="size-4" />{t('handover.chain.receipt')}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReceiptFact label={t('handover.chain.odometer')} value={`${value.odometer.start} → ${value.odometer.end} (${value.odometer.distanceKm} km)`} status={value.odometer.verdict} /><ReceiptFact label={t('handover.chain.fuel')} value={`${value.fuel.startEighths}/8 → ${value.fuel.endEighths}/8`} status={value.fuel.verdict} /><ReceiptFact label={t('handover.chain.key')} value={t(`handover.chain.keyOutcomes.${value.key.outcome}`)} status={value.key.outcome === 'Returned' ? 'MATCHED' : 'ADVISORY'} /><ReceiptFact label={t('handover.chain.damage')} value={t('handover.chain.damageCounts', { carried: value.damage.carriedCount, added: value.damage.newCount })} status={value.damage.reviewRequired ? 'ADVISORY' : 'MATCHED'} /></div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><span className="inline-flex items-center gap-2"><MapPin className="size-4" />{t('handover.chain.releaseLocation')}: {value.releaseLocation.name ?? t('booking.notAvailable')}</span><span className="inline-flex items-center gap-2"><MapPin className="size-4" />{t('handover.chain.returnLocation')}: {value.returnLocation.name ?? t('booking.notAvailable')}</span></div></section>
}
function ReceiptFact({ label, value, status }: { label: string; value: string; status: string }) { return <div className="border border-border bg-surface-2 p-3"><p className="text-xs text-muted-foreground">{label}</p><strong className="mt-1 block text-sm">{value}</strong><span className={status === 'MATCHED' ? 'text-xs text-success' : status === 'CONFLICT' ? 'text-xs text-destructive' : 'text-xs text-warning'}>{status}</span></div> }
function Fact({ label, value }: { label: string; value: string }) { return <div><span className="text-xs text-brand-foreground/60">{label}</span><strong className="mt-1 block"><bdi>{value}</bdi></strong></div> }
function ChainError({ message, onRetry }: { message: string; onRetry?: () => void }) { const { t } = useTranslation(); return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p>{message}</p>{onRetry && <Button className="mt-3" variant="secondary" onClick={onRetry}><RefreshCw />{t('common.retry')}</Button>}</div> }
