import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  RadioTower,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusChip } from '@/components/ui/status-chip'
import { Switch } from '@/components/ui/switch'
import { useLookupValues } from '@/features/config/hooks/use-lookups'
import type { LookupValue } from '@/features/config/config.contract'
import { useAuth } from '@/features/auth/auth-context'
import { useHierarchy } from '@/features/platform/hooks/use-hierarchy'
import {
  descendantsOf,
  flattenHierarchy,
} from '@/features/platform/platform.contract'
import { ApiRequestError } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { notify } from '@/hooks/use-toast'
import { useCreateVehicle } from './hooks/use-vehicles'
import {
  useVendorLeases,
  useVendors,
} from '@/features/vendors/hooks/use-vendors'
import type { CreateVehicleInput } from './vehicle.contract'
import type { Vehicle } from './vehicle.contract'

const STEPS = [
  'acquisition',
  'identity',
  'hierarchy',
  'compliance',
  'review',
] as const
const FLEET_WRITE_ROLES = new Set([
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
  'DataSteward',
  'SystemAdmin',
])

const OPERATIONAL_STATUS_BY_LOOKUP_CODE: Record<
  string,
  CreateVehicleInput['operationalStatus']
> = {
  ACTIVE: null,
  RESERVE: 'Reserve',
  STANDBY: 'Standby',
  VIP_ONLY: 'VIPOnly',
  QUARANTINED: 'Quarantined',
  TEMPORARY_HOLD: 'TemporaryHold',
}

interface VehicleDraft {
  acquisitionScenario: string
  vendorId: string
  leaseContractId: string
  monthlyRental: string
  currency: string
  purchaseOrLeaseStart: string
  leaseEnd: string
  chassisVin: string
  plate: string
  makeCode: string
  modelCode: string
  year: string
  bodyTypeCode: string
  useCategoryCode: string
  seatingCapacity: string
  fuelTypeCode: string
  fuelEfficiencyKmpl: string
  homeNodeId: string
  operationalStatus: string
  includeInPool: boolean
  mulkiyaNumber: string
  mulkiyaExpiry: string
  insuranceProvider: string
  insurancePolicyNumber: string
  insuranceExpiry: string
  telematicsSetup: string
  trackerVendor: string
  trackerSerial: string
  fuelCardNumber: string
  salikTag: string
  darbTag: string
}

const initialDraft: VehicleDraft = {
  acquisitionScenario: 'LEASED',
  vendorId: '',
  leaseContractId: '',
  monthlyRental: '',
  currency: 'AED',
  purchaseOrLeaseStart: '',
  leaseEnd: '',
  chassisVin: '',
  plate: '',
  makeCode: '',
  modelCode: '',
  year: '',
  bodyTypeCode: '',
  useCategoryCode: '',
  seatingCapacity: '',
  fuelTypeCode: '',
  fuelEfficiencyKmpl: '',
  homeNodeId: '',
  operationalStatus: 'ACTIVE',
  includeInPool: true,
  mulkiyaNumber: '',
  mulkiyaExpiry: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
  insuranceExpiry: '',
  telematicsSetup: 'INSTALL',
  trackerVendor: '',
  trackerSerial: '',
  fuelCardNumber: '',
  salikTag: '',
  darbTag: '',
}

function localizedLabel(value: LookupValue, language: string): string {
  return language.startsWith('ar') ? value.labelAr : value.labelEn
}

function findLookup(
  values: LookupValue[] | undefined,
  code: string,
): LookupValue | undefined {
  return values
    ?.flatMap((value) => [value, ...(value.children ?? [])])
    .find((value) => value.code === code)
}

function isCurrentDate(value: string): boolean {
  return Boolean(value && value >= new Date().toISOString().slice(0, 10))
}

function LookupSelect({
  id,
  value,
  values,
  language,
  placeholder,
  onChange,
  disabled,
}: {
  id: string
  value: string
  values: LookupValue[] | undefined
  language: string
  placeholder: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-11 bg-background">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(values ?? []).map((option) => (
          <SelectItem key={option.id} value={option.code}>
            {localizedLabel(option, language)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="eyebrow block text-start">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function ChoiceGrid({
  values,
  value,
  language,
  onChange,
}: {
  values: LookupValue[] | undefined
  value: string
  language: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(values ?? []).map((option) => {
        const active = option.code === value
        const description = language.startsWith('ar')
          ? option.descriptionAr
          : option.descriptionEn
        return (
          <button
            type="button"
            key={option.id}
            aria-label={localizedLabel(option, language)}
            onClick={() => onChange(option.code)}
            aria-pressed={active}
            className={cn(
              'min-h-28 rounded-[3px] border p-4 text-start transition-colors',
              active
                ? 'border-brand bg-brand-soft'
                : 'border-border bg-card hover:bg-muted',
            )}
          >
            <span className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 grid size-5 place-items-center rounded-full border',
                  active && 'border-brand bg-brand text-brand-foreground',
                )}
              >
                {active ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : null}
              </span>
              <span>
                <span className="block font-semibold">
                  {localizedLabel(option, language)}
                </span>
                {description ? (
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Five-step, lookup-driven Vehicle Onboarding workflow (V1 screens 10-14). */
export function VehicleOnboardingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { me } = useAuth()
  const createVehicle = useCreateVehicle()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<VehicleDraft>(initialDraft)
  const [createdVehicle, setCreatedVehicle] = useState<Vehicle | null>(null)
  const vendors = useVendors()
  const leases = useVendorLeases(draft.vendorId || null)
  const activeVendors = useMemo(
    () => vendors.data?.filter((vendor) => vendor.status === 'Active') ?? [],
    [vendors.data],
  )
  const usableLeases = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return (
      leases.data?.filter(
        (lease) =>
          (lease.status === 'Active' || lease.status === 'ExpiringSoon') &&
          (!lease.endDate || lease.endDate >= today),
      ) ?? []
    )
  }, [leases.data])
  const acquisition = useLookupValues('vehicle-acquisition-scenario')
  const operational = useLookupValues('vehicle-operational-status')
  const telematics = useLookupValues('vehicle-telematics-setup')
  const currencies = useLookupValues('currency')
  const ownership = useLookupValues('ownership-type')
  const bodyTypes = useLookupValues('vehicle-body-type')
  const useCategories = useLookupValues('use-category')
  const fuelTypes = useLookupValues('fuel-type')
  const makes = useLookupValues('vehicle-make')
  const hierarchy = useHierarchy()

  const flatHierarchy = useMemo(() => {
    const tree = hierarchy.data ?? []
    const authorizedIds = new Set(
      (me?.roles ?? [])
        .filter((role) => FLEET_WRITE_ROLES.has(role.role))
        .flatMap((role) => descendantsOf(tree, role.scopeNodeId)),
    )
    return flattenHierarchy(tree).filter((node) => authorizedIds.has(node.id))
  }, [hierarchy.data, me?.roles])
  const makeOptions = useMemo(
    () => (makes.data ?? []).filter((value) => value.parentId === null),
    [makes.data],
  )
  const modelOptions = useMemo(() => {
    const selectedMake = makes.data?.find(
      (value) => value.code === draft.makeCode,
    )
    if (!selectedMake) return []
    const nested = selectedMake.children ?? []
    const flat = (makes.data ?? []).filter(
      (value) => value.parentId === selectedMake.id,
    )
    return nested.length ? nested : flat
  }, [makes.data, draft.makeCode])
  const lookupQueries = [
    acquisition,
    operational,
    telematics,
    currencies,
    ownership,
    bodyTypes,
    useCategories,
    fuelTypes,
    makes,
  ]
  const lookupsLoading =
    lookupQueries.some((query) => query.isLoading) || hierarchy.isLoading
  const lookupsFailed =
    lookupQueries.some((query) => query.isError) || hierarchy.isError

  useEffect(() => {
    if (!draft.bodyTypeCode && bodyTypes.data?.[0])
      setDraft((current) => ({
        ...current,
        bodyTypeCode: bodyTypes.data![0].code,
      }))
    if (!draft.useCategoryCode && useCategories.data?.[0])
      setDraft((current) => ({
        ...current,
        useCategoryCode: useCategories.data![0].code,
      }))
    if (!draft.fuelTypeCode && fuelTypes.data?.[0])
      setDraft((current) => ({
        ...current,
        fuelTypeCode: fuelTypes.data![0].code,
      }))
    if (!draft.makeCode && makeOptions[0])
      setDraft((current) => ({ ...current, makeCode: makeOptions[0].code }))
    if (!draft.homeNodeId && flatHierarchy[0])
      setDraft((current) => ({ ...current, homeNodeId: flatHierarchy[0].id }))
  }, [
    bodyTypes.data,
    draft.bodyTypeCode,
    draft.fuelTypeCode,
    draft.homeNodeId,
    draft.makeCode,
    draft.useCategoryCode,
    flatHierarchy,
    fuelTypes.data,
    makeOptions,
    useCategories.data,
  ])

  useEffect(() => {
    if (
      modelOptions.length &&
      !modelOptions.some((model) => model.code === draft.modelCode)
    ) {
      setDraft((current) => ({ ...current, modelCode: modelOptions[0].code }))
    }
  }, [draft.modelCode, modelOptions])

  const set = <K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const complianceComplete = Boolean(
    draft.mulkiyaNumber &&
    isCurrentDate(draft.mulkiyaExpiry) &&
    draft.insurancePolicyNumber &&
    isCurrentDate(draft.insuranceExpiry),
  )
  const identityComplete = Boolean(
    draft.chassisVin &&
    draft.plate &&
    draft.makeCode &&
    draft.modelCode &&
    draft.bodyTypeCode,
  )
  const hierarchyComplete = Boolean(draft.homeNodeId && draft.operationalStatus)
  const completionItems = [
    true,
    identityComplete,
    hierarchyComplete,
    complianceComplete,
    Boolean(draft.telematicsSetup),
  ]
  const completionPercent = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100,
  )
  const isLeasedAcquisition =
    draft.acquisitionScenario === 'LEASED' ||
    draft.acquisitionScenario === 'LEASE_REPLACEMENT'

  const canContinue = (() => {
    if (step === 0) {
      if (isLeasedAcquisition) {
        return Boolean(
          draft.vendorId &&
          draft.leaseContractId &&
          draft.monthlyRental &&
          draft.purchaseOrLeaseStart &&
          draft.leaseEnd,
        )
      }
      return Boolean(draft.acquisitionScenario)
    }
    if (step === 1) return identityComplete
    if (step === 2) return hierarchyComplete
    return true
  })()

  const operationalValue =
    OPERATIONAL_STATUS_BY_LOOKUP_CODE[draft.operationalStatus]
  const gpsStatus: CreateVehicleInput['gpsStatus'] =
    draft.telematicsSetup === 'MANUAL' ? 'NotInstalled' : 'Installed'
  const ownershipValue: CreateVehicleInput['ownership'] = isLeasedAcquisition
    ? 'Leased'
    : 'Owned'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (operationalValue === undefined) {
      notify.danger(t('vehicleOnboarding.submitFailed'), {
        description: t('vehicleOnboarding.unsupportedOperationalStatus', {
          code: draft.operationalStatus,
        }),
      })
      return
    }
    const payload: CreateVehicleInput = {
      plate: draft.plate.trim(),
      chassisVin: draft.chassisVin.trim(),
      bodyTypeCode: draft.bodyTypeCode,
      makeCode: draft.makeCode,
      modelCode: draft.modelCode,
      year: draft.year ? Number(draft.year) : undefined,
      useCategoryCode: draft.useCategoryCode,
      seatingCapacity: draft.seatingCapacity
        ? Number(draft.seatingCapacity)
        : undefined,
      fuelTypeCode: draft.fuelTypeCode,
      fuelEfficiencyKmpl: draft.fuelEfficiencyKmpl || undefined,
      ownership: ownershipValue,
      purchaseOrLeaseStart: draft.purchaseOrLeaseStart || undefined,
      leaseEnd: draft.leaseEnd || undefined,
      monthlyRental: draft.monthlyRental || undefined,
      currency: draft.currency,
      ...(ownershipValue === 'Leased'
        ? {
            vendorId: draft.vendorId,
            leaseContractId: draft.leaseContractId,
          }
        : {}),
      homeNodeId: draft.homeNodeId,
      operationalStatus: operationalValue,
      bookingPoolFlag: draft.includeInPool && complianceComplete,
      mulkiyaNumber: draft.mulkiyaNumber || undefined,
      mulkiyaExpiry: draft.mulkiyaExpiry || undefined,
      insuranceProvider: draft.insuranceProvider || undefined,
      insurancePolicyNumber: draft.insurancePolicyNumber || undefined,
      insuranceExpiry: draft.insuranceExpiry || undefined,
      fuelCardNumber: draft.fuelCardNumber || undefined,
      salikTag: draft.salikTag || undefined,
      darbTag: draft.darbTag || undefined,
      trackerVendor: draft.trackerVendor || undefined,
      trackerSerial: draft.trackerSerial || undefined,
      gpsStatus,
    }
    try {
      const vehicle = await createVehicle.mutateAsync(payload)
      notify.ok(t('vehicleOnboarding.successTitle'), {
        description: vehicle.bookingPoolFlag
          ? t('vehicleOnboarding.successActive')
          : t('vehicleOnboarding.successBlocked'),
      })
      setCreatedVehicle(vehicle)
    } catch (error) {
      const requestError = error instanceof ApiRequestError ? error : null
      notify.danger(t('vehicleOnboarding.submitFailed'), {
        description: requestError?.reasons
          ?.map((reason) =>
            t(`vehicleOnboarding.reasons.${reason}`, { defaultValue: reason }),
          )
          .join(' · '),
      })
    }
  }

  if (lookupsFailed) {
    return (
      <div className="rounded-[3px] border border-destructive/30 bg-destructive/10 p-6">
        <h1 className="text-lg font-bold">
          {t('vehicleOnboarding.lookupFailed')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('vehicleOnboarding.lookupFailedBody')}
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  if (createdVehicle) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-[3px] border border-border bg-card p-6 shadow-[var(--shadow-rest)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">{t('vehicleOnboarding.successEyebrow')}</p>
            <h1 className="mt-2 text-2xl font-bold">
              {t('vehicleOnboarding.successTitle')}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {createdVehicle.bookingPoolFlag
                ? t('vehicleOnboarding.successActive')
                : t('vehicleOnboarding.successBlocked')}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 rounded-[3px] border border-border bg-muted p-5 sm:grid-cols-2">
          <div>
            <dt className="eyebrow">{t('vehicleOnboarding.fields.plate')}</dt>
            <dd className="mt-1 font-data font-semibold">
              <bdi>{createdVehicle.plate}</bdi>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t('vehicleOnboarding.fields.vin')}</dt>
            <dd className="mt-1 truncate font-data font-semibold">
              <bdi>{createdVehicle.chassisVin}</bdi>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t('vehicleOnboarding.summary.pool')}</dt>
            <dd className="mt-1">
              <StatusChip
                tone={createdVehicle.bookingPoolFlag ? 'ok' : 'warn'}
                label={
                  createdVehicle.bookingPoolFlag
                    ? t('vehicleOnboarding.poolIncluded')
                    : t('vehicleOnboarding.poolBlocked')
                }
              />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">
              {t('vehicleOnboarding.successReference')}
            </dt>
            <dd className="mt-1 truncate font-data text-sm">
              <bdi>{createdVehicle.id}</bdi>
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              setDraft(initialDraft)
              setStep(0)
              setCreatedVehicle(null)
            }}
          >
            {t('vehicleOnboarding.onboardAnother')}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            {t('vehicleOnboarding.closeReceipt')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className="mx-auto w-full max-w-[1180px]" onSubmit={submit}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t('vehicleOnboarding.backToVehicles')}
      </button>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[3px] border border-border bg-card p-5 shadow-[var(--shadow-rest)] lg:sticky lg:top-24">
          <p className="eyebrow">{t('vehicleOnboarding.railTitle')}</p>
          <ol className="mt-5 space-y-1">
            {STEPS.map((item, index) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => index < step && setStep(index)}
                  disabled={index > step}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-[3px] px-2 text-start text-sm',
                    index === step && 'bg-brand-soft font-semibold text-brand',
                    index < step && 'text-foreground',
                    index > step && 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full border font-data text-xs',
                      index === step &&
                        'border-brand bg-brand text-brand-foreground',
                      index < step && 'border-success bg-success text-white',
                    )}
                  >
                    {index < step ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {t(`vehicleOnboarding.steps.${item}`)}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            {t('vehicleOnboarding.importNote')}
          </div>
        </aside>

        <section className="min-w-0 rounded-[3px] border border-border bg-card shadow-[var(--shadow-rest)]">
          <div className="border-b border-border px-5 py-5 sm:px-7">
            <p className="eyebrow">
              {t('vehicleOnboarding.stepCounter', {
                current: step + 1,
                total: STEPS.length,
              })}
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              {t(`vehicleOnboarding.headings.${STEPS[step]}`)}
            </h1>
            <p className="mt-2 max-w-[72ch] text-sm leading-6 text-muted-foreground">
              {t(`vehicleOnboarding.descriptions.${STEPS[step]}`)}
            </p>
          </div>

          <div className="p-5 sm:p-7">
            {lookupsLoading ? (
              <div className="space-y-4">
                <div className="h-24 animate-pulse rounded-[3px] bg-muted" />
                <div className="h-40 animate-pulse rounded-[3px] bg-muted" />
              </div>
            ) : null}

            {!lookupsLoading && step === 0 ? (
              <div className="space-y-6">
                <ChoiceGrid
                  values={acquisition.data}
                  value={draft.acquisitionScenario}
                  language={i18n.resolvedLanguage ?? i18n.language}
                  onChange={(value) => set('acquisitionScenario', value)}
                />
                {isLeasedAcquisition ? (
                  <>
                    <div className="rounded-[3px] border border-info/30 bg-info/10 p-4 text-sm">
                      <div className="flex items-center gap-2 font-semibold text-info">
                        <AlertTriangle className="size-4" />
                        {t('vehicleOnboarding.futureIntegration')}
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {t('vehicleOnboarding.vendorFutureBody')}
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field
                        label={t('vehicleOnboarding.fields.vendorReference')}
                        htmlFor="vendor-ref"
                        hint={t('vehicleOnboarding.futureOptionHint')}
                      >
                        <Select
                          value={draft.vendorId}
                          onValueChange={(value) => {
                            set('vendorId', value)
                            set('leaseContractId', '')
                          }}
                          disabled={
                            vendors.isLoading || activeVendors.length === 0
                          }
                        >
                          <SelectTrigger
                            id="vendor-ref"
                            className="h-11 bg-background"
                          >
                            <SelectValue
                              placeholder={t(
                                'vehicleOnboarding.placeholders.vendor',
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {activeVendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.legalName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {vendors.isError ? (
                          <p className="mt-2 text-xs text-destructive">
                            {t('vehicleOnboarding.vendorLoadFailed')}
                          </p>
                        ) : null}
                        {!vendors.isLoading &&
                        !vendors.isError &&
                        activeVendors.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('vehicleOnboarding.noActiveVendors')}
                          </p>
                        ) : null}
                      </Field>
                      <Field
                        label={t('vehicleOnboarding.fields.leaseContract')}
                        htmlFor="lease-ref"
                      >
                        <Select
                          value={draft.leaseContractId}
                          onValueChange={(value) =>
                            set('leaseContractId', value)
                          }
                          disabled={
                            !draft.vendorId ||
                            leases.isLoading ||
                            usableLeases.length === 0
                          }
                        >
                          <SelectTrigger
                            id="lease-ref"
                            className="h-11 bg-background"
                          >
                            <SelectValue
                              placeholder={t(
                                'vehicleOnboarding.placeholders.leaseContract',
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {usableLeases.map((lease) => (
                              <SelectItem key={lease.id} value={lease.id}>
                                {lease.contractRef}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {draft.vendorId &&
                        !leases.isLoading &&
                        !leases.isError &&
                        usableLeases.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t('vehicleOnboarding.noUsableLeases')}
                          </p>
                        ) : null}
                      </Field>
                      <Field
                        label={t('vehicleOnboarding.fields.monthlyRental')}
                        htmlFor="monthly-rental"
                      >
                        <Input
                          id="monthly-rental"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.monthlyRental}
                          onChange={(event) =>
                            set('monthlyRental', event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label={t('vehicleOnboarding.fields.currency')}
                        htmlFor="currency"
                      >
                        <LookupSelect
                          id="currency"
                          value={draft.currency}
                          values={currencies.data}
                          language={i18n.resolvedLanguage ?? i18n.language}
                          placeholder={t('vehicleOnboarding.selectOption')}
                          onChange={(value) => set('currency', value)}
                        />
                      </Field>
                      <Field
                        label={t('vehicleOnboarding.fields.startDate')}
                        htmlFor="lease-start"
                      >
                        <Input
                          id="lease-start"
                          type="date"
                          value={draft.purchaseOrLeaseStart}
                          onChange={(event) =>
                            set('purchaseOrLeaseStart', event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label={t('vehicleOnboarding.fields.endDate')}
                        htmlFor="lease-end"
                      >
                        <Input
                          id="lease-end"
                          type="date"
                          value={draft.leaseEnd}
                          onChange={(event) =>
                            set('leaseEnd', event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {!lookupsLoading && step === 1 ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    className="h-11 flex-1 font-data"
                    value={draft.chassisVin}
                    onChange={(event) => set('chassisVin', event.target.value)}
                    placeholder={t('vehicleOnboarding.placeholders.vin')}
                  />
                  <Button type="button" variant="secondary" disabled>
                    {t('vehicleOnboarding.decodeVinFuture')}
                  </Button>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    label={t('vehicleOnboarding.fields.plate')}
                    htmlFor="plate"
                  >
                    <Input
                      id="plate"
                      className="font-data"
                      value={draft.plate}
                      onChange={(event) => set('plate', event.target.value)}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.make')}
                    htmlFor="make"
                  >
                    <LookupSelect
                      id="make"
                      value={draft.makeCode}
                      values={makeOptions}
                      language={i18n.resolvedLanguage ?? i18n.language}
                      placeholder={t('vehicleOnboarding.selectOption')}
                      onChange={(value) => set('makeCode', value)}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.model')}
                    htmlFor="model"
                  >
                    <LookupSelect
                      id="model"
                      value={draft.modelCode}
                      values={modelOptions}
                      language={i18n.resolvedLanguage ?? i18n.language}
                      placeholder={t('vehicleOnboarding.selectOption')}
                      onChange={(value) => set('modelCode', value)}
                      disabled={!draft.makeCode}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.year')}
                    htmlFor="year"
                  >
                    <Input
                      id="year"
                      type="number"
                      min="1980"
                      max="2100"
                      value={draft.year}
                      onChange={(event) => set('year', event.target.value)}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.bodyType')}
                    htmlFor="body-type"
                  >
                    <LookupSelect
                      id="body-type"
                      value={draft.bodyTypeCode}
                      values={bodyTypes.data}
                      language={i18n.resolvedLanguage ?? i18n.language}
                      placeholder={t('vehicleOnboarding.selectOption')}
                      onChange={(value) => set('bodyTypeCode', value)}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.useCategory')}
                    htmlFor="use-category"
                  >
                    <LookupSelect
                      id="use-category"
                      value={draft.useCategoryCode}
                      values={useCategories.data}
                      language={i18n.resolvedLanguage ?? i18n.language}
                      placeholder={t('vehicleOnboarding.selectOption')}
                      onChange={(value) => set('useCategoryCode', value)}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.seats')}
                    htmlFor="seats"
                  >
                    <Input
                      id="seats"
                      type="number"
                      min="1"
                      value={draft.seatingCapacity}
                      onChange={(event) =>
                        set('seatingCapacity', event.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.fuelType')}
                    htmlFor="fuel-type"
                  >
                    <LookupSelect
                      id="fuel-type"
                      value={draft.fuelTypeCode}
                      values={fuelTypes.data}
                      language={i18n.resolvedLanguage ?? i18n.language}
                      placeholder={t('vehicleOnboarding.selectOption')}
                      onChange={(value) => set('fuelTypeCode', value)}
                    />
                  </Field>
                  <Field
                    label={t('vehicleOnboarding.fields.efficiency')}
                    htmlFor="efficiency"
                  >
                    <Input
                      id="efficiency"
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.fuelEfficiencyKmpl}
                      onChange={(event) =>
                        set('fuelEfficiencyKmpl', event.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {!lookupsLoading && step === 2 ? (
              <div className="space-y-6">
                <Field
                  label={t('vehicleOnboarding.fields.hierarchyNode')}
                  htmlFor="hierarchy-node"
                >
                  <Select
                    value={draft.homeNodeId}
                    onValueChange={(value) => set('homeNodeId', value)}
                  >
                    <SelectTrigger id="hierarchy-node" className="h-11">
                      <SelectValue
                        placeholder={t('vehicleOnboarding.selectOption')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {flatHierarchy.map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {'—'.repeat(node.depth)} {node.levelLabel} ·{' '}
                          {node.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div>
                  <p className="eyebrow mb-3">
                    {t('vehicleOnboarding.fields.operationalStatus')}
                  </p>
                  <ChoiceGrid
                    values={operational.data}
                    value={draft.operationalStatus}
                    language={i18n.resolvedLanguage ?? i18n.language}
                    onChange={(value) => set('operationalStatus', value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-5 rounded-[3px] border border-border bg-muted p-4">
                  <div>
                    <p className="font-semibold">
                      {t('vehicleOnboarding.includePool')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('vehicleOnboarding.includePoolHint')}
                    </p>
                  </div>
                  <Switch
                    checked={draft.includeInPool}
                    onCheckedChange={(value) => set('includeInPool', value)}
                    aria-label={t('vehicleOnboarding.includePool')}
                  />
                </div>
              </div>
            ) : null}

            {!lookupsLoading && step === 3 ? (
              <div className="space-y-7">
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <FileCheck2 className="size-5 text-brand" />
                    <h2 className="font-bold">
                      {t('vehicleOnboarding.complianceTitle')}
                    </h2>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      label={t('vehicleOnboarding.fields.mulkiyaNumber')}
                      htmlFor="mulkiya-number"
                    >
                      <Input
                        id="mulkiya-number"
                        value={draft.mulkiyaNumber}
                        onChange={(event) =>
                          set('mulkiyaNumber', event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t('vehicleOnboarding.fields.mulkiyaExpiry')}
                      htmlFor="mulkiya-expiry"
                    >
                      <Input
                        id="mulkiya-expiry"
                        type="date"
                        value={draft.mulkiyaExpiry}
                        onChange={(event) =>
                          set('mulkiyaExpiry', event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t('vehicleOnboarding.fields.insuranceProvider')}
                      htmlFor="insurance-provider"
                    >
                      <Input
                        id="insurance-provider"
                        value={draft.insuranceProvider}
                        onChange={(event) =>
                          set('insuranceProvider', event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t('vehicleOnboarding.fields.insurancePolicy')}
                      htmlFor="insurance-policy"
                    >
                      <Input
                        id="insurance-policy"
                        value={draft.insurancePolicyNumber}
                        onChange={(event) =>
                          set('insurancePolicyNumber', event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t('vehicleOnboarding.fields.insuranceExpiry')}
                      htmlFor="insurance-expiry"
                    >
                      <Input
                        id="insurance-expiry"
                        type="date"
                        value={draft.insuranceExpiry}
                        onChange={(event) =>
                          set('insuranceExpiry', event.target.value)
                        }
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11"
                        onClick={() =>
                          notify.info(t('vehicleOnboarding.manualUpload'))
                        }
                      >
                        <Upload className="size-4" />
                        {t('vehicleOnboarding.uploadScan')}
                      </Button>
                    </div>
                  </div>
                </section>
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <RadioTower className="size-5 text-brand" />
                    <h2 className="font-bold">
                      {t('vehicleOnboarding.telematicsTitle')}
                    </h2>
                  </div>
                  <ChoiceGrid
                    values={telematics.data}
                    value={draft.telematicsSetup}
                    language={i18n.resolvedLanguage ?? i18n.language}
                    onChange={(value) => set('telematicsSetup', value)}
                  />
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {draft.telematicsSetup !== 'MANUAL' ? (
                      <>
                        <Field
                          label={t('vehicleOnboarding.fields.trackerVendor')}
                          htmlFor="tracker-vendor"
                        >
                          <Input
                            id="tracker-vendor"
                            value={draft.trackerVendor}
                            onChange={(event) =>
                              set('trackerVendor', event.target.value)
                            }
                          />
                        </Field>
                        <Field
                          label={t('vehicleOnboarding.fields.trackerSerial')}
                          htmlFor="tracker-serial"
                        >
                          <Input
                            id="tracker-serial"
                            value={draft.trackerSerial}
                            onChange={(event) =>
                              set('trackerSerial', event.target.value)
                            }
                          />
                        </Field>
                      </>
                    ) : null}
                    <Field
                      label={t('vehicleOnboarding.fields.fuelCard')}
                      htmlFor="fuel-card"
                    >
                      <Input
                        id="fuel-card"
                        value={draft.fuelCardNumber}
                        onChange={(event) =>
                          set('fuelCardNumber', event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t('vehicleOnboarding.fields.salikTag')}
                      htmlFor="salik-tag"
                    >
                      <Input
                        id="salik-tag"
                        value={draft.salikTag}
                        onChange={(event) =>
                          set('salikTag', event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t('vehicleOnboarding.fields.darbTag')}
                      htmlFor="darb-tag"
                    >
                      <Input
                        id="darb-tag"
                        value={draft.darbTag}
                        onChange={(event) => set('darbTag', event.target.value)}
                      />
                    </Field>
                  </div>
                </section>
              </div>
            ) : null}

            {!lookupsLoading && step === 4 ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {t('vehicleOnboarding.completeness')}
                    </span>
                    <span className="font-data text-sm">
                      {completionPercent}%
                    </span>
                  </div>
                  <Progress
                    className="mt-3"
                    value={completionPercent}
                    tone={complianceComplete ? 'ok' : 'warn'}
                    label={t('vehicleOnboarding.completeness')}
                  />
                </div>
                <div className="divide-y divide-border rounded-[3px] border border-border">
                  {[
                    [
                      'acquisition',
                      localizedLabel(
                        findLookup(
                          acquisition.data,
                          draft.acquisitionScenario,
                        ) ??
                          ({
                            labelEn: draft.acquisitionScenario,
                            labelAr: draft.acquisitionScenario,
                          } as LookupValue),
                        i18n.resolvedLanguage ?? i18n.language,
                      ),
                      true,
                    ],
                    [
                      'identity',
                      `${findLookup(makes.data, draft.makeCode)?.labelEn ?? draft.makeCode} · ${draft.plate || t('vehicleOnboarding.notProvided')}`,
                      identityComplete,
                    ],
                    [
                      'hierarchy',
                      flatHierarchy.find((node) => node.id === draft.homeNodeId)
                        ?.name ?? t('vehicleOnboarding.notProvided'),
                      hierarchyComplete,
                    ],
                    [
                      'pool',
                      draft.includeInPool
                        ? complianceComplete
                          ? t('vehicleOnboarding.poolIncluded')
                          : t('vehicleOnboarding.poolBlocked')
                        : t('vehicleOnboarding.poolExcluded'),
                      !draft.includeInPool || complianceComplete,
                    ],
                    [
                      'compliance',
                      complianceComplete
                        ? t('vehicleOnboarding.complianceComplete')
                        : t('vehicleOnboarding.complianceMissing'),
                      complianceComplete,
                    ],
                    [
                      'telematics',
                      localizedLabel(
                        findLookup(telematics.data, draft.telematicsSetup) ??
                          ({
                            labelEn: draft.telematicsSetup,
                            labelAr: draft.telematicsSetup,
                          } as LookupValue),
                        i18n.resolvedLanguage ?? i18n.language,
                      ),
                      Boolean(draft.telematicsSetup),
                    ],
                  ].map(([key, value, complete]) => (
                    <div
                      key={String(key)}
                      className="flex items-center gap-3 p-4"
                    >
                      <span
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-full',
                          complete
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning',
                        )}
                      >
                        {complete ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <AlertTriangle className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase text-muted-foreground">
                          {t(`vehicleOnboarding.summary.${key}`)}
                        </span>
                        <span className="mt-1 block text-sm font-medium">
                          {String(value)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                {!complianceComplete ? (
                  <div className="rounded-[3px] border border-warning/30 bg-warning/10 p-4">
                    <StatusChip
                      tone="warn"
                      label={t('vehicleOnboarding.blockedStatus')}
                    />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('vehicleOnboarding.blockedBody')}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-7">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0 || createVehicle.isPending}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t('vehicleOnboarding.back')}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                size="lg"
                disabled={!canContinue || lookupsLoading}
                onClick={() =>
                  setStep((current) => Math.min(STEPS.length - 1, current + 1))
                }
              >
                {t('vehicleOnboarding.continue')}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={
                  createVehicle.isPending ||
                  !identityComplete ||
                  !hierarchyComplete
                }
              >
                {createVehicle.isPending
                  ? t('vehicleOnboarding.creating')
                  : complianceComplete && draft.includeInPool
                    ? t('vehicleOnboarding.activate')
                    : t('vehicleOnboarding.createBlocked')}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            )}
          </div>
        </section>
      </div>
    </form>
  )
}
