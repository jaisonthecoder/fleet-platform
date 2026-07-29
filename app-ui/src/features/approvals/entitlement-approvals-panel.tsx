import { useEffect, useState } from 'react'
import { Check, Clock3, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { ApiRequestError } from '@/lib/api-client'
import type { EntitlementApprovalAction } from './booking-approvals.contract'
import { useEntitlementApprovals, useEntitlementDecision } from './use-booking-approvals'

/** Renders assigned/delegated Dedicated Vehicle approval tasks and decisions. */
export function EntitlementApprovalsPanel() {
  const { t, i18n } = useTranslation()
  const approvals = useEntitlementApprovals()
  const decision = useEntitlementDecision()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [action, setAction] = useState<EntitlementApprovalAction | null>(null)
  const [reason, setReason] = useState('')
  const locale = i18n.resolvedLanguage ?? i18n.language
  const selected = approvals.data?.find((item) => item.entitlementId === selectedId) ?? approvals.data?.[0] ?? null

  useEffect(() => {
    if (!selectedId && approvals.data?.[0]) setSelectedId(approvals.data[0].entitlementId)
  }, [approvals.data, selectedId])

  /** Sends a stable decision command and refreshes the current worklist. */
  async function submitDecision() {
    if (!selected || !action) return
    await decision.mutateAsync({ item: selected, action, reason: reason.trim() || undefined, idempotencyKey: crypto.randomUUID() })
    setAction(null)
    setReason('')
  }

  if (approvals.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('entitlementApprovals.loading')}</p>
  if (approvals.isError) return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p>{t('entitlementApprovals.error')}</p><Button className="mt-3" variant="secondary" onClick={() => void approvals.refetch()}>{t('common.retry')}</Button></div>
  if (!approvals.data?.length) return <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('entitlementApprovals.empty')}</p>

  return <div className="grid min-h-[620px] border border-border bg-card lg:grid-cols-[340px_1fr]">
    <aside className="border-b border-border lg:border-b-0 lg:border-e" aria-label={t('entitlementApprovals.queue')}>
      {approvals.data.map((item) => <button key={item.entitlementId} type="button" onClick={() => setSelectedId(item.entitlementId)} className={`block w-full border-b border-border p-4 text-start ${selected?.entitlementId === item.entitlementId ? 'bg-brand/5' : 'hover:bg-muted'}`}><div className="flex justify-between gap-3"><strong>{item.requesterName}</strong>{item.delegated && <span className="text-xs text-warning">{t('approvals.delegated')}</span>}</div><p className="mt-1 text-sm">{t(`dedicated.duration.${item.requestType === 'LongTerm' ? 'longTerm' : 'temporary'}`)} · {item.vehicleCategoryCode}</p><p className="mt-1 text-xs text-muted-foreground"><bdi>{item.entitlementId}</bdi></p></button>)}
    </aside>
    {selected && <main className="flex min-w-0 flex-col"><div className="border-b border-border p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-muted-foreground">{t('entitlementApprovals.requester')}</p><h2 className="text-xl font-bold">{selected.requesterName}</h2></div><StatusChip tone="warn" label={t('entitlementApprovals.pending')} /></div></div><div className="grid gap-5 p-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Fact label={t('entitlementApprovals.duration')} value={new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).formatRange(new Date(`${selected.durationStart}T00:00:00Z`), new Date(`${selected.durationEnd}T00:00:00Z`))} /><Fact label={t('entitlementApprovals.class')} value={selected.vehicleCategoryCode ?? t('approvals.notProvided')} /><Fact label={t('entitlementApprovals.category')} value={selected.justificationCategory} /><Fact label={t('entitlementApprovals.location')} value={selected.locationName ?? t('approvals.notProvided')} /></div><section><h3 className="font-bold">{t('entitlementApprovals.justification')}</h3><p className="mt-2 whitespace-pre-wrap text-sm">{selected.justificationText}</p></section>{selected.preferenceNote && <section className="border-s-2 border-brand ps-3"><h3 className="text-sm font-bold">{t('entitlementApprovals.preference')}</h3><p className="mt-1 text-sm">{selected.preferenceNote}</p><p className="mt-1 text-xs text-muted-foreground">{t('dedicated.preference.nonBinding')}</p></section>}<div className="flex items-center gap-2 text-sm text-success"><Check className="size-4" />{t('entitlementApprovals.eligibilityPinned')}</div>{selected.dueAtUtc && <div className="flex items-center gap-2 text-sm"><Clock3 className="size-4" />{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selected.dueAtUtc))}</div>}{action && <div className="border border-border bg-surface-2 p-4"><label className="text-sm font-bold" htmlFor="entitlement-approval-reason">{t('approvals.reason')}</label><textarea id="entitlement-approval-reason" className="mt-2 min-h-24 w-full border border-border bg-background p-3" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setAction(null)}>{t('common.cancel')}</Button><Button disabled={(action !== 'approve' && !reason.trim()) || decision.isPending} onClick={() => void submitDecision()}>{t('approvals.confirm')}</Button></div></div>}{decision.error && <p role="alert" className="text-sm text-destructive">{decision.error instanceof ApiRequestError && decision.error.status === 409 ? t('approvals.stale') : t('approvals.actionError')}</p>}</div><div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border p-4"><Button onClick={() => setAction('approve')}><Check />{t('approvals.approve')}</Button><Button variant="secondary" onClick={() => setAction('request-modification')}>{t('entitlementApprovals.requestModification')}</Button><Button variant="destructive" onClick={() => setAction('decline')}><X />{t('approvals.decline')}</Button></div></main>}
  </div>
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface-2 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}