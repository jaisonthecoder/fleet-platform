import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Drawer } from '@/components/patterns/drawer'
import { StatusChip } from '@/components/ui/status-chip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/patterns/empty-state'
import { useAuth } from '@/features/auth/auth-context'
import { notify } from '@/hooks/use-toast'
import { ApiRequestError } from '@/lib/api-client'
import {
  useCreateVendorLease,
  useVendorAction,
  useVendorLeases,
  useVendors,
} from './hooks/use-vendors'
import { LeaseContractForm } from './lease-contract-form'
import { VendorDocumentsSection } from './vendor-documents-section'
import { VendorOnboardingWizard } from './vendor-onboarding-wizard'
import { VendorApprovalInbox } from './vendor-approval-inbox'
import type {
  Vendor,
  VendorAction,
  VendorStatus,
} from './vendors.contract'

const STATUS_TONE: Record<VendorStatus, 'ok' | 'warn' | 'neutral'> = {
  Draft: 'neutral',
  PendingApproval: 'warn',
  Active: 'ok',
  Suspended: 'warn',
  Retired: 'neutral',
}

/** Lifecycle actions offered per current status. */
const ACTIONS_BY_STATUS: Record<VendorStatus, VendorAction[]> = {
  Draft: ['submit', 'retire'],
  PendingApproval: ['approve', 'reject', 'retire'],
  Active: ['suspend', 'retire'],
  Suspended: ['reactivate', 'retire'],
  Retired: [],
}

function reportError(error: unknown, fallback: string): void {
  if (error instanceof ApiRequestError) {
    notify.danger(error.message || fallback, {
      description: error.reasons?.join(' · '),
    })
  } else {
    notify.danger(fallback)
  }
}

/**
 * Vendor master (S1). Lists governed vendors with their lifecycle status and
 * source mode, opens a detail drawer with lease contracts + lifecycle actions
 * (Procurement approval is SoD-gated on the backend), and onboards new vendors.
 */
export function VendorsPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const vendorsQuery = useVendors()
  const action = useVendorAction()

  const [selected, setSelected] = useState<Vendor | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const canApprove = me?.roles.some((role) =>
    ['Procurement', 'SystemAdmin'].includes(role.role),
  )

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: 'legalName',
        header: t('vendors.columns.vendor'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.legalName}</div>
            <div className="text-ink-3 font-data text-xs">
              {row.original.categoryCode}
              {row.original.tradeLicenceNumber
                ? ` · ${row.original.tradeLicenceNumber}`
                : ''}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('vendors.columns.status'),
        cell: ({ row }) => (
          <StatusChip
            tone={STATUS_TONE[row.original.status as VendorStatus] ?? 'neutral'}
            label={t(`vendors.status.${row.original.status}`)}
          />
        ),
      },
      {
        accessorKey: 'sourceMode',
        header: t('vendors.columns.source'),
        cell: ({ row }) => (
          <span className="font-data text-xs">
            {t(`vendors.source.${row.original.sourceMode}`)}
            {row.original.dataQualityFlag
              ? ` · ${t('vendors.unverified')}`
              : ''}
          </span>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('vendors.eyebrow')}
        title={t('vendors.title')}
        action={
          <Button variant="signal" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> {t('vendors.onboard')}
          </Button>
        }
      />

      <Tabs defaultValue="master">
        <TabsList>
          <TabsTrigger value="master">{t('vendors.tabs.master')}</TabsTrigger>
          {canApprove ? (
            <TabsTrigger value="approvals">
              {t('vendors.tabs.approvals')}
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="master">
          {vendorsQuery.data && vendorsQuery.data.length === 0 ? (
            <EmptyState
              title={t('vendors.empty.title')}
              description={t('vendors.empty.body')}
            />
          ) : (
            <DataTable
              columns={columns}
              data={vendorsQuery.data ?? []}
              isLoading={vendorsQuery.isLoading}
              searchPlaceholder={t('vendors.search')}
              onRowClick={(row) => setSelected(row)}
            />
          )}
        </TabsContent>
        {canApprove ? (
          <TabsContent value="approvals">
            <VendorApprovalInbox />
          </TabsContent>
        ) : null}
      </Tabs>

      <VendorDetailDrawer
        vendor={selected}
        canApprove={Boolean(canApprove)}
        onClose={() => setSelected(null)}
        onAction={async (act, reason) => {
          if (!selected) return
          try {
            const updated = await action.mutateAsync({
              id: selected.id,
              action: act,
              reason,
            })
            setSelected(updated)
            notify.ok(t(`vendors.actioned.${act}`))
          } catch (error) {
            reportError(error, t('vendors.actionFailed'))
          }
        }}
      />

      <VendorOnboardingWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}

interface DetailProps {
  vendor: Vendor | null
  canApprove: boolean
  onClose: () => void
  onAction: (action: VendorAction, reason?: string) => void
}

function VendorDetailDrawer({
  vendor,
  canApprove,
  onClose,
  onAction,
}: DetailProps) {
  const { t } = useTranslation()
  const leases = useVendorLeases(vendor?.id ?? null)
  const createLease = useCreateVendorLease(vendor?.id ?? '')
  const [leaseFormOpen, setLeaseFormOpen] = useState(false)
  if (!vendor) return null
  const isIntegrated = vendor.sourceMode === 'Integrated'
  const actions = isIntegrated
    ? []
    : (ACTIONS_BY_STATUS[vendor.status as VendorStatus] ?? []).filter(
        (candidate) =>
          canApprove || !['approve', 'reject'].includes(candidate),
      )

  return (
    <Drawer
      open={Boolean(vendor)}
      onOpenChange={(o) => !o && onClose()}
      eyebrow={t('vendors.eyebrow')}
      title={vendor.legalName}
      description={`${t(`vendors.source.${vendor.sourceMode}`)} · ${t(`vendors.status.${vendor.status}`)}`}
      headerAccessory={<StatusChip tone={STATUS_TONE[vendor.status as VendorStatus] ?? 'neutral'} label={t(`vendors.status.${vendor.status}`)} />}
      width="lg"
    >
        {isIntegrated ? (
          <p className="border-border bg-surface-2 mt-4 rounded-md border p-3 text-sm">
            {t('vendors.integratedReadOnly')}
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field
            label={t('vendors.fields.category')}
            value={vendor.categoryCode}
          />
          <Field
            label={t('vendors.fields.tradeLicence')}
            value={vendor.tradeLicenceNumber}
          />
          <Field
            label={t('vendors.fields.trn')}
            value={vendor.taxRegistrationNumber}
          />
          <Field
            label={t('vendors.fields.paymentTerms')}
            value={vendor.paymentTerms}
          />
          <Field
            label={t('vendors.fields.iban')}
            value={vendor.bankIbanMasked}
          />
          <Field
            label={t('vendors.fields.contact')}
            value={vendor.primaryContactName}
          />
        </dl>

        <VendorDocumentsSection vendor={vendor} />

        {actions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {actions.map((act) => (
              <Button
                key={act}
                variant={
                  act === 'approve'
                    ? 'default'
                    : act === 'reject' || act === 'retire'
                      ? 'destructive'
                      : 'secondary'
                }
                size="sm"
                onClick={() => onAction(act)}
              >
                {t(`vendors.actions.${act}`)}
              </Button>
            ))}
          </div>
        )}

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="eyebrow">{t('vendors.leases.title')}</h3>
            {vendor.status === 'Active' && !isIntegrated ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLeaseFormOpen((open) => !open)}
              >
                <Plus className="size-4" /> {t('vendors.leases.add')}
              </Button>
            ) : null}
          </div>
          {leaseFormOpen ? (
            <LeaseContractForm
              pending={createLease.isPending}
              onCancel={() => setLeaseFormOpen(false)}
              onSubmit={async (input) => {
                try {
                  await createLease.mutateAsync(input)
                  setLeaseFormOpen(false)
                  notify.ok(t('vendors.leases.created'))
                } catch (error) {
                  reportError(error, t('vendors.leases.createFailed'))
                }
              }}
            />
          ) : null}
          {leases.data && leases.data.length > 0 ? (
            <ul className="space-y-2">
              {leases.data.map((l) => (
                <li
                  key={l.id}
                  className="border-border flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span className="font-data">{l.contractRef}</span>
                  <span className="text-ink-3">
                    {l.monthlyAmount ? `${l.currency} ${l.monthlyAmount}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-3 text-sm">
              {vendor.status === 'Active'
                ? t('vendors.leases.none')
                : t('vendors.leases.requiresActive')}
            </p>
          )}
        </div>
    </Drawer>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-ink-3 text-xs">{label}</dt>
      <dd className="font-data">{value ?? '—'}</dd>
    </div>
  )
}

