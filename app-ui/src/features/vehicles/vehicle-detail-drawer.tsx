import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusChip } from '@/components/ui/status-chip'
import { Switch } from '@/components/ui/switch'
import { Drawer } from '@/components/patterns/drawer'
import { useLookupValues } from '@/features/config/hooks/use-lookups'
import type { LookupValue } from '@/features/config/config.contract'
import { useAuth } from '@/features/auth/auth-context'
import { useHierarchy } from '@/features/platform/hooks/use-hierarchy'
import {
  descendantsOf,
  flattenHierarchy,
} from '@/features/platform/platform.contract'
import { useUsers } from '@/features/identity/hooks/use-user-admin'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import {
  ALLOWED_VEHICLE_TRANSITIONS,
  VEHICLE_GPS_STATUSES,
  VEHICLE_OPERATIONAL_STATUSES,
  type UpdateVehicleInput,
  type Vehicle,
  type VehicleLifecycleStatus,
  type VehicleOperationalStatus,
} from './vehicle.contract'
import {
  useAcknowledgeAlert,
  useAddVehicleDocument,
  useDevices,
  usePairDevice,
  useRegisterDevice,
  useTransferVehicle,
  useTransitionVehicle,
  useUnpairDevice,
  useUpdateVehicle,
  useVehicleAlerts,
  useVehicleDevice,
  useVehicleDocuments,
  useVehicleHistory,
  useVehicleLive,
  useVehicleTransfers,
  useVehicleTrips,
} from './hooks/use-vehicles'

type Tab =
  | 'details'
  | 'telematics'
  | 'edit'
  | 'assignment'
  | 'documents'
  | 'activity'
  | 'lifecycle'
  | 'history'

/** Fleet roles that may write vehicles — mirrors the server guard. */
const FLEET_WRITE_ROLES = new Set([
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
  'DataSteward',
  'SystemAdmin',
])

/** Lifecycle status → StatusChip tone (colour is never the only signal). */
function lifecycleTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (status === 'Active') return 'ok'
  if (status === 'UnderMaintenance' || status === 'OffHirePending') return 'warn'
  if (status === 'Decommissioned' || status === 'Sold' || status === 'Transferred')
    return 'danger'
  return 'neutral'
}

/** True when a compliance date is missing or already expired (mirrors server). */
function complianceExpired(value: string | null | undefined): boolean {
  return !value || value < new Date().toISOString().slice(0, 10)
}

function localizedLabel(value: LookupValue, language: string): string {
  return language.startsWith('ar') ? value.labelAr : value.labelEn
}

/** The mutable subset of a vehicle, as controlled form strings. */
interface EditState {
  colour: string
  useCategoryCode: string
  fuelTypeCode: string
  operationalStatus: string
  bookingPoolFlag: boolean
  gpsStatus: string
  trackerVendor: string
  trackerSerial: string
  mulkiyaNumber: string
  mulkiyaExpiry: string
  insuranceProvider: string
  insurancePolicyNumber: string
  insuranceExpiry: string
  fuelCardNumber: string
  salikTag: string
  darbTag: string
}

function toEditState(v: Vehicle): EditState {
  return {
    colour: v.colour ?? '',
    useCategoryCode: v.useCategoryCode ?? '',
    fuelTypeCode: v.fuelTypeCode ?? '',
    operationalStatus: v.operationalStatus ?? '',
    bookingPoolFlag: v.bookingPoolFlag,
    gpsStatus: v.gpsStatus,
    trackerVendor: v.trackerVendor ?? '',
    trackerSerial: v.trackerSerial ?? '',
    mulkiyaNumber: v.mulkiyaNumber ?? '',
    mulkiyaExpiry: v.mulkiyaExpiry ?? '',
    insuranceProvider: v.insuranceProvider ?? '',
    insurancePolicyNumber: v.insurancePolicyNumber ?? '',
    insuranceExpiry: v.insuranceExpiry ?? '',
    fuelCardNumber: v.fuelCardNumber ?? '',
    salikTag: v.salikTag ?? '',
    darbTag: v.darbTag ?? '',
  }
}

interface VehicleDetailDrawerProps {
  vehicle: Vehicle | null
  onOpenChange: (open: boolean) => void
  /** Called with the server's refreshed record after a successful mutation. */
  onUpdated: (vehicle: Vehicle) => void
}

/**
 * Right-side inspector for one onboarded vehicle: read-only details, an edit
 * form over the mutable attribute subset, guarded lifecycle transitions, and
 * the lifecycle history. Immutable identity fields are shown read-only.
 */
export function VehicleDetailDrawer({
  vehicle,
  onOpenChange,
  onUpdated,
}: VehicleDetailDrawerProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const [tab, setTab] = useState<Tab>('details')
  const [form, setForm] = useState<EditState>(() =>
    vehicle ? toEditState(vehicle) : toEditState({} as Vehicle),
  )
  const [pendingTarget, setPendingTarget] = useState<VehicleLifecycleStatus | ''>('')
  const [reason, setReason] = useState('')

  const useCategories = useLookupValues('use-category')
  const fuelTypes = useLookupValues('fuel-type')
  const history = useVehicleHistory(tab === 'history' ? (vehicle?.id ?? null) : null)
  const live = useVehicleLive(vehicle?.id ?? null, tab === 'telematics')
  const update = useUpdateVehicle()
  const transition = useTransitionVehicle()

  // Reseed the form and reset tabs whenever a different vehicle is opened.
  useEffect(() => {
    if (!vehicle) return
    setForm(toEditState(vehicle))
    setTab('details')
    setPendingTarget('')
    setReason('')
  }, [vehicle?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof EditState>(key: K, value: EditState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const complianceOk =
    !complianceExpired(form.mulkiyaExpiry) &&
    Boolean(form.mulkiyaNumber) &&
    !complianceExpired(form.insuranceExpiry) &&
    Boolean(form.insurancePolicyNumber)
  const healthHold = Boolean(vehicle?.vendorHealthHold)
  const poolBlocked = !complianceOk || healthHold

  const allowedTransitions = vehicle
    ? (ALLOWED_VEHICLE_TRANSITIONS[
        vehicle.lifecycleStatus as VehicleLifecycleStatus
      ] ?? [])
    : []

  const reportFailure = (error: unknown, fallback: string) => {
    const requestError = error instanceof ApiRequestError ? error : null
    notify.danger(fallback, {
      description: requestError?.reasons
        ?.map((code) =>
          t(`vehicleManagement.detail.reasons.${code}`, { defaultValue: code }),
        )
        .join(' · '),
    })
  }

  const onSave = async () => {
    if (!vehicle) return
    const input: UpdateVehicleInput = {
      colour: form.colour || undefined,
      useCategoryCode: form.useCategoryCode || undefined,
      fuelTypeCode: form.fuelTypeCode || undefined,
      operationalStatus: form.operationalStatus
        ? (form.operationalStatus as VehicleOperationalStatus)
        : null,
      bookingPoolFlag: form.bookingPoolFlag && !poolBlocked,
      gpsStatus: form.gpsStatus as UpdateVehicleInput['gpsStatus'],
      trackerVendor: form.trackerVendor || undefined,
      trackerSerial: form.trackerSerial || undefined,
      mulkiyaNumber: form.mulkiyaNumber || undefined,
      mulkiyaExpiry: form.mulkiyaExpiry || undefined,
      insuranceProvider: form.insuranceProvider || undefined,
      insurancePolicyNumber: form.insurancePolicyNumber || undefined,
      insuranceExpiry: form.insuranceExpiry || undefined,
      fuelCardNumber: form.fuelCardNumber || undefined,
      salikTag: form.salikTag || undefined,
      darbTag: form.darbTag || undefined,
    }
    try {
      const updated = await update.mutateAsync({ id: vehicle.id, input })
      // PATCH omits the hierarchy-node join; keep the prior node fields.
      onUpdated({
        ...updated,
        hierarchyNodeId: vehicle.hierarchyNodeId,
        hierarchyNodeName: vehicle.hierarchyNodeName,
        hierarchyNodeNameAr: vehicle.hierarchyNodeNameAr,
      })
      notify.ok(t('vehicleManagement.detail.saved'))
      setTab('details')
    } catch (error) {
      reportFailure(error, t('vehicleManagement.detail.saveFailed'))
    }
  }

  const onTransition = async () => {
    if (!vehicle || !pendingTarget) return
    try {
      const updated = await transition.mutateAsync({
        id: vehicle.id,
        input: { toStatus: pendingTarget, reason: reason.trim() || undefined },
      })
      onUpdated({
        ...updated,
        hierarchyNodeId: vehicle.hierarchyNodeId,
        hierarchyNodeName: vehicle.hierarchyNodeName,
        hierarchyNodeNameAr: vehicle.hierarchyNodeNameAr,
      })
      notify.ok(t('vehicleManagement.detail.lifecycle.done'))
      setPendingTarget('')
      setReason('')
    } catch (error) {
      reportFailure(error, t('vehicleManagement.detail.lifecycle.failed'))
    }
  }

  const title = vehicle
    ? [vehicle.makeCode, vehicle.modelCode].filter(Boolean).join(' ') ||
      vehicle.bodyTypeCode
    : ''

  const tabs = [
    { value: 'details', label: t('vehicleManagement.detail.tabs.details') },
    { value: 'telematics', label: t('vehicleManagement.detail.tabs.telematics') },
    { value: 'edit', label: t('vehicleManagement.detail.tabs.edit') },
    { value: 'assignment', label: t('vehicleManagement.detail.tabs.assignment') },
    { value: 'documents', label: t('vehicleManagement.detail.tabs.documents') },
    { value: 'activity', label: t('vehicleManagement.detail.tabs.activity') },
    { value: 'lifecycle', label: t('vehicleManagement.detail.tabs.lifecycle') },
    { value: 'history', label: t('vehicleManagement.detail.tabs.history') },
  ]

  return (
    <Drawer
      open={vehicle !== null}
      onOpenChange={onOpenChange}
      eyebrow={t('vehicleManagement.detail.eyebrow')}
      title={title}
      description={vehicle ? <bdi>{vehicle.plate}</bdi> : ''}
      headerAccessory={
        vehicle ? (
          <StatusChip
            tone={lifecycleTone(vehicle.lifecycleStatus)}
            label={t(`vehicleManagement.status.${vehicle.lifecycleStatus}`)}
          />
        ) : null
      }
      width="xl"
      bodyClassName="space-y-5"
    >
      {vehicle ? (
        <>
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            aria-label={t('vehicleManagement.detail.tabsLabel')}
          >
            <TabsList className="w-full flex-nowrap overflow-x-auto">
              {tabs.map((tabDef) => (
                <TabsTrigger key={tabDef.value} value={tabDef.value}>
                  {tabDef.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {healthHold ? (
            <p className="rounded-[3px] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              {t('vehicleManagement.detail.healthHold', {
                reason:
                  vehicle.vendorHealthHoldReason ??
                  t('vehicleManagement.detail.healthHoldGeneric'),
              })}
            </p>
          ) : null}

          {tab === 'details' ? (
            <DetailsTab vehicle={vehicle} language={language} t={t} />
          ) : null}

          {tab === 'telematics' ? (
            <TelematicsTab
              live={live}
              vehicle={vehicle}
              language={language}
              t={t}
            />
          ) : null}

          {tab === 'edit' ? (
            <div className="space-y-5">
              <p className="rounded-[3px] border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t('vehicleManagement.detail.immutableNote')}
              </p>

              <Section title={t('vehicleManagement.detail.sections.classification')}>
                <LookupField
                  id="edit-use-category"
                  label={t('vehicleManagement.detail.fields.useCategory')}
                  value={form.useCategoryCode}
                  values={useCategories.data}
                  language={language}
                  onChange={(value) => set('useCategoryCode', value)}
                />
                <LookupField
                  id="edit-fuel-type"
                  label={t('vehicleManagement.detail.fields.fuelType')}
                  value={form.fuelTypeCode}
                  values={fuelTypes.data}
                  language={language}
                  onChange={(value) => set('fuelTypeCode', value)}
                />
                <TextField
                  id="edit-colour"
                  label={t('vehicleManagement.detail.fields.colour')}
                  value={form.colour}
                  onChange={(value) => set('colour', value)}
                />
              </Section>

              <Section title={t('vehicleManagement.detail.sections.operational')}>
                <EnumField
                  id="edit-operational"
                  label={t('vehicleManagement.detail.fields.operational')}
                  value={form.operationalStatus}
                  onChange={(value) => set('operationalStatus', value)}
                  options={[
                    {
                      value: '',
                      label: t('vehicleManagement.detail.operationalActive'),
                    },
                    ...VEHICLE_OPERATIONAL_STATUSES.map((code) => ({
                      value: code,
                      label: t(`vehicleManagement.status.${code}`),
                    })),
                  ]}
                />
                <div className="flex items-start justify-between gap-4 rounded-[3px] border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {t('vehicleManagement.detail.poolLabel')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {poolBlocked
                        ? healthHold
                          ? t('vehicleManagement.detail.poolHealthHint')
                          : t('vehicleManagement.detail.poolComplianceHint')
                        : t('vehicleManagement.detail.poolHint')}
                    </p>
                  </div>
                  <Switch
                    checked={form.bookingPoolFlag && !poolBlocked}
                    disabled={poolBlocked}
                    onCheckedChange={(checked) => set('bookingPoolFlag', checked)}
                    aria-label={t('vehicleManagement.detail.poolLabel')}
                  />
                </div>
              </Section>

              <Section title={t('vehicleManagement.detail.sections.compliance')}>
                <TextField
                  id="edit-mulkiya-number"
                  label={t('vehicleManagement.detail.fields.mulkiyaNumber')}
                  value={form.mulkiyaNumber}
                  onChange={(value) => set('mulkiyaNumber', value)}
                />
                <TextField
                  id="edit-mulkiya-expiry"
                  type="date"
                  label={t('vehicleManagement.detail.fields.mulkiyaExpiry')}
                  value={form.mulkiyaExpiry}
                  onChange={(value) => set('mulkiyaExpiry', value)}
                  invalid={complianceExpired(form.mulkiyaExpiry)}
                />
                <TextField
                  id="edit-insurance-provider"
                  label={t('vehicleManagement.detail.fields.insuranceProvider')}
                  value={form.insuranceProvider}
                  onChange={(value) => set('insuranceProvider', value)}
                />
                <TextField
                  id="edit-insurance-policy"
                  label={t('vehicleManagement.detail.fields.insurancePolicyNumber')}
                  value={form.insurancePolicyNumber}
                  onChange={(value) => set('insurancePolicyNumber', value)}
                />
                <TextField
                  id="edit-insurance-expiry"
                  type="date"
                  label={t('vehicleManagement.detail.fields.insuranceExpiry')}
                  value={form.insuranceExpiry}
                  onChange={(value) => set('insuranceExpiry', value)}
                  invalid={complianceExpired(form.insuranceExpiry)}
                />
              </Section>

              <Section title={t('vehicleManagement.detail.sections.telematics')}>
                <EnumField
                  id="edit-gps"
                  label={t('vehicleManagement.detail.fields.gps')}
                  value={form.gpsStatus}
                  onChange={(value) => set('gpsStatus', value)}
                  options={VEHICLE_GPS_STATUSES.map((code) => ({
                    value: code,
                    label: t(`vehicleManagement.status.${code}`),
                  }))}
                />
                <TextField
                  id="edit-tracker-vendor"
                  label={t('vehicleManagement.detail.fields.trackerVendor')}
                  value={form.trackerVendor}
                  onChange={(value) => set('trackerVendor', value)}
                />
                <TextField
                  id="edit-tracker-serial"
                  label={t('vehicleManagement.detail.fields.trackerSerial')}
                  value={form.trackerSerial}
                  onChange={(value) => set('trackerSerial', value)}
                />
                <TextField
                  id="edit-fuel-card"
                  label={t('vehicleManagement.detail.fields.fuelCard')}
                  value={form.fuelCardNumber}
                  onChange={(value) => set('fuelCardNumber', value)}
                />
                <TextField
                  id="edit-salik"
                  label={t('vehicleManagement.detail.fields.salik')}
                  value={form.salikTag}
                  onChange={(value) => set('salikTag', value)}
                />
                <TextField
                  id="edit-darb"
                  label={t('vehicleManagement.detail.fields.darb')}
                  value={form.darbTag}
                  onChange={(value) => set('darbTag', value)}
                />
              </Section>

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setForm(toEditState(vehicle))
                    setTab('details')
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void onSave()} disabled={update.isPending}>
                  {update.isPending
                    ? t('vehicleManagement.detail.saving')
                    : t('vehicleManagement.detail.save')}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'assignment' ? (
            <AssignmentTab
              vehicle={vehicle}
              language={language}
              t={t}
              onUpdated={onUpdated}
            />
          ) : null}

          {tab === 'documents' ? (
            <DocumentsTab vehicle={vehicle} t={t} />
          ) : null}

          {tab === 'activity' ? (
            <ActivityTab vehicle={vehicle} language={language} t={t} />
          ) : null}

          {tab === 'lifecycle' ? (
            <div className="space-y-4">
              <div className="rounded-[3px] border border-border p-3">
                <p className="eyebrow">
                  {t('vehicleManagement.detail.lifecycle.current')}
                </p>
                <div className="mt-2">
                  <StatusChip
                    tone={lifecycleTone(vehicle.lifecycleStatus)}
                    label={t(
                      `vehicleManagement.status.${vehicle.lifecycleStatus}`,
                    )}
                  />
                </div>
              </div>

              {allowedTransitions.length === 0 ? (
                <p className="rounded-[3px] border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {t('vehicleManagement.detail.lifecycle.terminal')}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">
                    {t('vehicleManagement.detail.lifecycle.moveTo')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allowedTransitions.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={pendingTarget === status ? 'default' : 'secondary'}
                        aria-pressed={pendingTarget === status}
                        onClick={() => setPendingTarget(status)}
                      >
                        {t(`vehicleManagement.status.${status}`)}
                      </Button>
                    ))}
                  </div>
                  {pendingTarget ? (
                    <div className="space-y-2 rounded-[3px] border border-border p-3">
                      <Label htmlFor="transition-reason" className="eyebrow block">
                        {t('vehicleManagement.detail.lifecycle.reason')}
                      </Label>
                      <Input
                        id="transition-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder={t(
                          'vehicleManagement.detail.lifecycle.reasonPlaceholder',
                        )}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => void onTransition()}
                          disabled={transition.isPending}
                        >
                          {transition.isPending
                            ? t('vehicleManagement.detail.lifecycle.transitioning')
                            : t('vehicleManagement.detail.lifecycle.confirm', {
                                status: t(
                                  `vehicleManagement.status.${pendingTarget}`,
                                ),
                              })}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {tab === 'history' ? (
            <div className="space-y-3">
              <p className="eyebrow">
                {t('vehicleManagement.detail.history.title')}
              </p>
              {history.isPending ? (
                <p className="text-sm text-muted-foreground">
                  {t('vehicleManagement.detail.history.loading')}
                </p>
              ) : history.isError ? (
                <p className="text-sm text-destructive">
                  {t('vehicleManagement.detail.history.failed')}
                </p>
              ) : (history.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('vehicleManagement.detail.history.empty')}
                </p>
              ) : (
                <ol className="space-y-2">
                  {history.data?.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-[3px] border border-border p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {entry.fromStatus
                          ? t('vehicleManagement.detail.history.from', {
                              from: t(
                                `vehicleManagement.status.${entry.fromStatus}`,
                                { defaultValue: entry.fromStatus },
                              ),
                              to: t(
                                `vehicleManagement.status.${entry.toStatus}`,
                                { defaultValue: entry.toStatus },
                              ),
                            })
                          : t('vehicleManagement.detail.history.initial', {
                              to: t(
                                `vehicleManagement.status.${entry.toStatus}`,
                                { defaultValue: entry.toStatus },
                              ),
                            })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat(language, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(entry.atUtc))}
                        {entry.actorRef
                          ? ` · ${t('vehicleManagement.detail.history.by', { actor: entry.actorRef })}`
                          : ''}
                      </p>
                      {entry.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </Drawer>
  )
}

function TelematicsTab({
  live,
  vehicle,
  language,
  t,
}: {
  live: ReturnType<typeof useVehicleLive>
  vehicle: Vehicle
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const data = live.data
  const fmt = (n: number | null | undefined, digits = 0) =>
    n === null || n === undefined
      ? '—'
      : new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(n)
  const km =
    data?.odometer ??
    (vehicle.lastConfirmedOdometer ? Number(vehicle.lastConfirmedOdometer) : null)
  const fuelPct =
    data?.fuelLevel === null || data?.fuelLevel === undefined
      ? null
      : Math.round(data.fuelLevel * 100)

  if (live.isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('vehicleManagement.detail.telematics.loading')}
      </p>
    )
  }
  if (live.isError) {
    return (
      <p className="text-sm text-destructive">
        {t('vehicleManagement.detail.telematics.failed')}
      </p>
    )
  }

  const lastSeen = data?.at
    ? new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(data.at))
    : t('vehicleManagement.detail.telematics.never')

  return (
    <div className="space-y-4">
      {vehicle.gpsStatus === 'NotInstalled' ? (
        <p className="rounded-[3px] border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t('vehicleManagement.detail.telematics.noDevice')}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-[3px] border border-border p-3">
        <div className="min-w-0">
          <p className="eyebrow">
            {t('vehicleManagement.detail.telematics.status')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('vehicleManagement.detail.telematics.lastSeen', {
              value: lastSeen,
            })}
          </p>
        </div>
        <StatusChip
          tone={data?.online ? 'ok' : 'neutral'}
          label={t(
            data?.online
              ? 'vehicleManagement.detail.telematics.online'
              : 'vehicleManagement.detail.telematics.offline',
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={t('vehicleManagement.detail.telematics.odometer')}
          value={
            km === null
              ? '—'
              : t('vehicleManagement.kilometres', { value: fmt(km, 0) })
          }
        />
        <Metric
          label={t('vehicleManagement.detail.telematics.fuel')}
          value={fuelPct === null ? '—' : `${fuelPct}%`}
        />
        <Metric
          label={t('vehicleManagement.detail.telematics.speed')}
          value={
            data?.speed === null || data?.speed === undefined
              ? '—'
              : t('vehicleManagement.detail.telematics.kmh', {
                  value: fmt(data.speed, 0),
                })
          }
        />
        <Metric
          label={t('vehicleManagement.detail.telematics.ignition')}
          value={
            data?.ignition === null || data?.ignition === undefined
              ? '—'
              : t(
                  data.ignition
                    ? 'vehicleManagement.detail.telematics.on'
                    : 'vehicleManagement.detail.telematics.off',
                )
          }
        />
      </div>

      <div className="rounded-[3px] border border-border p-3">
        <p className="eyebrow">
          {t('vehicleManagement.detail.telematics.position')}
        </p>
        {data?.lat != null && data?.lon != null ? (
          <a
            className="mt-1 inline-block text-sm font-medium text-info underline"
            href={`https://www.google.com/maps?q=${data.lat},${data.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            {fmt(data.lat, 5)}, {fmt(data.lon, 5)}
          </a>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('vehicleManagement.detail.telematics.noPosition')}
          </p>
        )}
      </div>

      {data?.dtcCodes && data.dtcCodes.length > 0 ? (
        <div className="rounded-[3px] border border-warning/40 bg-warning/10 p-3">
          <p className="eyebrow text-warning">
            {t('vehicleManagement.detail.telematics.dtc')}
          </p>
          <p className="font-data mt-1 text-sm text-warning">
            {data.dtcCodes.join(', ')}
          </p>
        </div>
      ) : null}

      <DevicePanel vehicleId={vehicle.id} language={language} t={t} />

      <p className="text-xs text-muted-foreground">
        {t('vehicleManagement.detail.telematics.masked')}
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-border p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}

const DOCUMENT_TYPES = [
  'MULKIYA',
  'INSURANCE',
  'REGISTRATION',
  'INSPECTION',
  'OTHER',
] as const

function ActivityTab({
  vehicle,
  language,
  t,
}: {
  vehicle: Vehicle
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const alerts = useVehicleAlerts(vehicle.id, true)
  const trips = useVehicleTrips(vehicle.id, true)
  const ack = useAcknowledgeAlert()

  const num = (n: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(n)
  const dt = (iso: string) =>
    new Intl.DateTimeFormat(language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

  const totalKm = (trips.data ?? []).reduce(
    (sum, trip) => sum + (trip.distanceKm ? Number(trip.distanceKm) : 0),
    0,
  )
  const openAlerts = (alerts.data ?? []).filter((a) => !a.acknowledgedAt).length

  const onAck = async (alertId: string) => {
    try {
      await ack.mutateAsync({ alertId, vehicleId: vehicle.id })
      notify.ok(t('vehicleManagement.detail.activity.acknowledged'))
    } catch {
      notify.danger(t('vehicleManagement.detail.activity.ackFailed'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={t('vehicleManagement.detail.activity.totalDistance')}
          value={t('vehicleManagement.kilometres', { value: num(totalKm) })}
        />
        <Metric
          label={t('vehicleManagement.detail.activity.tripCount')}
          value={num(trips.data?.length ?? 0)}
        />
        <Metric
          label={t('vehicleManagement.detail.activity.openAlerts')}
          value={num(openAlerts)}
        />
        <Metric
          label={t('vehicleManagement.detail.activity.efficiency')}
          value={
            vehicle.fuelEfficiencyKmpl
              ? t('vehicleManagement.detail.activity.kmpl', {
                  value: vehicle.fuelEfficiencyKmpl,
                })
              : '—'
          }
        />
      </div>

      <section className="space-y-2">
        <p className="eyebrow">
          {t('vehicleManagement.detail.activity.alertsTitle')}
        </p>
        {alerts.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.activity.loading')}
          </p>
        ) : (alerts.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.activity.noAlerts')}
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.data?.map((alert) => (
              <li
                key={alert.id}
                className="rounded-[3px] border border-border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {t(
                      `vehicleManagement.detail.activity.alertTypes.${alert.alertType}`,
                      { defaultValue: alert.alertType },
                    )}
                  </p>
                  {alert.acknowledgedAt ? (
                    <StatusChip
                      tone="neutral"
                      label={t('vehicleManagement.detail.activity.ackChip')}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onAck(alert.id)}
                      disabled={ack.isPending}
                    >
                      {t('vehicleManagement.detail.activity.ack')}
                    </Button>
                  )}
                </div>
                {alert.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {alert.detail}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {dt(alert.raisedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <p className="eyebrow">
          {t('vehicleManagement.detail.activity.tripsTitle')}
        </p>
        {trips.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.activity.loading')}
          </p>
        ) : (trips.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.activity.noTrips')}
          </p>
        ) : (
          <ul className="space-y-2">
            {trips.data?.map((trip) => (
              <li
                key={trip.id}
                className="rounded-[3px] border border-border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {trip.distanceKm
                      ? t('vehicleManagement.kilometres', {
                          value: num(Number(trip.distanceKm)),
                        })
                      : t('vehicleManagement.detail.activity.ongoing')}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {trip.attributionBasis === 'booking'
                      ? t('vehicleManagement.detail.activity.attributed')
                      : t('vehicleManagement.detail.activity.unattributed')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dt(trip.startedAt)}
                  {trip.endedAt ? ` → ${dt(trip.endedAt)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function DocumentsTab({
  vehicle,
  t,
}: {
  vehicle: Vehicle
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const docs = useVehicleDocuments(vehicle.id, true)
  const add = useAddVehicleDocument()
  const [docType, setDocType] = useState<string>('MULKIYA')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [blobRef, setBlobRef] = useState('')

  const expired = (value: string | null) =>
    !!value && value < new Date().toISOString().slice(0, 10)

  const onAdd = async () => {
    try {
      await add.mutateAsync({
        id: vehicle.id,
        input: {
          docTypeCode: docType,
          issueDate: issueDate || undefined,
          expiryDate: expiryDate || undefined,
          blobRef: blobRef.trim() || undefined,
        },
      })
      notify.ok(t('vehicleManagement.detail.documents.added'))
      setIssueDate('')
      setExpiryDate('')
      setBlobRef('')
    } catch (error) {
      const requestError = error instanceof ApiRequestError ? error : null
      notify.danger(t('vehicleManagement.detail.documents.failed'), {
        description: requestError?.reasons?.join(' · '),
      })
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-[3px] border border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('vehicleManagement.detail.documents.add')}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <EnumField
            id="doc-type"
            label={t('vehicleManagement.detail.documents.type')}
            value={docType}
            onChange={setDocType}
            options={DOCUMENT_TYPES.map((code) => ({
              value: code,
              label: t(`vehicleManagement.detail.documents.types.${code}`),
            }))}
          />
          <TextField
            id="doc-ref"
            label={t('vehicleManagement.detail.documents.reference')}
            value={blobRef}
            onChange={setBlobRef}
          />
          <TextField
            id="doc-issue"
            type="date"
            label={t('vehicleManagement.detail.documents.issueDate')}
            value={issueDate}
            onChange={setIssueDate}
          />
          <TextField
            id="doc-expiry"
            type="date"
            label={t('vehicleManagement.detail.documents.expiryDate')}
            value={expiryDate}
            onChange={setExpiryDate}
            invalid={expired(expiryDate || null)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void onAdd()} disabled={add.isPending}>
            {add.isPending
              ? t('vehicleManagement.detail.documents.adding')
              : t('vehicleManagement.detail.documents.addVersion')}
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <p className="eyebrow">{t('vehicleManagement.detail.documents.title')}</p>
        {docs.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.documents.loading')}
          </p>
        ) : (docs.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.documents.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.data?.map((doc) => (
              <li
                key={doc.id}
                className="rounded-[3px] border border-border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {t(
                      `vehicleManagement.detail.documents.types.${doc.docTypeCode}`,
                      { defaultValue: doc.docTypeCode },
                    )}{' '}
                    <span className="text-xs text-muted-foreground">
                      v{doc.version}
                    </span>
                  </p>
                  {expired(doc.expiryDate) ? (
                    <StatusChip
                      tone="danger"
                      label={t('vehicleManagement.detail.documents.expired')}
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('vehicleManagement.detail.documents.issued', {
                    value: doc.issueDate ?? '—',
                  })}
                  {' · '}
                  {t('vehicleManagement.detail.documents.expires', {
                    value: doc.expiryDate ?? '—',
                  })}
                </p>
                {doc.blobRef ? (
                  <a
                    href={doc.blobRef}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-info underline"
                  >
                    {t('vehicleManagement.detail.documents.open')}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AssignmentTab({
  vehicle,
  language,
  t,
  onUpdated,
}: {
  vehicle: Vehicle
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
  onUpdated: (vehicle: Vehicle) => void
}) {
  const { me } = useAuth()
  const hierarchy = useHierarchy()
  const transfers = useVehicleTransfers(vehicle.id, true)
  const transfer = useTransferVehicle()
  const update = useUpdateVehicle()
  const [toNodeId, setToNodeId] = useState('')
  const [reason, setReason] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const users = useUsers({ search: driverSearch.trim() || undefined, pageSize: 8 })

  const nodes = useMemo(() => {
    const tree = hierarchy.data ?? []
    const authorizedIds = new Set(
      (me?.roles ?? [])
        .filter((role) => FLEET_WRITE_ROLES.has(role.role))
        .flatMap((role) => descendantsOf(tree, role.scopeNodeId)),
    )
    return flattenHierarchy(tree).filter(
      (node) => authorizedIds.has(node.id) && node.id !== vehicle.hierarchyNodeId,
    )
  }, [hierarchy.data, me?.roles, vehicle.hierarchyNodeId])

  const report = (error: unknown, fallback: string) => {
    const requestError = error instanceof ApiRequestError ? error : null
    notify.danger(fallback, {
      description: requestError?.reasons
        ?.map((code) =>
          t(`vehicleManagement.detail.reasons.${code}`, { defaultValue: code }),
        )
        .join(' · '),
    })
  }

  const onTransfer = async () => {
    if (!toNodeId) return
    try {
      await transfer.mutateAsync({
        id: vehicle.id,
        input: { toNodeId, reason: reason.trim() || undefined },
      })
      const node = nodes.find((n) => n.id === toNodeId)
      onUpdated({
        ...vehicle,
        hierarchyNodeId: toNodeId,
        hierarchyNodeName: node?.name ?? null,
        hierarchyNodeNameAr: node?.name ?? null,
      })
      notify.ok(t('vehicleManagement.detail.assignment.transferred'))
      setToNodeId('')
      setReason('')
    } catch (error) {
      report(error, t('vehicleManagement.detail.assignment.transferFailed'))
    }
  }

  const assignDriver = async (personId: string | null) => {
    try {
      const updated = await update.mutateAsync({
        id: vehicle.id,
        input: { assignedDriverPersonId: personId },
      })
      onUpdated({
        ...updated,
        hierarchyNodeId: vehicle.hierarchyNodeId,
        hierarchyNodeName: vehicle.hierarchyNodeName,
        hierarchyNodeNameAr: vehicle.hierarchyNodeNameAr,
      })
      notify.ok(
        t(
          personId
            ? 'vehicleManagement.detail.assignment.driverAssigned'
            : 'vehicleManagement.detail.assignment.driverUnassigned',
        ),
      )
      setDriverSearch('')
    } catch (error) {
      report(error, t('vehicleManagement.detail.assignment.driverFailed'))
    }
  }

  const currentNodeName =
    (language.startsWith('ar')
      ? vehicle.hierarchyNodeNameAr
      : vehicle.hierarchyNodeName) ?? t('vehicleManagement.unassigned')

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-[3px] border border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('vehicleManagement.detail.assignment.transferTitle')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('vehicleManagement.detail.assignment.currentNode', {
            node: currentNodeName,
          })}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="transfer-node" className="eyebrow block">
            {t('vehicleManagement.detail.assignment.toNode')}
          </Label>
          <Select value={toNodeId || undefined} onValueChange={setToNodeId}>
            <SelectTrigger id="transfer-node" className="h-11 bg-background">
              <SelectValue
                placeholder={t('vehicleManagement.detail.assignment.toNode')}
              />
            </SelectTrigger>
            <SelectContent>
              {nodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {'—'.repeat(node.depth)} {node.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transfer-reason" className="eyebrow block">
            {t('vehicleManagement.detail.assignment.reason')}
          </Label>
          <Input
            id="transfer-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => void onTransfer()}
            disabled={!toNodeId || transfer.isPending}
          >
            {transfer.isPending
              ? t('vehicleManagement.detail.assignment.transferring')
              : t('vehicleManagement.detail.assignment.transfer')}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="eyebrow">
            {t('vehicleManagement.detail.assignment.historyTitle')}
          </p>
          {transfers.isPending ? (
            <p className="text-sm text-muted-foreground">
              {t('vehicleManagement.detail.assignment.loading')}
            </p>
          ) : (transfers.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('vehicleManagement.detail.assignment.noTransfers')}
            </p>
          ) : (
            <ol className="space-y-2">
              {transfers.data?.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-[3px] border border-border p-2 text-sm"
                >
                  <p className="font-medium">
                    {(entry.fromNodeName ??
                      t('vehicleManagement.unassigned')) +
                      ' → ' +
                      (entry.toNodeName ?? '—')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(language, {
                      dateStyle: 'medium',
                    }).format(new Date(entry.effectiveDate))}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-[3px] border border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t('vehicleManagement.detail.assignment.driverTitle')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {vehicle.assignedDriverPersonId
            ? t('vehicleManagement.detail.assignment.driverCurrent')
            : t('vehicleManagement.detail.assignment.driverNone')}
        </p>
        <Input
          value={driverSearch}
          onChange={(event) => setDriverSearch(event.target.value)}
          placeholder={t('vehicleManagement.detail.assignment.driverSearch')}
          aria-label={t('vehicleManagement.detail.assignment.driverSearch')}
        />
        <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-[3px] border border-border">
          {(users.data?.items ?? []).map((person) => (
            <button
              key={person.personId}
              type="button"
              onClick={() => void assignDriver(person.personId)}
              disabled={update.isPending}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start hover:bg-surface-hover disabled:opacity-50"
            >
              <span className="text-sm font-medium">{person.name}</span>
              <span className="text-xs text-muted-foreground">
                {person.employeeId}
              </span>
            </button>
          ))}
          {(users.data?.items?.length ?? 0) === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t('vehicleManagement.detail.assignment.noPeople')}
            </p>
          ) : null}
        </div>
        {vehicle.assignedDriverPersonId &&
        vehicle.assignmentModel !== 'Dedicated' ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => void assignDriver(null)}
              disabled={update.isPending}
            >
              {t('vehicleManagement.detail.assignment.unassignDriver')}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function DevicePanel({
  vehicleId,
  language,
  t,
}: {
  vehicleId: string
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const deviceQuery = useVehicleDevice(vehicleId, true)
  const devices = useDevices()
  const pair = usePairDevice()
  const unpair = useUnpairDevice()
  const register = useRegisterDevice()
  const [selected, setSelected] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [model, setModel] = useState('')
  const [sim, setSim] = useState('')

  const current = deviceQuery.data

  const report = (error: unknown, fallback: string) => {
    const requestError = error instanceof ApiRequestError ? error : null
    notify.danger(fallback, { description: requestError?.reasons?.join(' · ') })
  }
  const onPair = async () => {
    if (!selected) return
    try {
      await pair.mutateAsync({ deviceId: selected, vehicleId })
      notify.ok(t('vehicleManagement.detail.device.paired'))
      setSelected('')
    } catch (error) {
      report(error, t('vehicleManagement.detail.device.failed'))
    }
  }
  const onUnpair = async () => {
    if (!current) return
    try {
      await unpair.mutateAsync({ deviceId: current.deviceId, vehicleId })
      notify.ok(t('vehicleManagement.detail.device.unpaired'))
    } catch (error) {
      report(error, t('vehicleManagement.detail.device.failed'))
    }
  }
  const onRegister = async () => {
    if (!identifier.trim()) return
    try {
      const created = await register.mutateAsync({
        identifier: identifier.trim(),
        model: model.trim() || undefined,
        sim: sim.trim() || undefined,
      })
      notify.ok(t('vehicleManagement.detail.device.registered'))
      setIdentifier('')
      setModel('')
      setSim('')
      setShowRegister(false)
      setSelected(created.id)
    } catch (error) {
      report(error, t('vehicleManagement.detail.device.failed'))
    }
  }

  return (
    <section className="space-y-3 rounded-[3px] border border-border p-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('vehicleManagement.detail.device.title')}
      </h3>
      {deviceQuery.isPending ? (
        <p className="text-sm text-muted-foreground">
          {t('vehicleManagement.detail.device.loading')}
        </p>
      ) : current ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-data text-sm font-semibold">{current.identifier}</p>
            <StatusChip
              tone={current.status === 'Active' ? 'ok' : 'neutral'}
              label={current.status}
            />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <dt className="uppercase">{t('vehicleManagement.detail.device.model')}</dt>
              <dd className="text-foreground">{current.model || '—'}</dd>
            </div>
            <div>
              <dt className="uppercase">{t('vehicleManagement.detail.device.sim')}</dt>
              <dd className="text-foreground">{current.sim || '—'}</dd>
            </div>
            <div>
              <dt className="uppercase">{t('vehicleManagement.detail.device.firmware')}</dt>
              <dd className="text-foreground">{current.firmware || '—'}</dd>
            </div>
            <div>
              <dt className="uppercase">{t('vehicleManagement.detail.device.pairedSince')}</dt>
              <dd className="text-foreground">
                {current.pairedSince
                  ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(
                      new Date(current.pairedSince),
                    )
                  : '—'}
              </dd>
            </div>
          </dl>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="text-destructive"
              onClick={() => void onUnpair()}
              disabled={unpair.isPending}
            >
              {unpair.isPending
                ? t('vehicleManagement.detail.device.unpairing')
                : t('vehicleManagement.detail.device.unpair')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t('vehicleManagement.detail.device.none')}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="pair-device" className="eyebrow block">
                {t('vehicleManagement.detail.device.selectDevice')}
              </Label>
              <Select value={selected || undefined} onValueChange={setSelected}>
                <SelectTrigger id="pair-device" className="h-11 bg-background">
                  <SelectValue
                    placeholder={t('vehicleManagement.detail.device.selectDevice')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(devices.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.identifier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void onPair()} disabled={!selected || pair.isPending}>
              {pair.isPending
                ? t('vehicleManagement.detail.device.pairing')
                : t('vehicleManagement.detail.device.pair')}
            </Button>
          </div>
          {(devices.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('vehicleManagement.detail.device.noDevices')}
            </p>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRegister((s) => !s)}
          >
            {t('vehicleManagement.detail.device.register')}
          </Button>
          {showRegister ? (
            <div className="space-y-2 rounded-[3px] border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label htmlFor="dev-id" className="eyebrow block">
                    {t('vehicleManagement.detail.device.identifier')}
                  </Label>
                  <Input
                    id="dev-id"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dev-model" className="eyebrow block">
                    {t('vehicleManagement.detail.device.model')}
                  </Label>
                  <Input id="dev-model" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dev-sim" className="eyebrow block">
                    {t('vehicleManagement.detail.device.sim')}
                  </Label>
                  <Input id="dev-sim" value={sim} onChange={(e) => setSim(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void onRegister()}
                  disabled={!identifier.trim() || register.isPending}
                >
                  {register.isPending
                    ? t('vehicleManagement.detail.device.registering')
                    : t('vehicleManagement.detail.device.registerConfirm')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function DetailsTab({
  vehicle,
  language,
  t,
}: {
  vehicle: Vehicle
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const nodeName =
    language.startsWith('ar')
      ? (vehicle.hierarchyNodeNameAr ?? vehicle.hierarchyNodeName)
      : vehicle.hierarchyNodeName
  const rows: Array<[string, ReactNode]> = [
    [t('vehicleManagement.detail.fields.vin'), vehicle.chassisVin],
    [
      t('vehicleManagement.detail.fields.bodyType'),
      vehicle.bodyTypeCode || '—',
    ],
    [
      t('vehicleManagement.detail.fields.useCategory'),
      vehicle.useCategoryCode || '—',
    ],
    [t('vehicleManagement.detail.fields.fuelType'), vehicle.fuelTypeCode || '—'],
    [
      t('vehicleManagement.detail.fields.ownership'),
      vehicle.ownership || '—',
    ],
    [
      t('vehicleManagement.detail.fields.leaseRef'),
      vehicle.leaseContractRef || '—',
    ],
    [
      t('vehicleManagement.detail.fields.node'),
      nodeName ?? t('vehicleManagement.unassigned'),
    ],
    [
      t('vehicleManagement.detail.fields.operational'),
      vehicle.operationalStatus
        ? t(`vehicleManagement.status.${vehicle.operationalStatus}`)
        : t('vehicleManagement.detail.operationalActive'),
    ],
    [
      t('vehicleManagement.detail.fields.pool'),
      vehicle.bookingPoolFlag
        ? t('vehicleManagement.detail.yes')
        : t('vehicleManagement.detail.no'),
    ],
    [
      t('vehicleManagement.detail.fields.gps'),
      t(`vehicleManagement.status.${vehicle.gpsStatus}`),
    ],
    [
      t('vehicleManagement.detail.fields.mulkiyaExpiry'),
      vehicle.mulkiyaExpiry ?? '—',
    ],
    [
      t('vehicleManagement.detail.fields.insuranceExpiry'),
      vehicle.insuranceExpiry ?? '—',
    ],
    [t('vehicleManagement.detail.fields.salik'), vehicle.salikTag || '—'],
    [t('vehicleManagement.detail.fields.darb'), vehicle.darbTag || '—'],
    [
      t('vehicleManagement.detail.fields.year'),
      vehicle.year != null ? String(vehicle.year) : '—',
    ],
    [t('vehicleManagement.detail.fields.colour'), vehicle.colour || '—'],
    [
      t('vehicleManagement.detail.fields.seating'),
      vehicle.seatingCapacity != null ? String(vehicle.seatingCapacity) : '—',
    ],
    [
      t('vehicleManagement.detail.fields.odometer'),
      vehicle.lastConfirmedOdometer
        ? t('vehicleManagement.kilometres', {
            value: new Intl.NumberFormat(language).format(
              Number(vehicle.lastConfirmedOdometer),
            ),
          })
        : '—',
    ],
    [t('vehicleManagement.detail.fields.sim'), vehicle.sim || '—'],
    [
      t('vehicleManagement.detail.fields.nextMaintenance'),
      vehicle.nextMaintenanceDue ?? '—',
    ],
    [
      t('vehicleManagement.detail.fields.coverage'),
      vehicle.insuranceCoverageType || '—',
    ],
    [
      t('vehicleManagement.detail.fields.depreciation'),
      vehicle.depreciationRate ?? '—',
    ],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {rows.map(([label, value], index) => (
        <div key={index} className="min-w-0">
          <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  invalid?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="eyebrow block text-start">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        className={invalid ? 'border-destructive' : undefined}
      />
    </div>
  )
}

function EnumField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  // Radix Select cannot hold an empty-string value, so map '' ↔ a sentinel.
  const EMPTY = '__none__'
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="eyebrow block text-start">
        {label}
      </Label>
      <Select
        value={value === '' ? EMPTY : value}
        onValueChange={(next) => onChange(next === EMPTY ? '' : next)}
      >
        <SelectTrigger id={id} className="h-11 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value || EMPTY}
              value={option.value === '' ? EMPTY : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function LookupField({
  id,
  label,
  value,
  values,
  language,
  onChange,
}: {
  id: string
  label: string
  value: string
  values: LookupValue[] | undefined
  language: string
  onChange: (value: string) => void
}) {
  const flat = useMemo(
    () => (values ?? []).flatMap((v) => [v, ...(v.children ?? [])]),
    [values],
  )
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="eyebrow block text-start">
        {label}
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {flat.map((option) => (
            <SelectItem key={option.id} value={option.code}>
              {localizedLabel(option, language)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
