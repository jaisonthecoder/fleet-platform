import { type ReactNode, useEffect, useState } from 'react'
import { Check, Clock3, FileCheck2, ShieldCheck, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
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
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const selected = approvals.data?.find((item) => item.bookingId === selectedId) ?? approvals.data?.[0] ?? null
  const reason = selected ? reasons[selected.bookingId] ?? '' : ''

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
      setReasons((current) => ({ ...current, [selected.bookingId]: '' }))
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
      <PageHeader
        eyebrow={t('approvals.eyebrow')}
        title={t('approvals.title')}
        description={t('approvals.subtitle')}
      />
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
            <div className="border-b border-border p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-full bg-brand/10 text-brand"><UserRound /></span><div><p className="text-xs text-muted-foreground">{t('approvals.requester')}</p><h2 className="text-xl font-bold">{selected.requester?.fullName ?? selected.requesterName}</h2>{selected.requester && <p className="mt-1 text-xs text-muted-foreground"><bdi>{selected.requester.employeeId}</bdi> · {t(`approvals.relationship.${selected.requester.relationshipCode}`)} · {t('approvals.behavior', selected.requester.behavior)}</p>}</div></div><bdi className="font-data font-bold">{selected.bookingNumber}</bdi></div></div>
            <div className="grid gap-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Fact label={t('approvals.vehicle')} value={`${vehicleName(selected)} · ${selected.vehicle.plate}`} />
                <Fact label={t('approvals.window')} value={`${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).formatRange(new Date(selected.pickupAtUtc), new Date(selected.returnAtUtc))}${selected.durationMinutes ? ` · ${t('approvals.durationMinutes', { count: selected.durationMinutes })}` : ''}`} />
                <Fact label={t('approvals.purposePassengers')} value={`${selected.purpose ?? t('approvals.notProvided')} · ${t('approvals.passengerCount', { count: selected.passengerCount ?? 0 })}`} />
                <Fact label={t('approvals.estimatedCost')} value={selected.cost?.status === 'AVAILABLE' && selected.cost.amount ? `${selected.cost.currency} ${selected.cost.amount}` : t(`approvals.provider.${selected.cost?.status ?? 'UNAVAILABLE'}`)} />
              </div>
              <section><h3 className="mb-3 font-bold">{t('approvals.verdicts')}</h3><div className="space-y-2">
                {(selected.evidenceItems ?? []).map((item) => <Verdict key={item.kind} icon={item.kind === 'Eligibility' ? <ShieldCheck /> : item.kind === 'Consent' ? <FileCheck2 /> : item.kind === 'Reservation' ? <Check /> : <Clock3 />} label={t(`approvals.evidenceKind.${item.kind}`)} value={`${t(`approvals.evidenceStatus.${item.status}`)}${item.version ? ` · ${item.version}` : ''}${item.occurredAtUtc ? ` · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.occurredAtUtc))}` : ''}`} tone={['VERIFIED','SIGNED','HELD','AVAILABLE'].includes(item.status) ? 'ok' : 'warn'} />)}
                {!selected.evidenceItems?.length && <Verdict icon={<TriangleFallback />} label={t('approvals.verdicts')} value={t('approvals.evidenceUnavailable')} tone="warn" />}
                <Verdict icon={<Clock3 />} label={t('approvals.sla')} value={selected.dueAtUtc ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.dueAtUtc)) : t('approvals.noSla')} tone="neutral" />
              </div></section>
              <blockquote className="border-s-4 border-brand bg-surface-2 p-4 text-sm"><p className="eyebrow mb-2">{t('approvals.justification')}</p>{selected.justification ?? selected.purpose ?? t('approvals.notProvided')}</blockquote>
              <p className="border-s-2 border-brand ps-3 text-sm text-muted-foreground">{t('approvals.sod')}</p>
              {action && <div className="border border-border bg-surface-2 p-4"><label className="text-sm font-bold" htmlFor="approval-reason">{t('approvals.reason')}</label><textarea id="approval-reason" className="mt-2 min-h-24 w-full border border-border bg-background p-3" value={reason} onChange={(event) => selected && setReasons((current) => ({ ...current, [selected.bookingId]: event.target.value }))} /><div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setAction(null)}>{t('common.cancel')}</Button><Button variant={action === 'decline' ? 'destructive' : 'default'} disabled={(action !== 'approve' && !reason.trim()) || decision.isPending} onClick={() => void submitDecision()}>{t('approvals.confirm')}</Button></div></div>}
              {decision.isError && <p role="alert" className="text-sm text-destructive">{decision.error instanceof ApiRequestError && decision.error.status === 409 ? t('approvals.stale') : t('approvals.actionError')}</p>}
              {conflictMessage && <p role="alert" className="text-sm text-warning">{conflictMessage}</p>}
            </div>
            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"><Button onClick={() => setAction('approve')}><Check />{t('approvals.approve')}</Button><Button variant="secondary" onClick={() => setAction('request-changes')}>{t('approvals.requestChange')}</Button><Button variant="destructive" onClick={() => setAction('decline')}><X />{t('approvals.decline')}</Button></div>
          </main>}
        </div>
      )}</TabsContent><TabsContent value="dedicated" className="pt-4"><EntitlementApprovalsPanel /></TabsContent></Tabs>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="border border-border bg-surface-2 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div> }
function Verdict({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'ok' | 'warn' | 'neutral' }) { return <div className={`flex gap-3 border p-3 text-sm ${tone === 'ok' ? 'border-success/30 bg-success/5' : tone === 'warn' ? 'border-warning/30 bg-warning/5' : 'border-border'}`}><span className={tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warning' : 'text-muted-foreground'}>{icon}</span><div><p className="font-bold">{label}</p><p className="text-muted-foreground">{value}</p></div></div> }
function TriangleFallback() { return <span aria-hidden="true">!</span> }