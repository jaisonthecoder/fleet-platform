import { type ReactNode, useEffect, useState } from 'react'
import { Check, Clock3, FileCheck2, ShieldCheck, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EntitlementApprovalsPanel } from './entitlement-approvals-panel'
import type { ApprovalAction, ApprovalWorkItem } from './booking-approvals.contract'
import { useBookingApprovals, useBookingDecision } from './use-booking-approvals'

/** Formats one governed Vehicle display name without lookup fabrication. */
function vehicleName(item: ApprovalWorkItem) {
  return [item.vehicle.makeCode, item.vehicle.modelCode].filter(Boolean).join(' ').replaceAll('_', ' ') || item.vehicle.plate
}

/** Screen 25 live assigned/delegated Booking approval master-detail inbox. */
export function BookingApprovalsPage() {
  const { t, i18n } = useTranslation()
  const approvals = useBookingApprovals()
  const decision = useBookingDecision()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [action, setAction] = useState<ApprovalAction | null>(null)
  const [reason, setReason] = useState('')
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const selected = approvals.data?.find((item) => item.bookingId === selectedId) ?? approvals.data?.[0] ?? null

  useEffect(() => {
    if (!selectedId && approvals.data?.[0]) setSelectedId(approvals.data[0].bookingId)
  }, [approvals.data, selectedId])

  /** Submits a stable decision command and refreshes stale tasks on conflict. */
  async function submitDecision() {
    if (!selected || !action) return
    try {
      setConflictMessage(null)
      await decision.mutateAsync({ item: selected, action, reason: reason.trim() || undefined, idempotencyKey: crypto.randomUUID() })
      setAction(null)
      setReason('')
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        const key = error.reasons?.includes('booking-idempotency-key-reused')
          ? 'duplicate'
          : error.reasons?.includes('workflow-version-conflict')
            ? 'stepChanged'
            : 'stateChanged'
        setConflictMessage(t(`approvals.conflict.${key}`))
        await approvals.refetch()
      }
    }
  }

  if (approvals.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('approvals.loading')}</p>
  if (approvals.isError) return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><h1 className="font-bold">{t('approvals.errorTitle')}</h1><Button className="mt-3" variant="secondary" onClick={() => void approvals.refetch()}>{t('common.retry')}</Button></div>

  return (
    <div className="space-y-5">
      <header><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand">{t('approvals.eyebrow')}</p><h1 className="mt-1 text-[26px] font-bold">{t('approvals.title')}</h1></header>
      <Tabs defaultValue="booking"><TabsList><TabsTrigger value="booking">{t('approvals.bookingTab')}</TabsTrigger><TabsTrigger value="dedicated">{t('approvals.dedicatedTab')}</TabsTrigger></TabsList><TabsContent value="booking" className="pt-4">{approvals.data?.length === 0 ? <div className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('approvals.empty')}</div> : (
        <div className="grid min-h-[620px] border border-border bg-card lg:grid-cols-[340px_1fr]">
          <aside className="border-b border-border lg:border-b-0 lg:border-e" aria-label={t('approvals.queue')}>
            {approvals.data?.map((item) => (
              <button key={item.bookingId} type="button" onClick={() => setSelectedId(item.bookingId)} className={`block w-full border-b border-border p-4 text-start ${selected?.bookingId === item.bookingId ? 'bg-brand/5' : 'hover:bg-muted'}`}>
                <div className="flex justify-between gap-3"><bdi className="font-data font-bold">{item.bookingNumber}</bdi>{item.delegated && <span className="text-xs text-warning">{t('approvals.delegated')}</span>}</div>
                <p className="mt-1 text-sm font-semibold">{vehicleName(item)} · <bdi>{item.vehicle.plate}</bdi></p>
                <p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.pickupAtUtc))}</p>
              </button>
            ))}
          </aside>
          {selected && <main className="flex min-w-0 flex-col">
            <div className="border-b border-border p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-muted-foreground">{t('approvals.requester')}</p><h2 className="text-xl font-bold">{selected.requesterName}</h2></div><bdi className="font-data font-bold">{selected.bookingNumber}</bdi></div></div>
            <div className="grid gap-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Fact label={t('approvals.vehicle')} value={`${vehicleName(selected)} · ${selected.vehicle.plate}`} />
                <Fact label={t('approvals.window')} value={new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).formatRange(new Date(selected.pickupAtUtc), new Date(selected.returnAtUtc))} />
                <Fact label={t('approvals.passengers')} value={selected.passengerCount?.toString() ?? t('approvals.notProvided')} />
                <Fact label={t('approvals.purpose')} value={selected.purpose ?? t('approvals.notProvided')} />
              </div>
              <section><h3 className="mb-3 font-bold">{t('approvals.verdicts')}</h3><div className="grid gap-2 sm:grid-cols-2">
                <Verdict icon={<ShieldCheck />} label={t('approvals.eligibility')} value={t('approvals.verifiedAtConsent')} />
                <Verdict icon={<FileCheck2 />} label={t('approvals.consent')} value={`${t('approvals.signed')} · ${selected.consentVersion}`} />
                <Verdict icon={<Check />} label={t('approvals.conflicts')} value={t('approvals.reservationHeld')} />
                <Verdict icon={<Clock3 />} label={t('approvals.forecast')} value={t('approvals.notAvailable')} />
                <Verdict icon={<Clock3 />} label={t('approvals.sla')} value={selected.dueAtUtc ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.dueAtUtc)) : t('approvals.noSla')} />
              </div></section>
              <p className="border-s-2 border-brand ps-3 text-sm text-muted-foreground">{t('approvals.sod')}</p>
              {action && <div className="border border-border bg-surface-2 p-4"><label className="text-sm font-bold" htmlFor="approval-reason">{t('approvals.reason')}</label><textarea id="approval-reason" className="mt-2 min-h-24 w-full border border-border bg-background p-3" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setAction(null)}>{t('common.cancel')}</Button><Button variant={action === 'decline' ? 'destructive' : 'default'} disabled={(action !== 'approve' && !reason.trim()) || decision.isPending} onClick={() => void submitDecision()}>{t('approvals.confirm')}</Button></div></div>}
              {decision.isError && <p role="alert" className="text-sm text-destructive">{decision.error instanceof ApiRequestError && decision.error.status === 409 ? t('approvals.stale') : t('approvals.actionError')}</p>}
              {conflictMessage && <p role="alert" className="text-sm text-warning">{conflictMessage}</p>}
            </div>
            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border p-4"><Button onClick={() => setAction('approve')}><Check />{t('approvals.approve')}</Button><Button variant="secondary" onClick={() => setAction('request-changes')}>{t('approvals.requestChange')}</Button><Button variant="destructive" onClick={() => setAction('decline')}><X />{t('approvals.decline')}</Button></div>
          </main>}
        </div>
      )}</TabsContent><TabsContent value="dedicated" className="pt-4"><EntitlementApprovalsPanel /></TabsContent></Tabs>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="border border-border bg-surface-2 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div> }
function Verdict({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="flex gap-3 border border-border p-3 text-sm"><span className="text-success">{icon}</span><div><p className="font-bold">{label}</p><p className="text-muted-foreground">{value}</p></div></div> }