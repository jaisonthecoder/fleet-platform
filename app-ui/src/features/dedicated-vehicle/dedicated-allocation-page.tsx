import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CarFront, Check, Clock3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiRequestError } from '@/lib/api-client'
import {
  allocateDedicatedVehicle,
  cancelBsdWindow,
  confirmBsdWindow,
  getBsdWindows,
  getEntitlementAllocationWorklist,
  proposeBsdWindow,
  type BsdWindow,
  type EntitlementAllocationWorkItem,
} from './dedicated-vehicle.contract'

/** Fleet allocation queue for approved, consented Dedicated requests. */
export function DedicatedAllocationPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const worklist = useQuery({
    queryKey: ['entitlements', 'allocation-worklist'],
    queryFn: getEntitlementAllocationWorklist,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vehicleId, setVehicleId] = useState('')
  const [varianceReasonCode, setVarianceReasonCode] = useState('')
  const [bsdStart, setBsdStart] = useState('')
  const [bsdEnd, setBsdEnd] = useState('')
  const [bsdReason, setBsdReason] = useState('')
  const [bsdValidation, setBsdValidation] = useState<string | null>(null)
  const [proposedBsd, setProposedBsd] = useState<BsdWindow | null>(null)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const selected =
    worklist.data?.find((item) => item.entitlement.id === selectedId) ??
    worklist.data?.[0] ??
    null
  const bsdSchedule = useQuery({
    queryKey: ['entitlements', selected?.entitlement.id, 'bsd-windows'],
    queryFn: () => getBsdWindows(selected!.entitlement.id),
    enabled: selected?.entitlement.status === 'Allocated',
  })

  useEffect(() => {
    const openWindow = bsdSchedule.data?.find((window) =>
      ['Proposed', 'Confirmed', 'Active', 'Conflict'].includes(window.status),
    )
    setProposedBsd(openWindow ?? null)
  }, [bsdSchedule.data, selected?.entitlement.id])
  const allocation = useMutation({
    mutationFn: (item: EntitlementAllocationWorkItem) =>
      allocateDedicatedVehicle({
        item,
        vehicleId,
        varianceReasonCode: varianceReasonCode.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      setVehicleId('')
      setVarianceReasonCode('')
      await queryClient.invalidateQueries({
        queryKey: ['entitlements', 'allocation-worklist'],
      })
    },
  })
  const proposeBsd = useMutation({
    mutationFn: () => {
      const start = new Date(bsdStart)
      const end = new Date(bsdEnd)
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
      ) {
        throw new Error('invalid-bsd-window')
      }
      return proposeBsdWindow({
        entitlementId: selected!.entitlement.id,
        vehicleId: selected!.entitlement.vehicleId!,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        reason: bsdReason.trim(),
      })
    },
    onMutate: () => setBsdValidation(null),
    onSuccess: async (window) => {
      setProposedBsd(window)
      await queryClient.invalidateQueries({
        queryKey: ['entitlements', selected?.entitlement.id, 'bsd-windows'],
      })
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'invalid-bsd-window') {
        setBsdValidation(t('dedicatedAllocation.bsdWindowInvalid'))
      }
    },
  })
  const confirmBsd = useMutation({
    mutationFn: () =>
      confirmBsdWindow({ windowId: proposedBsd!.id, reason: bsdReason.trim() }),
    onSuccess: async (window) => {
      setProposedBsd(window)
      await queryClient.invalidateQueries({
        queryKey: ['entitlements', selected?.entitlement.id, 'bsd-windows'],
      })
    },
  })
  const cancelBsd = useMutation({
    mutationFn: () =>
      cancelBsdWindow({ windowId: proposedBsd!.id, reason: bsdReason.trim() }),
    onSuccess: async () => {
      setProposedBsd(null)
      setBsdReason('')
      await queryClient.invalidateQueries({
        queryKey: ['entitlements', selected?.entitlement.id, 'bsd-windows'],
      })
    },
  })
  const differs = Boolean(
    selected?.entitlement.preferredVehicleId &&
    vehicleId &&
    selected.entitlement.preferredVehicleId !== vehicleId,
  )
  const bsdMutationError =
    proposeBsd.error || confirmBsd.error || cancelBsd.error

  if (worklist.isLoading)
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {t('dedicatedAllocation.loading')}
      </p>
    )
  if (worklist.isError)
    return (
      <div
        role="alert"
        className="border border-destructive/30 bg-destructive/5 p-5"
      >
        <p>{t('dedicatedAllocation.error')}</p>
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => void worklist.refetch()}
        >
          {t('common.retry')}
        </Button>
      </div>
    )

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('dedicatedAllocation.eyebrow')}
        title={t('dedicatedAllocation.title')}
        description={t('dedicatedAllocation.subtitle')}
      />
      {!worklist.data?.length ? (
        <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t('dedicatedAllocation.empty')}
        </p>
      ) : (
        <div className="grid min-h-[620px] border border-border bg-card lg:grid-cols-[340px_1fr]">
          <aside
            className="border-b border-border lg:border-b-0 lg:border-e"
            aria-label={t('dedicatedAllocation.queue')}
          >
            {worklist.data.map((item) => (
              <button
                key={item.entitlement.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.entitlement.id)
                  setVehicleId('')
                  setVarianceReasonCode('')
                }}
                className={`block w-full border-b border-border p-4 text-start ${selected?.entitlement.id === item.entitlement.id ? 'bg-brand/5' : 'hover:bg-muted'}`}
              >
                <strong>{item.requesterName}</strong>
                <p className="mt-1 text-sm">
                  {item.entitlement.vehicleCategoryCode} · {item.options.length}{' '}
                  {t('dedicatedAllocation.options')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <bdi>{item.entitlement.id}</bdi>
                </p>
              </button>
            ))}
          </aside>
          {selected && (
            <main className="flex min-w-0 flex-col">
              <div className="border-b border-border p-5">
                <h2 className="text-xl font-bold">{selected.requesterName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                  }).formatRange(
                    new Date(`${selected.entitlement.durationStart}T00:00:00Z`),
                    new Date(`${selected.entitlement.durationEnd}T00:00:00Z`),
                  )}
                </p>
              </div>
              <div className="grid gap-5 p-5">
                <div className="flex items-center gap-2 text-sm text-success">
                  <Check className="size-4" />
                  {t('dedicatedAllocation.consented')}
                </div>
                <section className="border-s-2 border-brand ps-3">
                  <h3 className="text-sm font-bold">
                    {t('dedicatedAllocation.preference')}
                  </h3>
                  <p className="mt-1 text-sm">
                    <bdi>
                      {selected.preferredVehiclePlate ??
                        t('dedicatedAllocation.noPreference')}
                    </bdi>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dedicated.preference.nonBinding')}
                  </p>
                </section>
                {selected.entitlement.status === 'AwaitingConsent' && (
                  <>
                    <div>
                      <Label htmlFor="allocation-vehicle">
                        {t('dedicatedAllocation.vehicle')}
                      </Label>
                      <Select value={vehicleId} onValueChange={setVehicleId}>
                        <SelectTrigger id="allocation-vehicle" className="mt-2">
                          <SelectValue
                            placeholder={t('dedicatedAllocation.selectVehicle')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {selected.options.map((option) => (
                            <SelectItem
                              key={option.vehicleId}
                              value={option.vehicleId}
                            >
                              <bdi>{option.plate}</bdi> · {option.makeCode}{' '}
                              {option.modelCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selected.options.length && (
                        <p className="mt-2 text-sm text-warning">
                          <Clock3 className="me-1 inline size-4" />
                          {t('dedicatedAllocation.noOptions')}
                        </p>
                      )}
                    </div>
                    {differs && (
                      <div>
                        <Label htmlFor="allocation-variance">
                          {t('dedicatedAllocation.variance')}
                        </Label>
                        <Input
                          id="allocation-variance"
                          className="mt-2"
                          value={varianceReasonCode}
                          onChange={(event) =>
                            setVarianceReasonCode(event.target.value)
                          }
                        />
                      </div>
                    )}
                  </>
                )}
                {selected.entitlement.status === 'Allocated' &&
                  selected.entitlement.vehicleId && (
                    <section className="border border-border bg-surface-2 p-4">
                      <h3 className="font-bold">
                        {t('dedicatedAllocation.bsdTitle')}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('dedicatedAllocation.bsdBody')}
                      </p>
                      {bsdSchedule.isError && (
                        <div
                          role="alert"
                          className="mt-3 border border-destructive/30 bg-destructive/5 p-3 text-sm"
                        >
                          <p>{t('dedicatedAllocation.bsdLoadError')}</p>
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="secondary"
                            onClick={() => void bsdSchedule.refetch()}
                          >
                            {t('common.retry')}
                          </Button>
                        </div>
                      )}
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="bsd-start">
                            {t('dedicatedAllocation.bsdStart')}
                          </Label>
                          <Input
                            id="bsd-start"
                            className="mt-2"
                            type="datetime-local"
                            value={bsdStart}
                            onChange={(event) =>
                              setBsdStart(event.target.value)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="bsd-end">
                            {t('dedicatedAllocation.bsdEnd')}
                          </Label>
                          <Input
                            id="bsd-end"
                            className="mt-2"
                            type="datetime-local"
                            value={bsdEnd}
                            onChange={(event) => setBsdEnd(event.target.value)}
                          />
                        </div>
                      </div>
                      <Label htmlFor="bsd-reason" className="mt-3 block">
                        {t('dedicatedAllocation.bsdReason')}
                      </Label>
                      <Input
                        id="bsd-reason"
                        className="mt-2"
                        value={bsdReason}
                        onChange={(event) => setBsdReason(event.target.value)}
                      />
                      {bsdValidation && (
                        <p role="alert" className="mt-3 text-sm text-destructive">
                          {bsdValidation}
                        </p>
                      )}
                      {bsdMutationError && !bsdValidation && (
                        <p role="alert" className="mt-3 text-sm text-destructive">
                          {t('dedicatedAllocation.bsdActionError')}
                        </p>
                      )}
                      {proposedBsd?.status === 'Conflict' ? (
                        <div
                          role="alert"
                          className="mt-3 border border-warning/30 bg-warning/5 p-3 text-sm"
                        >
                          <strong>
                            {t('dedicatedAllocation.bsdConflictTitle')}
                          </strong>
                          <p className="mt-1 text-muted-foreground">
                            {t('dedicatedAllocation.bsdConflictBody')}
                          </p>
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="secondary"
                            onClick={() => void bsdSchedule.refetch()}
                          >
                            {t('dedicatedAllocation.refreshBsd')}
                          </Button>
                        </div>
                      ) : proposedBsd ? (
                        <p role="status" className="mt-3 text-sm">
                          {t('dedicatedAllocation.bsdStatus', {
                            status: t(
                              `dedicatedAllocation.status.${proposedBsd.status}`,
                            ),
                          })}
                        </p>
                      ) : null}
                      <div className="mt-4 flex gap-2">
                        {!proposedBsd && (
                          <Button
                            variant="secondary"
                            onClick={() => proposeBsd.mutate()}
                            disabled={
                              !bsdStart ||
                              !bsdEnd ||
                              !bsdReason.trim() ||
                              proposeBsd.isPending ||
                              confirmBsd.isPending ||
                              cancelBsd.isPending
                            }
                          >
                            {t('dedicatedAllocation.proposeBsd')}
                          </Button>
                        )}
                        {proposedBsd?.status === 'Proposed' && (
                          <Button
                            onClick={() => confirmBsd.mutate()}
                            disabled={
                              !bsdReason.trim() || confirmBsd.isPending
                            }
                          >
                            {t('dedicatedAllocation.confirmBsd')}
                          </Button>
                        )}
                        {proposedBsd &&
                          ['Proposed', 'Confirmed'].includes(
                            proposedBsd.status,
                          ) && (
                            <Button
                              variant="secondary"
                              onClick={() => cancelBsd.mutate()}
                              disabled={
                                !bsdReason.trim() || cancelBsd.isPending
                              }
                            >
                              {t('dedicatedAllocation.cancelBsd')}
                            </Button>
                          )}
                      </div>
                    </section>
                  )}
                {allocation.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {allocation.error instanceof ApiRequestError &&
                    allocation.error.status === 409
                      ? t('dedicatedAllocation.stale')
                      : t('dedicatedAllocation.actionError')}
                  </p>
                )}
              </div>
              {selected.entitlement.status === 'AwaitingConsent' && (
                <div className="mt-auto flex justify-end border-t border-border p-4">
                  <Button
                    onClick={() => allocation.mutate(selected)}
                    disabled={
                      !vehicleId ||
                      (differs && !varianceReasonCode.trim()) ||
                      allocation.isPending
                    }
                  >
                    <CarFront />
                    {t('dedicatedAllocation.allocate')}
                  </Button>
                </div>
              )}
            </main>
          )}
        </div>
      )}
    </div>
  )
}
