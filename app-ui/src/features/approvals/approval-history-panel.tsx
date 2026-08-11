import { useState } from 'react'
import { Ban, Check, History, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import type { ApprovalHistoryItem, ApprovalInterventionAction } from './booking-approvals.contract'
import { useApprovalHistory, useApprovalIntervention } from './use-booking-approvals'

type DomainFilter = 'All' | ApprovalHistoryItem['domain']

/** Renders Pool and Dedicated approval history with pre-operation intervention controls. */
export function ApprovalHistoryPanel() {
  const { t, i18n } = useTranslation()
  const history = useApprovalHistory()
  const intervention = useApprovalIntervention()
  const [filter, setFilter] = useState<DomainFilter>('All')
  const [target, setTarget] = useState<{ item: ApprovalHistoryItem; action: ApprovalInterventionAction } | null>(null)
  const [reason, setReason] = useState('')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const items = history.data?.filter((item) => filter === 'All' || item.domain === filter) ?? []

  /** Commits one intervention with a fresh retry key and refreshes all dependent queues. */
  async function submit() {
    if (!target || !reason.trim()) return
    await intervention.mutateAsync({ ...target, reason: reason.trim(), idempotencyKey: crypto.randomUUID() })
    setTarget(null)
    setReason('')
  }

  if (history.isLoading) return <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('approvals.history.loading')}</p>
  if (history.isError) return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p>{t('approvals.history.error')}</p><Button className="mt-3" variant="secondary" onClick={() => void history.refetch()}><RefreshCw />{t('common.retry')}</Button></div>

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
      <div><h2 className="font-bold">{t('approvals.history.title')}</h2><p className="mt-1 text-xs text-muted-foreground">{t('approvals.history.description')}</p></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('approvals.history.filterLabel')}>
        {(['All', 'PoolBooking', 'DedicatedVehicle'] as const).map((value) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'secondary'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`approvals.history.filters.${value}`)}</Button>)}
      </div>
    </div>
    {items.length === 0 ? <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('approvals.history.empty')}</p> : <div className="space-y-3">{items.map((item) => <HistoryItem key={`${item.domain}:${item.subjectId}`} item={item} locale={locale} onAction={(action) => { setTarget({ item, action }); setReason('') }} />)}</div>}
    {target && <section className="border border-warning/40 bg-warning/5 p-4" aria-label={t(`approvals.history.actions.${target.action}`)}>
      <h3 className="font-bold">{t(`approvals.history.confirmTitle.${target.action}`)}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t(`approvals.history.confirmBody.${target.action}`)}</p>
      <label className="mt-4 block text-sm font-bold" htmlFor="approval-intervention-reason">{t('approvals.history.reason')}</label>
      <textarea id="approval-intervention-reason" className="mt-2 min-h-24 w-full border border-border bg-background p-3" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
      {intervention.isError && <p role="alert" className="mt-2 text-sm text-destructive">{t('approvals.history.actionError')}</p>}
      <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setTarget(null)}>{t('common.cancel')}</Button><Button variant={target.action === 'REVOKE' ? 'destructive' : 'default'} disabled={!reason.trim() || intervention.isPending} onClick={() => void submit()}>{t('approvals.history.confirm')}</Button></div>
    </section>}
  </div>
}

/** Renders one immutable approval record and its currently authorized interventions. */
function HistoryItem({ item, locale, onAction }: { item: ApprovalHistoryItem; locale: string; onAction: (action: ApprovalInterventionAction) => void }) {
  const { t } = useTranslation()
  return <article className="grid gap-4 border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2"><History className="size-4 text-brand" /><bdi className="font-data font-bold">{item.reference}</bdi><StatusChip tone={item.suspended ? 'warn' : item.status === 'Cancelled' ? 'danger' : 'ok'} label={item.suspended ? t('approvals.history.suspended') : t(`approvals.history.status.${item.status}`, { defaultValue: item.status })} /><span className="text-xs font-semibold text-muted-foreground">{t(`approvals.history.domains.${item.domain}`)}</span></div>
      <p className="mt-2 font-semibold">{item.requesterName} · <bdi>{item.summary}</bdi></p>
      <p className="mt-1 text-xs text-muted-foreground">{t('approvals.history.decisionLine', { decision: t(`approvals.history.decisions.${item.decision}`, { defaultValue: item.decision }), date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.decidedAtUtc)) })}</p>
      {item.decisionReason && <p className="mt-2 text-sm">{item.decisionReason}</p>}
      {item.suspensionReason && <p className="mt-2 border-s-2 border-warning ps-3 text-sm text-warning">{item.suspensionReason}</p>}
      {item.interventions.length > 0 && <div className="mt-3 border-s-2 border-border ps-3">
        <p className="text-xs font-bold text-muted-foreground">{t('approvals.history.interventionCount', { count: item.interventions.length })}</p>
        <ol className="mt-2 space-y-2">
          {item.interventions.map((entry, index) => <li key={`${entry.action}:${entry.occurredAtUtc}:${index}`} className="text-xs">
            <span className="font-semibold">{t(`approvals.history.interventionActions.${entry.action}`)}</span>
            <span className="text-muted-foreground"> · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.occurredAtUtc))}</span>
            {entry.reason && <p className="mt-0.5 text-muted-foreground">{entry.reason}</p>}
          </li>)}
        </ol>
      </div>}
    </div>
    <div className="flex flex-wrap justify-end gap-2">
      {item.capabilities.suspend && <Button size="sm" variant="secondary" onClick={() => onAction('SUSPEND')}><PauseCircle />{t('approvals.history.actions.SUSPEND')}</Button>}
      {item.capabilities.resume && <Button size="sm" variant="secondary" onClick={() => onAction('RESUME')}><PlayCircle />{t('approvals.history.actions.RESUME')}</Button>}
      {item.capabilities.revoke && <Button size="sm" variant="destructive" onClick={() => onAction('REVOKE')}><Ban />{t('approvals.history.actions.REVOKE')}</Button>}
      {!item.capabilities.suspend && !item.capabilities.resume && !item.capabilities.revoke && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-4" />{t('approvals.history.closed')}</span>}
    </div>
  </article>
}