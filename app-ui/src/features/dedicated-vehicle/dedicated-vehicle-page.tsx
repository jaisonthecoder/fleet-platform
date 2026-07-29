import { type FormEvent, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CarFront, Check, Clock3, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { StatusChip } from '@/components/ui/status-chip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ApiRequestError } from '@/lib/api-client'
import {
  createDedicatedVehicleDraft,
  consentDedicatedVehicleRequest,
  cancelEntitlement,
  getEntitlementConsentContext,
  getDedicatedVehicleContext,
  getDedicatedJustificationCategories,
  getDedicatedVehicleClasses,
  getMyEntitlements,
  getProfessionalDrivers,
  previewDedicatedEligibility,
  renewEntitlement,
  submitDedicatedVehicleRequest,
  updateDedicatedVehicleDraft,
  type CreateDedicatedVehicleDraft,
  type Entitlement,
  type EligibilityPreview,
} from './dedicated-vehicle.contract'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Dedicated Vehicle self-request entry, intentionally limited to governed Drafts. */
export function DedicatedVehiclePage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const context = useQuery({ queryKey: ['entitlements', 'context'], queryFn: getDedicatedVehicleContext })
  const requests = useQuery({ queryKey: ['entitlements', 'mine'], queryFn: getMyEntitlements })
  const justificationCategories = useQuery({ queryKey: ['entitlements', 'justification-categories'], queryFn: getDedicatedJustificationCategories })
  const vehicleClasses = useQuery({ queryKey: ['entitlements', 'vehicle-classes'], queryFn: getDedicatedVehicleClasses })
  const consentContext = useQuery({ queryKey: ['entitlements', 'consent-context'], queryFn: getEntitlementConsentContext })
  const professionalDrivers = useQuery({
    queryKey: ['entitlements', 'professional-drivers', context.data?.defaults.locationNodeId],
    queryFn: () => getProfessionalDrivers(context.data!.defaults.locationNodeId!),
    enabled: Boolean(context.data?.capabilities.withDriver.enabled && context.data.defaults.locationNodeId),
  })
  const commandKey = useRef(crypto.randomUUID())
  const [requestType, setRequestType] = useState<'LongTerm' | 'Temporary'>('LongTerm')
  const [driverOption, setDriverOption] = useState<'WithDriver' | 'WithoutDriver'>('WithoutDriver')
  const [assignedDriverPersonId, setAssignedDriverPersonId] = useState('')
  const [durationStart, setDurationStart] = useState(today())
  const [durationEnd, setDurationEnd] = useState(today())
  const [justificationCategory, setJustificationCategory] = useState('')
  const [justificationText, setJustificationText] = useState('')
  const [vehicleCategoryCode, setVehicleCategoryCode] = useState('')
  const [preferredVehicleId, setPreferredVehicleId] = useState('')
  const [eligibility, setEligibility] = useState<EligibilityPreview | null>(null)
  const [preferenceNote, setPreferenceNote] = useState('')
  const [businessUnit, setBusinessUnit] = useState('')
  const [costCentre, setCostCentre] = useState('')
  const [validation, setValidation] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('request')
  const [editing, setEditing] = useState<Entitlement | null>(null)
  const [lifecycleRequest, setLifecycleRequest] = useState<Entitlement | null>(null)
  const [lifecycleAction, setLifecycleAction] = useState<'cancel' | 'renew' | null>(null)
  const [lifecycleReason, setLifecycleReason] = useState('')
  const [renewalStart, setRenewalStart] = useState(today())
  const [renewalEnd, setRenewalEnd] = useState(today())
  const createDraft = useMutation({
    mutationFn: (input: CreateDedicatedVehicleDraft) =>
      createDedicatedVehicleDraft(input, commandKey.current),
    onSuccess: async () => {
      commandKey.current = crypto.randomUUID()
      setValidation(null)
      await queryClient.invalidateQueries({ queryKey: ['entitlements', 'mine'] })
    },
  })
  const updateDraft = useMutation({
    mutationFn: (input: CreateDedicatedVehicleDraft) => updateDedicatedVehicleDraft(
      editing!.id,
      { ...input, expectedRevision: editing!.revision },
      commandKey.current,
    ),
    onSuccess: async (updated) => {
      commandKey.current = crypto.randomUUID()
      setEditing(updated)
      setValidation(null)
      await queryClient.invalidateQueries({ queryKey: ['entitlements', 'mine'] })
    },
  })
  const previewEligibility = useMutation({
    mutationFn: previewDedicatedEligibility,
    onSuccess: (result) => {
      setEligibility(result)
      setPreferredVehicleId('')
      setValidation(null)
    },
  })
  const submitRequest = useMutation({
    mutationFn: (request: Entitlement) => submitDedicatedVehicleRequest(
      request.id,
      request.revision,
      crypto.randomUUID(),
    ),
    onSuccess: async () => {
      setValidation(null)
      await queryClient.invalidateQueries({ queryKey: ['entitlements', 'mine'] })
    },
  })
  const consentRequest = useMutation({
    mutationFn: (request: Entitlement) => consentDedicatedVehicleRequest({ entitlementId: request.id, expectedRevision: request.revision, consentDocumentVersion: consentContext.data!.version!, signatureRef: `ui-confirmation:${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID() }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['entitlements', 'mine'] }),
  })
  const lifecycle = useMutation({
    mutationFn: () => lifecycleAction === 'cancel'
      ? cancelEntitlement({ request: lifecycleRequest!, reason: lifecycleReason.trim(), idempotencyKey: crypto.randomUUID() })
      : renewEntitlement({ request: lifecycleRequest!, durationStart: renewalStart, durationEnd: renewalEnd, idempotencyKey: crypto.randomUUID() }),
    onSuccess: async () => {
      setLifecycleAction(null)
      setLifecycleRequest(null)
      setLifecycleReason('')
      await queryClient.invalidateQueries({ queryKey: ['entitlements', 'mine'] })
    },
  })
  const locale = i18n.resolvedLanguage ?? i18n.language
  const busy = createDraft.isPending || updateDraft.isPending || previewEligibility.isPending || submitRequest.isPending || consentRequest.isPending
  const saveError = createDraft.error ?? updateDraft.error
  const revisionConflict = saveError instanceof ApiRequestError &&
    saveError.reasons?.includes('entitlement-revision-conflict')
  const reasonText = (reason: string) =>
    t(`dedicated.reasons.${reason}`, { defaultValue: reason })

  function clearEligibility() {
    setEligibility(null)
    setPreferredVehicleId('')
  }

  function checkEligibility() {
    const locationNodeId = context.data?.defaults.locationNodeId
    if (!locationNodeId || !justificationCategory || !vehicleCategoryCode) {
      setValidation(t('dedicated.validation.previewRequired'))
      return
    }
    if (durationEnd < durationStart) {
      setValidation(t('dedicated.validation.window'))
      return
    }
    previewEligibility.mutate({
      requestType,
      driverOption,
      assignedDriverPersonId: driverOption === 'WithDriver' ? assignedDriverPersonId : undefined,
      justificationCategory,
      durationStart,
      durationEnd,
      locationNodeId,
      requestedVehicleClass: vehicleCategoryCode,
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const locationNodeId = context.data?.defaults.locationNodeId
    if (!locationNodeId || !justificationCategory || !justificationText.trim() || !vehicleCategoryCode) {
      setValidation(t('dedicated.validation.required'))
      return
    }
    if (durationEnd < durationStart) {
      setValidation(t('dedicated.validation.window'))
      return
    }
    if (eligibility?.decision !== 'ALLOW' || !eligibility.previewId) {
      setValidation(t('dedicated.validation.eligibilityRequired'))
      return
    }
    setValidation(null)
    const input: CreateDedicatedVehicleDraft = {
      requestType,
      driverOption,
      assignedDriverPersonId: driverOption === 'WithDriver' ? assignedDriverPersonId : undefined,
      justificationCategory: justificationCategory.trim(),
      justificationText: justificationText.trim(),
      vehicleCategoryCode: vehicleCategoryCode.trim() || undefined,
      preferredVehicleId: preferredVehicleId || undefined,
      preferenceNote: preferenceNote.trim() || undefined,
      eligibilityPreviewId: eligibility.previewId,
      durationStart,
      durationEnd,
      locationNodeId,
      businessUnit: businessUnit.trim() || undefined,
      costCentre: costCentre.trim() || undefined,
    }
    if (editing) updateDraft.mutate(input)
    else createDraft.mutate(input)
  }

  function editDraft(request: Entitlement) {
    setEditing(request)
    setRequestType(request.requestType)
    setDriverOption(request.driverOption ?? 'WithoutDriver')
    setAssignedDriverPersonId(request.assignedDriverPersonId ?? '')
    setDurationStart(request.durationStart)
    setDurationEnd(request.durationEnd)
    setJustificationCategory(request.justificationCategory)
    setJustificationText(request.justificationText)
    setVehicleCategoryCode(request.vehicleCategoryCode ?? '')
    setPreferredVehicleId('')
    setEligibility(null)
    setPreferenceNote(request.preferenceNote ?? '')
    setBusinessUnit(request.businessUnit ?? '')
    setCostCentre(request.costCentre ?? '')
    setValidation(null)
    commandKey.current = crypto.randomUUID()
    setActiveTab('request')
  }

  if (context.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('dedicated.loading')}</p>
  if (context.isError || !context.data) {
    return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><h1 className="font-bold">{t('dedicated.unavailable')}</h1><Button className="mt-3" variant="secondary" onClick={() => void context.refetch()}>{t('common.retry')}</Button></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('dedicated.eyebrow')} title={t('dedicated.title')} description={t('dedicated.subtitle')} />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="request">{t('dedicated.tabs.request')}</TabsTrigger>
          <TabsTrigger value="mine">{t('dedicated.tabs.mine', { count: requests.data?.length ?? 0 })}</TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="space-y-5 pt-5">
          <RequestProgress />
          <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <fieldset disabled={busy} className="contents">
            <section className="border border-border bg-card p-5 shadow-[var(--shadow-rest)]">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 size-5 text-brand" /><div><h2 className="font-bold">{editing ? t('dedicated.form.editTitle') : t('dedicated.form.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('dedicated.form.description')}</p></div></div>{editing && <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>{t('dedicated.form.stopEditing')}</Button>}</div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field label={t('dedicated.fields.durationMode')} htmlFor="dedicated-duration-mode">
                  <Segmented aria-label={t('dedicated.fields.durationMode')} value={requestType} onValueChange={(value) => { setRequestType(value as 'LongTerm' | 'Temporary'); clearEligibility() }} options={[{ value: 'LongTerm', label: t('dedicated.duration.longTerm') }, { value: 'Temporary', label: t('dedicated.duration.temporary') }]} />
                </Field>
                <Field label={t('dedicated.fields.driverMode')} htmlFor="dedicated-driver-mode">
                  <Segmented aria-label={t('dedicated.fields.driverMode')} aria-describedby="dedicated-driver-reasons" value={driverOption} onValueChange={(value) => { setDriverOption(value as 'WithDriver' | 'WithoutDriver'); setAssignedDriverPersonId(''); clearEligibility() }} options={[{ value: 'WithoutDriver', label: t('dedicated.driver.without') }, { value: 'WithDriver', label: t('dedicated.driver.with'), disabled: !context.data.capabilities.withDriver.enabled }]} />
                  {!context.data.capabilities.withDriver.enabled && <p id="dedicated-driver-reasons" className="mt-2 text-xs text-muted-foreground">{context.data.capabilities.withDriver.blockingReasons.map(reasonText).join(' ')}</p>}
                </Field>
                {driverOption === 'WithDriver' && <Field label={t('dedicated.fields.professionalDriver')} htmlFor="dedicated-professional-driver"><Select value={assignedDriverPersonId} onValueChange={(value) => { setAssignedDriverPersonId(value); clearEligibility() }}><SelectTrigger id="dedicated-professional-driver"><SelectValue placeholder={t('dedicated.selectProfessionalDriver')} /></SelectTrigger><SelectContent>{professionalDrivers.data?.map((driver) => <SelectItem key={driver.personId} value={driver.personId}>{driver.fullName} · <bdi>{driver.employeeId}</bdi></SelectItem>)}</SelectContent></Select></Field>}
                <Field label={t('dedicated.fields.start')} htmlFor="dedicated-start"><Input id="dedicated-start" type="date" value={durationStart} onChange={(event) => { setDurationStart(event.target.value); clearEligibility() }} /></Field>
                <Field label={t('dedicated.fields.end')} htmlFor="dedicated-end"><Input id="dedicated-end" type="date" value={durationEnd} onChange={(event) => { setDurationEnd(event.target.value); clearEligibility() }} /></Field>
                <Field label={t('dedicated.fields.location')} htmlFor="dedicated-location"><Input id="dedicated-location" value={context.data.defaults.locationName ?? ''} disabled /></Field>
                <Field label={t('dedicated.fields.vehicleClass')} htmlFor="dedicated-class"><Select value={vehicleCategoryCode} onValueChange={(value) => { setVehicleCategoryCode(value); clearEligibility() }}><SelectTrigger id="dedicated-class"><SelectValue placeholder={t('dedicated.selectVehicleClass')} /></SelectTrigger><SelectContent>{vehicleClasses.data?.map((option) => <SelectItem key={option.id} value={option.code}>{locale.startsWith('ar') ? option.labelAr : option.labelEn}</SelectItem>)}</SelectContent></Select></Field>
                <Field label={t('dedicated.fields.businessUnit')} htmlFor="dedicated-business-unit"><Input id="dedicated-business-unit" value={businessUnit} onChange={(event) => setBusinessUnit(event.target.value)} /></Field>
                <Field label={t('dedicated.fields.costCentre')} htmlFor="dedicated-cost-centre"><Input id="dedicated-cost-centre" value={costCentre} onChange={(event) => setCostCentre(event.target.value)} /></Field>
                <Field label={t('dedicated.fields.justificationCategory')} htmlFor="dedicated-justification-category"><Select value={justificationCategory} onValueChange={(value) => { setJustificationCategory(value); clearEligibility() }}><SelectTrigger id="dedicated-justification-category"><SelectValue placeholder={t('dedicated.selectJustification')} /></SelectTrigger><SelectContent>{justificationCategories.data?.map((option) => <SelectItem key={option.id} value={option.code}>{locale.startsWith('ar') ? option.labelAr : option.labelEn}</SelectItem>)}</SelectContent></Select></Field>
                <div className="sm:col-span-2"><Field label={t('dedicated.fields.justification')} htmlFor="dedicated-justification"><Textarea id="dedicated-justification" value={justificationText} maxLength={2000} onChange={(event) => setJustificationText(event.target.value)} /></Field></div>
              </div>
            </section>
            <aside className="space-y-4">
              <section className="border border-border bg-card p-5"><div className="flex items-center gap-3"><CarFront className="size-5 text-brand" /><h2 className="font-bold">{t('dedicated.preference.title')}</h2></div><p className="mt-2 text-sm text-muted-foreground">{t('dedicated.preference.nonBinding')}</p><Button type="button" variant="secondary" className="mt-4 w-full" onClick={checkEligibility} disabled={busy || !context.data.capabilities.eligibilityPreview.enabled}>{previewEligibility.isPending ? t('dedicated.eligibility.checking') : t('dedicated.eligibility.check')}</Button>{eligibility && <div role="status" className={`mt-3 border p-3 text-sm ${eligibility.decision === 'ALLOW' ? 'border-success/30 bg-success/5 text-success' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}><strong>{eligibility.decision === 'ALLOW' ? t('dedicated.eligibility.allowed') : t('dedicated.eligibility.denied')}</strong><p className="mt-1 text-xs">{eligibility.reasons.map(reasonText).join(' ')}</p></div>}{previewEligibility.isError && <p role="alert" className="mt-3 text-sm text-destructive">{t('dedicated.eligibility.error')}</p>}<Label htmlFor="dedicated-preferred-vehicle" className="mt-5 block text-xs font-bold">{t('dedicated.fields.preferredVehicle')}</Label><Select value={preferredVehicleId} onValueChange={setPreferredVehicleId} disabled={eligibility?.decision !== 'ALLOW' || !eligibility.eligibleVehicleOptions.length}><SelectTrigger id="dedicated-preferred-vehicle" className="mt-2"><SelectValue placeholder={eligibility?.decision === 'ALLOW' ? t('dedicated.preference.select') : t('dedicated.preference.runEligibility')} /></SelectTrigger><SelectContent>{eligibility?.eligibleVehicleOptions.map((vehicle) => <SelectItem key={vehicle.vehicleId} value={vehicle.vehicleId}><bdi>{vehicle.plate}</bdi> · {vehicle.makeCode} {vehicle.modelCode}</SelectItem>)}</SelectContent></Select>{eligibility?.decision === 'ALLOW' && !eligibility.eligibleVehicleOptions.length && <p className="mt-2 text-xs text-muted-foreground">{t('dedicated.preference.noneEligible')}</p>}<Label htmlFor="dedicated-preference-note" className="mt-4 block text-xs font-bold">{t('dedicated.fields.preferenceNote')}</Label><Textarea id="dedicated-preference-note" className="mt-2" value={preferenceNote} maxLength={500} onChange={(event) => setPreferenceNote(event.target.value)} placeholder={t('dedicated.preference.placeholder')} /><output aria-live="polite" aria-atomic="true" className="mt-2 block text-end text-xs text-muted-foreground">{preferenceNote.length}/500</output></section>
              <section className="border border-warning/30 bg-warning/5 p-4"><div className="flex gap-2"><Clock3 className="mt-0.5 size-4 shrink-0 text-warning" /><div><h3 className="text-sm font-bold">{t('dedicated.gates.title')}</h3><p className="mt-1 text-xs text-muted-foreground">{context.data.capabilities.submit.blockingReasons.map(reasonText).join(' ')} {context.data.capabilities.allocation.blockingReasons.map(reasonText).join(' ')}</p></div></div></section>
              {validation && <p role="alert" className="text-sm text-destructive">{validation}</p>}
              {saveError && <div role="alert" className="text-sm text-destructive"><p>{revisionConflict ? t('dedicated.revisionConflict') : t('dedicated.saveError')}</p>{revisionConflict && <Button type="button" className="mt-2" size="sm" variant="secondary" onClick={() => void requests.refetch()}>{t('dedicated.refreshRequests')}</Button>}</div>}
              {(createDraft.isSuccess || updateDraft.isSuccess) && <output className="flex items-center gap-2 text-sm text-success"><Check className="size-4" />{editing ? t('dedicated.updatedEligibilityCleared') : t('dedicated.saved')}</output>}
              <Button type="submit" className="w-full" size="lg" disabled={!context.data.capabilities.createDraft.enabled || busy || eligibility?.decision !== 'ALLOW' || !eligibility.previewId}>{busy ? t('dedicated.saving') : editing ? t('dedicated.updateDraft') : t('dedicated.saveDraft')}</Button>
            </aside>
            </fieldset>
          </form>
        </TabsContent>
        <TabsContent value="mine" className="pt-5">
          {requests.isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">{t('dedicated.loadingMine')}</p> : requests.data?.length ? <div className="space-y-3">{requests.data.map((request) => <article key={request.id} className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong>{t(`dedicated.duration.${request.requestType === 'LongTerm' ? 'longTerm' : 'temporary'}`)}</strong><bdi className="font-data text-xs">{request.id}</bdi></div><p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).formatRange(new Date(`${request.durationStart}T00:00:00Z`), new Date(`${request.durationEnd}T00:00:00Z`))}</p>{request.preferenceNote && <p className="mt-2 text-sm">{request.preferenceNote}</p>}<p className="mt-2 text-xs text-muted-foreground">{t(`dedicated.statusGuidance.${request.status}`, { defaultValue: request.status })}</p>{request.status === 'Approved' && consentContext.data?.content && <p className="mt-3 border-s-2 border-brand ps-3 text-sm">{locale.startsWith('ar') ? consentContext.data.content.ar : consentContext.data.content.en}</p>}</div><div className="flex flex-wrap items-center gap-2"><StatusChip tone={request.status === 'Draft' ? 'neutral' : request.status === 'Approved' || request.status === 'Allocated' ? 'ok' : 'warn'} label={request.status} />{request.capabilities.edit && <Button size="sm" variant="secondary" onClick={() => editDraft(request)}>{request.status === 'ModificationRequested' ? t('dedicated.respondModification') : t('dedicated.editDraft')}</Button>}{request.capabilities.submit && <Button size="sm" onClick={() => submitRequest.mutate(request)} disabled={submitRequest.isPending}>{t('dedicated.submitRequest')}</Button>}{request.capabilities.consent && <Button size="sm" onClick={() => consentRequest.mutate(request)} disabled={!consentContext.data?.available || consentRequest.isPending}>{t('dedicated.signConsent')}</Button>}{request.capabilities.cancel && <Button size="sm" variant="secondary" onClick={() => { setLifecycleRequest(request); setLifecycleAction('cancel') }}>{t('dedicated.cancelRequest')}</Button>}{request.capabilities.renew && <Button size="sm" variant="secondary" onClick={() => { setLifecycleRequest(request); setLifecycleAction('renew') }}>{t('dedicated.renewRequest')}</Button>}</div></article>)}</div> : <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('dedicated.empty')}</p>}
          {submitRequest.isError && <p role="alert" className="mt-3 text-sm text-destructive">{t('dedicated.submitError')}</p>}
          {lifecycleAction && <section role="dialog" aria-modal="true" aria-labelledby="dedicated-lifecycle-title" className="mt-4 border border-border bg-card p-5"><h2 id="dedicated-lifecycle-title" className="font-bold">{lifecycleAction === 'cancel' ? t('dedicated.cancelTitle') : t('dedicated.renewTitle')}</h2>{lifecycleAction === 'cancel' ? <div className="mt-4"><Label htmlFor="dedicated-cancel-reason">{t('dedicated.cancelReason')}</Label><Textarea id="dedicated-cancel-reason" className="mt-2" value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} /></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={t('dedicated.fields.start')} htmlFor="renewal-start"><Input id="renewal-start" type="date" value={renewalStart} onChange={(event) => setRenewalStart(event.target.value)} /></Field><Field label={t('dedicated.fields.end')} htmlFor="renewal-end"><Input id="renewal-end" type="date" value={renewalEnd} onChange={(event) => setRenewalEnd(event.target.value)} /></Field></div>}<div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setLifecycleAction(null)}>{t('common.cancel')}</Button><Button onClick={() => lifecycle.mutate()} disabled={lifecycle.isPending || lifecycleAction === 'cancel' && !lifecycleReason.trim()}>{t('common.confirm')}</Button></div></section>}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div><Label htmlFor={htmlFor} className="text-xs font-bold">{label}</Label><div className="mt-2">{children}</div></div>
}

function RequestProgress() {
  const { t } = useTranslation()
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={t('dedicated.progress.label')}>
      {(['details', 'eligibility', 'review', 'submitted'] as const).map((step, index) => (
        <li key={step} className={`border-t-2 pt-2 text-xs ${index === 0 ? 'border-brand font-bold text-foreground' : 'border-border text-muted-foreground'}`}>
          <span className="font-data">{index + 1}</span> {t(`dedicated.progress.${step}`)}
          {step === 'eligibility' && <span className="mt-1 block text-[10px]">{t('dedicated.progress.pending')}</span>}
        </li>
      ))}
    </ol>
  )
}