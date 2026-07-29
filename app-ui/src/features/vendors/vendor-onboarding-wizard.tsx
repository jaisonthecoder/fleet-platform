import { useEffect, useState } from 'react'
import {
  Check,
  Circle,
  FileCheck2,
  Link2Off,
  LockKeyhole,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { Drawer } from '@/components/patterns/drawer'
import { StatusChip } from '@/components/ui/status-chip'
import { Textarea } from '@/components/ui/textarea'
import { useLookupValues } from '@/features/config/hooks/use-lookups'
import { ApiRequestError } from '@/lib/api-client'
import { notify } from '@/hooks/use-toast'
import {
  useCreateVendor,
  useUpdateVendor,
  useUpdateVendorOnboardingProfile,
  useVendorAction,
  useVendorOnboarding,
} from './hooks/use-vendors'
import { VendorDocumentsSection } from './vendor-documents-section'

const DRAFT_STORAGE_KEY = 'wayfinder.vendor-onboarding-draft'
const STEPS = ['identity', 'documents', 'terms', 'access', 'review'] as const

/** Reads the resumable draft id when browser storage is available. */
function readDraftId(): string | null {
  try {
    return window.localStorage?.getItem(DRAFT_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/** Persists or clears the resumable draft id when storage is available. */
function writeDraftId(vendorId: string | null): void {
  try {
    if (vendorId) window.localStorage?.setItem(DRAFT_STORAGE_KEY, vendorId)
    else window.localStorage?.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Storage can be disabled; server persistence still protects entered data.
  }
}

interface VendorOnboardingWizardProps {
  open: boolean
  onClose: () => void
}

/** Implements the persisted five-step Vendor onboarding journey. */
export function VendorOnboardingWizard({
  open,
  onClose,
}: VendorOnboardingWizardProps) {
  const { t, i18n } = useTranslation()
  const categories = useLookupValues('vendor-category')
  const [step, setStep] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [vendorId, setVendorId] = useState<string | null>(null)
  const onboarding = useVendorOnboarding(vendorId)
  const createVendor = useCreateVendor()
  const updateVendor = useUpdateVendor(vendorId ?? '')
  const updateProfile = useUpdateVendorOnboardingProfile(vendorId ?? '')
  const vendorAction = useVendorAction()
  const [legalName, setLegalName] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [tradeLicenceNumber, setTradeLicenceNumber] = useState('')
  const [tradeLicenceEmirate, setTradeLicenceEmirate] = useState('')
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState('')
  const [primaryContactName, setPrimaryContactName] = useState('')
  const [primaryContactEmail, setPrimaryContactEmail] = useState('')
  const [primaryContactPhone, setPrimaryContactPhone] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [notes, setNotes] = useState('')
  const [standardOffHireNoticeDays, setStandardOffHireNoticeDays] =
    useState('30')
  const [earlyTerminationPenalty, setEarlyTerminationPenalty] = useState('')
  const [renewalOptions, setRenewalOptions] = useState('')
  const [escalationClause, setEscalationClause] = useState('')
  const [replacementClause, setReplacementClause] = useState('')
  const [alertLadder, setAlertLadder] = useState('90/60/30')

  useEffect(() => {
    if (!open) return
    setVendorId(readDraftId())
  }, [open])

  useEffect(() => {
    const state = onboarding.data
    if (!state) return
    const vendor = state.vendor
    setLegalName(vendor.legalName)
    setCategoryCode(vendor.categoryCode)
    setTradeLicenceNumber(vendor.tradeLicenceNumber ?? '')
    setTradeLicenceEmirate(vendor.tradeLicenceEmirate ?? '')
    setTaxRegistrationNumber(vendor.taxRegistrationNumber ?? '')
    setPrimaryContactName(vendor.primaryContactName ?? '')
    setPrimaryContactEmail(vendor.primaryContactEmail ?? '')
    setPrimaryContactPhone(vendor.primaryContactPhone ?? '')
    setPaymentTerms(vendor.paymentTerms ?? '')
    setNotes(vendor.notes ?? '')
    const profile = state.profile
    if (!profile) return
    setStandardOffHireNoticeDays(
      profile.standardOffHireNoticeDays?.toString() ?? '30',
    )
    setEarlyTerminationPenalty(profile.earlyTerminationPenalty ?? '')
    setRenewalOptions(profile.renewalOptions ?? '')
    setEscalationClause(profile.escalationClause ?? '')
    setReplacementClause(profile.replacementClause ?? '')
    setAlertLadder(profile.alertLadder ?? '90/60/30')
  }, [onboarding.data])

  useEffect(() => {
    if (!categoryCode && categories.data?.[0]) {
      setCategoryCode(categories.data[0].code)
    }
  }, [categories.data, categoryCode])

  /** Reports an API problem without inferring a successful step transition. */
  const reportError = (error: unknown) => {
    if (error instanceof ApiRequestError) {
      notify.danger(error.message, {
        description: error.reasons?.join(' · '),
      })
      return
    }
    notify.danger(t('vendors.wizard.saveFailed'))
  }

  /** Persists the current step before advancing. */
  const continueStep = async () => {
    try {
      if (step === 0) {
        const input = {
          legalName: legalName.trim(),
          categoryCode,
          tradeLicenceNumber: tradeLicenceNumber.trim() || undefined,
          tradeLicenceEmirate: tradeLicenceEmirate.trim() || undefined,
          taxRegistrationNumber: taxRegistrationNumber.trim() || undefined,
          primaryContactName: primaryContactName.trim() || undefined,
          primaryContactEmail: primaryContactEmail.trim() || undefined,
          primaryContactPhone: primaryContactPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        }
        if (vendorId) {
          await updateVendor.mutateAsync(input)
        } else {
          const created = await createVendor.mutateAsync(input)
          writeDraftId(created.id)
          setVendorId(created.id)
        }
      }
      if (step === 1 && vendorId) {
        await updateVendor.mutateAsync({
          paymentTerms: paymentTerms.trim() || undefined,
          bankIban: bankIban.trim() || undefined,
        })
        await onboarding.refetch()
      }
      if (step === 2 && vendorId) {
        await updateProfile.mutateAsync({
          standardOffHireNoticeDays: Number(standardOffHireNoticeDays),
          earlyTerminationPenalty: earlyTerminationPenalty.trim(),
          renewalOptions: renewalOptions.trim(),
          escalationClause: escalationClause.trim(),
          replacementClause: replacementClause.trim(),
          alertLadder: alertLadder.trim(),
          accessMode: 'ManualInternal',
        })
      }
      setDirty(false)
      if (step < STEPS.length - 1) setStep((current) => current + 1)
    } catch (error) {
      reportError(error)
    }
  }

  /** Clears local wizard state after a successful submission only. */
  const submit = async () => {
    if (!vendorId) return
    try {
      await vendorAction.mutateAsync({ id: vendorId, action: 'submit' })
      writeDraftId(null)
      setDirty(false)
      notify.ok(t('vendors.actioned.submit'))
      onClose()
      setStep(0)
      setVendorId(null)
    } catch (error) {
      reportError(error)
    }
  }

  const pending =
    createVendor.isPending ||
    updateVendor.isPending ||
    updateProfile.isPending ||
    vendorAction.isPending
  const validIdentity = Boolean(legalName.trim() && categoryCode)
  const validTerms = Boolean(
    Number(standardOffHireNoticeDays) >= 0 &&
      earlyTerminationPenalty.trim() &&
      renewalOptions.trim() &&
      escalationClause.trim() &&
      replacementClause.trim() &&
      alertLadder.trim(),
  )

  /** Confirms before discarding fields that have not reached the server. */
  const requestClose = () => {
    if (dirty && !window.confirm(t('vendors.wizard.discardChanges'))) return
    setDirty(false)
    onClose()
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && requestClose()}
      title={t('vendors.wizard.title')}
      description={t('vendors.onboardHint')}
      width="4xl"
      closeLabel={t('common.close')}
    >
        <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="border-border h-fit rounded-md border p-4">
            <p className="eyebrow mb-4">{t('vendors.wizard.title')}</p>
            <ol className="space-y-4">
              {STEPS.map((key, index) => (
                <li key={key} className="flex items-start gap-3 text-sm">
                  {index < step ? (
                    <Check className="text-ok mt-0.5 size-5" />
                  ) : (
                    <Circle
                      className={
                        index === step
                          ? 'text-action fill-action/15 mt-0.5 size-5'
                          : 'text-ink-3 mt-0.5 size-5'
                      }
                    />
                  )}
                  <span className={index === step ? 'font-semibold' : ''}>
                    {index + 1}. {t(`vendors.wizard.steps.${key}`)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-ink-3 border-border mt-5 border-t pt-4 text-xs">
              {t('vendors.wizard.sod')}
            </p>
          </aside>

          <main
            className="min-w-0 space-y-5"
            onChangeCapture={() => setDirty(true)}
          >
            <header>
              <p className="eyebrow">
                {t('vendors.wizard.stepLabel', {
                  current: step + 1,
                  total: STEPS.length,
                })}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {t(`vendors.wizard.headings.${STEPS[step]}`)}
              </h2>
              <p className="text-ink-3 mt-1 text-sm">
                {t(`vendors.wizard.helpers.${STEPS[step]}`)}
              </p>
            </header>

            {step === 0 ? (
              <IdentityStep
                values={{
                  legalName,
                  categoryCode,
                  tradeLicenceNumber,
                  tradeLicenceEmirate,
                  taxRegistrationNumber,
                  primaryContactName,
                  primaryContactEmail,
                  primaryContactPhone,
                  notes,
                }}
                setters={{
                  setLegalName,
                  setCategoryCode,
                  setTradeLicenceNumber,
                  setTradeLicenceEmirate,
                  setTaxRegistrationNumber,
                  setPrimaryContactName,
                  setPrimaryContactEmail,
                  setPrimaryContactPhone,
                  setNotes,
                }}
                categories={categories.data ?? []}
                arabic={(i18n.resolvedLanguage ?? i18n.language).startsWith(
                  'ar',
                )}
              />
            ) : null}

            {step === 1 && onboarding.data ? (
              <div className="space-y-4">
                <VendorDocumentsSection vendor={onboarding.data.vendor} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <WizardInput
                    id="vendor-payment-terms"
                    label={t('vendors.fields.paymentTerms')}
                    value={paymentTerms}
                    onChange={setPaymentTerms}
                  />
                  <WizardInput
                    id="vendor-bank-iban"
                    label={t('vendors.fields.iban')}
                    value={bankIban}
                    onChange={setBankIban}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <WizardInput
                  id="vendor-notice-days"
                  type="number"
                  label={t('vendors.wizard.fields.noticeDays')}
                  value={standardOffHireNoticeDays}
                  onChange={setStandardOffHireNoticeDays}
                />
                <WizardInput
                  id="vendor-penalty"
                  label={t('vendors.wizard.fields.penalty')}
                  value={earlyTerminationPenalty}
                  onChange={setEarlyTerminationPenalty}
                />
                <WizardInput
                  id="vendor-renewal-options"
                  label={t('vendors.wizard.fields.renewalOptions')}
                  value={renewalOptions}
                  onChange={setRenewalOptions}
                />
                <WizardInput
                  id="vendor-escalation"
                  label={t('vendors.wizard.fields.escalation')}
                  value={escalationClause}
                  onChange={setEscalationClause}
                />
                <WizardInput
                  id="vendor-replacement"
                  label={t('vendors.wizard.fields.replacement')}
                  value={replacementClause}
                  onChange={setReplacementClause}
                />
                <WizardInput
                  id="vendor-alert-ladder"
                  label={t('vendors.wizard.fields.alertLadder')}
                  value={alertLadder}
                  onChange={setAlertLadder}
                />
              </div>
            ) : null}

            {step === 3 ? <FutureDependencies /> : null}
            {step === 4 && onboarding.data ? (
              <ReviewStep onboarding={onboarding.data} />
            ) : null}

            {onboarding.isError ? (
              <div className="border-danger text-danger rounded-md border p-3 text-sm">
                {t('vendors.wizard.loadFailed')}
              </div>
            ) : null}

            <footer className="border-border mt-6 flex items-center justify-between gap-3 border-t bg-surface py-4">
              <Button
                type="button"
                variant="secondary"
                disabled={step === 0 || pending}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
              >
                {t('vendors.wizard.back')}
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  disabled={
                    pending ||
                    (step === 0 && !validIdentity) ||
                    (step === 2 && !validTerms)
                  }
                  onClick={continueStep}
                >
                  {t('vendors.wizard.continue')}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={pending || !onboarding.data?.completeness.canSubmit}
                  onClick={submit}
                >
                  {t('vendors.actions.submit')}
                </Button>
              )}
            </footer>
          </main>
        </div>
    </Drawer>
  )
}

interface IdentityValues {
  legalName: string
  categoryCode: string
  tradeLicenceNumber: string
  tradeLicenceEmirate: string
  taxRegistrationNumber: string
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
  notes: string
}

interface IdentitySetters {
  setLegalName: (value: string) => void
  setCategoryCode: (value: string) => void
  setTradeLicenceNumber: (value: string) => void
  setTradeLicenceEmirate: (value: string) => void
  setTaxRegistrationNumber: (value: string) => void
  setPrimaryContactName: (value: string) => void
  setPrimaryContactEmail: (value: string) => void
  setPrimaryContactPhone: (value: string) => void
  setNotes: (value: string) => void
}

interface CategoryOption {
  id: string
  code: string
  labelEn: string
  labelAr: string
}

/** Renders manual source selection and lookup-backed Vendor identity. */
function IdentityStep({
  values,
  setters,
  categories,
  arabic,
}: {
  values: IdentityValues
  setters: IdentitySetters
  categories: CategoryOption[]
  arabic: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-action bg-action/5 rounded-md border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Check className="size-4" /> {t('vendors.wizard.manualSource')}
          </div>
          <p className="text-ink-3 mt-1 text-sm">
            {t('vendors.wizard.manualSourceHelp')}
          </p>
        </div>
        <div
          className="border-border bg-surface-2 rounded-md border p-4 opacity-70"
          aria-disabled="true"
        >
          <div className="flex items-center gap-2 font-semibold">
            <LockKeyhole className="size-4" />
            {t('vendors.wizard.integratedSource')}
          </div>
          <p className="text-ink-3 mt-1 text-sm">
            {t('vendors.wizard.futureDependency')}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <WizardInput
          id="vendor-legal-name"
          label={t('vendors.fields.legalName')}
          value={values.legalName}
          onChange={setters.setLegalName}
          required
        />
        <div className="space-y-1">
          <Label htmlFor="vendor-category">{t('vendors.fields.category')}</Label>
          <Select
            value={values.categoryCode}
            onValueChange={setters.setCategoryCode}
          >
            <SelectTrigger id="vendor-category">
              <SelectValue placeholder={t('vendors.selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.code}>
                  {arabic ? category.labelAr : category.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <WizardInput
          id="vendor-trade-licence"
          label={t('vendors.fields.tradeLicence')}
          value={values.tradeLicenceNumber}
          onChange={setters.setTradeLicenceNumber}
        />
        <WizardInput
          id="vendor-emirate"
          label={t('vendors.wizard.fields.emirate')}
          value={values.tradeLicenceEmirate}
          onChange={setters.setTradeLicenceEmirate}
        />
        <WizardInput
          id="vendor-trn"
          label={t('vendors.fields.trn')}
          value={values.taxRegistrationNumber}
          onChange={setters.setTaxRegistrationNumber}
        />
        <WizardInput
          id="vendor-contact-name"
          label={t('vendors.fields.contact')}
          value={values.primaryContactName}
          onChange={setters.setPrimaryContactName}
        />
        <WizardInput
          id="vendor-contact-email"
          type="email"
          label={t('vendors.wizard.fields.contactEmail')}
          value={values.primaryContactEmail}
          onChange={setters.setPrimaryContactEmail}
        />
        <WizardInput
          id="vendor-contact-phone"
          label={t('vendors.wizard.fields.contactPhone')}
          value={values.primaryContactPhone}
          onChange={setters.setPrimaryContactPhone}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="vendor-notes">{t('vendors.fields.notes')}</Label>
        <Textarea
          id="vendor-notes"
          value={values.notes}
          onChange={(event) => setters.setNotes(event.target.value)}
          rows={3}
        />
      </div>
    </div>
  )
}

/** Displays unavailable integrations without simulating a live connection. */
function FutureDependencies() {
  const { t } = useTranslation()
  const dependencies = ['procurement', 'finance', 'ocr', 'portal'] as const
  return (
    <div className="space-y-3">
      {dependencies.map((dependency) => (
        <div
          key={dependency}
          className="border-border flex items-start justify-between gap-4 rounded-md border p-4"
        >
          <div className="flex gap-3">
            <Link2Off className="text-ink-3 mt-0.5 size-5" />
            <div>
              <p className="font-medium">
                {t(`vendors.wizard.dependencies.${dependency}`)}
              </p>
              <p className="text-ink-3 text-sm">
                {t('vendors.wizard.futureDependency')}
              </p>
            </div>
          </div>
          <StatusChip
            tone="neutral"
            label={t('vendors.wizard.futureIntegration')}
          />
        </div>
      ))}
    </div>
  )
}

/** Presents server-owned completeness and the activation distinction. */
function ReviewStep({
  onboarding,
}: {
  onboarding: NonNullable<ReturnType<typeof useVendorOnboarding>['data']>
}) {
  const { t } = useTranslation()
  const { completeness, documentRequirements, vendor } = onboarding
  const percentage = Math.round(
    (completeness.completed / completeness.required) * 100,
  )
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex justify-between gap-3 text-sm">
          <span>{t('vendors.wizard.completeness')}</span>
          <span className="font-data">
            {completeness.completed} / {completeness.required}
          </span>
        </div>
        <Progress
          value={percentage}
          label={t('vendors.wizard.completeness')}
        />
      </div>
      <dl className="border-border divide-border divide-y rounded-md border">
        <ReviewRow
          label={t('vendors.wizard.review.identity')}
          value={vendor.legalName}
          ok={Boolean(vendor.legalName && vendor.categoryCode)}
        />
        <ReviewRow
          label={t('vendors.wizard.review.documents')}
          value={t('vendors.wizard.documentCount', {
            confirmed: documentRequirements.filter(
              (document) => document.state === 'Confirmed',
            ).length,
            total: documentRequirements.length,
          })}
          ok={documentRequirements
            .filter((document) => document.required)
            .every((document) => document.state === 'Confirmed')}
        />
        <ReviewRow
          label={t('vendors.wizard.review.terms')}
          value={
            onboarding.profile
              ? t('vendors.wizard.captured')
              : t('vendors.wizard.missing')
          }
          ok={Boolean(onboarding.profile)}
        />
        <ReviewRow
          label={t('vendors.wizard.review.access')}
          value={t('vendors.wizard.manualInternal')}
          ok
        />
      </dl>
      <div className="border-warn bg-warn/5 rounded-md border p-4 text-sm">
        {completeness.canActivate
          ? t('vendors.wizard.activationReady')
          : t('vendors.wizard.activationBlocked')}
      </div>
    </div>
  )
}

/** Renders one review row with non-colour-only state. */
function ReviewRow({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-4 p-3 text-sm">
      <div className="flex items-center gap-2">
        {ok ? (
          <Check className="text-ok size-4" />
        ) : (
          <FileCheck2 className="text-warn size-4" />
        )}
        <dt>{label}</dt>
      </div>
      <dd className="text-end">{value || t('vendors.wizard.missing')}</dd>
    </div>
  )
}

/** Renders a labelled wizard input with logical responsive sizing. */
function WizardInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'number'
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  )
}