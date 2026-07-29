import { useEffect, useState } from 'react'
import { Check, FileWarning, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusChip } from '@/components/ui/status-chip'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/patterns/empty-state'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import { useVendorAction, useVendorApprovals } from './hooks/use-vendors'
import type {
  VendorAction,
  VendorApprovalWorkItem,
} from './vendors.contract'

/** Renders the Procurement Pending Approval worklist and decision evidence. */
export function VendorApprovalInbox() {
  const { t } = useTranslation()
  const approvals = useVendorApprovals()
  const action = useVendorAction()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const selected =
    approvals.data?.find((item) => item.vendorId === selectedId) ??
    approvals.data?.[0] ??
    null

  useEffect(() => {
    if (!selectedId && approvals.data?.[0]) {
      setSelectedId(approvals.data[0].vendorId)
    }
  }, [approvals.data, selectedId])

  /** Applies one server-authorized decision and refreshes the queue. */
  const decide = async (decision: VendorAction) => {
    if (!selected) return
    if (['reject', 'request-change'].includes(decision) && !reason.trim()) {
      notify.danger(t('vendors.approvals.reasonRequired'))
      return
    }
    try {
      await action.mutateAsync({
        id: selected.vendorId,
        action: decision,
        reason: reason.trim() || undefined,
      })
      setReason('')
      setSelectedId(null)
      notify.ok(t(`vendors.approvals.actioned.${decision}`))
    } catch (error) {
      if (error instanceof ApiRequestError) {
        notify.danger(error.message, {
          description: error.reasons?.join(' · '),
        })
      } else {
        notify.danger(t('vendors.approvals.actionFailed'))
      }
    }
  }

  if (approvals.isLoading) {
    return <p className="text-ink-3 text-sm">{t('common.loading')}</p>
  }
  if (approvals.isError) {
    return (
      <div className="border-danger rounded-md border p-4 text-sm">
        <p className="text-danger">{t('vendors.approvals.loadFailed')}</p>
        <Button
          className="mt-3"
          size="sm"
          variant="secondary"
          onClick={() => approvals.refetch()}
        >
          <RefreshCw className="size-4" /> {t('common.retry')}
        </Button>
      </div>
    )
  }
  if (!approvals.data?.length) {
    return (
      <EmptyState
        title={t('vendors.approvals.empty.title')}
        description={t('vendors.approvals.empty.body')}
      />
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <section aria-label={t('vendors.approvals.queue')}>
        <p className="eyebrow mb-3">
          {t('vendors.approvals.pendingCount', {
            count: approvals.data.length,
          })}
        </p>
        <div className="space-y-2">
          {approvals.data.map((item) => (
            <button
              key={item.vendorId}
              type="button"
              className={`border-border w-full rounded-md border p-3 text-start ${
                item.vendorId === selected?.vendorId
                  ? 'border-action bg-action/5'
                  : 'bg-surface hover:bg-surface-2'
              }`}
              onClick={() => {
                setSelectedId(item.vendorId)
                setReason('')
              }}
            >
              <span className="block font-semibold">{item.legalName}</span>
              <span className="text-ink-3 mt-1 block text-xs">
                {item.categoryCode} · {item.submitterActorRef}
              </span>
              <span className="mt-2 flex items-center justify-between gap-2">
                <StatusChip
                  tone={item.completeness.canActivate ? 'ok' : 'warn'}
                  label={
                    item.completeness.canActivate
                      ? t('vendors.approvals.complete')
                      : t('vendors.approvals.incomplete')
                  }
                />
                <span className="font-data text-ink-3 text-xs">
                  {item.completeness.completed}/{item.completeness.required}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <ApprovalDetail
          item={selected}
          reason={reason}
          setReason={setReason}
          pending={action.isPending}
          decide={decide}
        />
      ) : null}
    </div>
  )
}

/** Presents maker, change and completeness evidence for one decision. */
function ApprovalDetail({
  item,
  reason,
  setReason,
  pending,
  decide,
}: {
  item: VendorApprovalWorkItem
  reason: string
  setReason: (value: string) => void
  pending: boolean
  decide: (decision: VendorAction) => Promise<void>
}) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? i18n.language).startsWith('ar')
    ? 'ar-AE'
    : 'en-AE'
  const percentage = Math.round(
    (item.completeness.completed / item.completeness.required) * 100,
  )
  return (
    <section className="border-border rounded-md border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t('vendors.approvals.decisionEvidence')}</p>
          <h2 className="mt-1 text-xl font-semibold">{item.legalName}</h2>
          <p className="text-ink-3 mt-1 text-sm">
            {t('vendors.approvals.submittedAt', {
              date: item.submittedAtUtc
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.submittedAtUtc))
                : t('vendors.approvals.unknownTime'),
            })}
          </p>
        </div>
        <StatusChip
          tone="warn"
          label={t('vendors.status.PendingApproval')}
        />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <EvidenceField
          label={t('vendors.approvals.maker')}
          value={item.makerActorRef}
        />
        <EvidenceField
          label={t('vendors.approvals.submitter')}
          value={item.submitterActorRef}
        />
        <EvidenceField
          label={t('vendors.approvals.authority')}
          value={t('roles.Procurement')}
        />
      </dl>

      <div className="mt-6">
        <div className="mb-2 flex justify-between gap-3 text-sm">
          <span>{t('vendors.wizard.completeness')}</span>
          <span className="font-data">
            {item.completeness.completed}/{item.completeness.required}
          </span>
        </div>
        <Progress
          value={percentage}
          label={t('vendors.wizard.completeness')}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <EvidencePanel
          title={t('vendors.approvals.changeSummary')}
          rows={[
            [
              t('vendors.approvals.identityUpdated'),
              item.changeSummary.identityUpdated,
            ],
            [
              t('vendors.approvals.termsCaptured'),
              item.changeSummary.termsCaptured,
            ],
          ]}
        />
        <EvidencePanel
          title={t('vendors.approvals.documentSummary')}
          rows={[
            [
              t('vendors.approvals.confirmedDocuments', {
                count: item.changeSummary.confirmedDocuments,
              }),
              item.changeSummary.confirmedDocuments > 0,
            ],
            [
              t('vendors.approvals.pendingDocuments', {
                count: item.changeSummary.pendingDocuments,
              }),
              item.changeSummary.pendingDocuments === 0,
            ],
          ]}
        />
      </div>

      {item.completeness.missing.length ? (
        <div className="border-warn bg-warn/5 mt-5 rounded-md border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <FileWarning className="size-4" />
            {t('vendors.approvals.activationBlocked')}
          </div>
          <ul className="text-ink-3 mt-2 space-y-1 text-sm">
            {item.completeness.missing.map((field) => (
              <li key={field} className="font-data break-all">
                {field}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 space-y-2">
        <label htmlFor="vendor-decision-reason" className="text-sm font-medium">
          {t('vendors.approvals.reason')}
        </label>
        <Textarea
          id="vendor-decision-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={pending || !reason.trim()}
          onClick={() => decide('request-change')}
        >
          {t('vendors.approvals.requestChange')}
        </Button>
        <Button
          variant="destructive"
          disabled={pending || !reason.trim()}
          onClick={() => decide('reject')}
        >
          {t('vendors.actions.reject')}
        </Button>
        <Button
          disabled={pending || !item.completeness.canActivate}
          onClick={() => decide('approve')}
        >
          {t('vendors.actions.approve')}
        </Button>
      </div>
    </section>
  )
}

/** Renders one governance evidence value. */
function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-3 text-xs">{label}</dt>
      <dd className="font-data mt-1 text-sm">{value}</dd>
    </div>
  )
}

/** Renders a compact non-colour-only change summary. */
function EvidencePanel({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, boolean]>
}) {
  const { t } = useTranslation()
  return (
    <div className="border-border rounded-md border p-4">
      <h3 className="eyebrow">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map(([label, complete]) => (
          <li key={label} className="flex items-center gap-2">
            {complete ? (
              <Check className="text-ok size-4" />
            ) : (
              <FileWarning className="text-warn size-4" />
            )}
            <span>{label}</span>
            <span className="sr-only">
              {complete
                ? t('vendors.approvals.complete')
                : t('vendors.approvals.incomplete')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
