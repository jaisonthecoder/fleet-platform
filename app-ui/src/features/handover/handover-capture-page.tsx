import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Camera, KeyRound, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Segmented } from '@/components/ui/segmented'
import { StatusChip } from '@/components/ui/status-chip'
import { CameraCapture } from '@/components/patterns/camera-capture'
import { DamageMarker, type DamageMark } from '@/components/patterns/damage-marker'
import { SignaturePad, type SignaturePadHandle } from '@/components/patterns/signature-pad'
import { useConfirm } from '@/hooks/use-confirm'
import { notify } from '@/hooks/use-toast'
import { useAuth } from '@/features/auth/auth-context'
import { defaultLanguage } from '@/i18n/config'
import { cn } from '@/lib/utils'
import {
  normalizeDamageCoordinate,
  openHandoverV2,
  returnHandoverV2,
  stageHandoverEvidence,
  type HandoverV2Inspection,
} from './handover.contract'
import { handoverKeys, useHandoverCaptureContext } from './handover.query'

type Verdict = 'Pass' | 'Fail' | undefined
const CHECKS = ['body', 'tyres', 'lights', 'assets', 'cabin'] as const
const EIGHTHS = ['E', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞', 'F']

interface InspectionState {
  verdict?: Verdict
  note: string
  evidenceRefs: string[]
}

interface CapturedPhoto {
  ref: string
  url: string
}

/** Production Handover/Return capture built from the approved demo composition. */
export function HandoverCapturePage() {
  const { t } = useTranslation()
  const { lang = defaultLanguage } = useParams()
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get('bookingId')
  const context = useHandoverCaptureContext(bookingId)
  const { me } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const signatureRef = useRef<SignaturePadHandle>(null)
  const commandKey = useRef(crypto.randomUUID())
  const [fuel, setFuel] = useState(8)
  const [odometer, setOdometer] = useState('')
  const [keyConfirmed, setKeyConfirmed] = useState(false)
  const [keyRef, setKeyRef] = useState('')
  const [keyOutcome, setKeyOutcome] = useState<'Returned' | 'Lost'>('Returned')
  const [keyLostReason, setKeyLostReason] = useState('')
  const [condition, setCondition] = useState<'Good' | 'MinorWear' | 'DamageNoted' | ''>('')
  const [inspection, setInspection] = useState<Record<string, InspectionState>>(() => Object.fromEntries(CHECKS.map((code) => [code, { note: '', evidenceRefs: [] }])))
  const [inspectionCamera, setInspectionCamera] = useState<string | null>(null)
  const [marks, setMarks] = useState<DamageMark[]>([])
  const [initializedDamage, setInitializedDamage] = useState(false)
  const [vehiclePhotos, setVehiclePhotos] = useState<CapturedPhoto[]>([])
  const [vehicleCameraOpen, setVehicleCameraOpen] = useState(false)
  const [signed, setSigned] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  const data = context.data
  const isReturn = data?.capabilities.return === true
  useEffect(() => {
    if (!data || initializedDamage) return
    setMarks(data.carriedDamage.map((mark) => ({
      id: mark.id,
      x: mark.x * 100,
      y: mark.y * 100,
      note: mark.note ?? mark.region,
      photos: [],
      photoRefs: [],
      existing: true,
    })))
    setOdometer(data.telematics.odometer ?? '')
    setInitializedDamage(true)
  }, [data, initializedDamage])

  const decided = CHECKS.filter((code) => inspection[code]?.verdict).length
  const failedIncomplete = CHECKS.some((code) => {
    const item = inspection[code]
    return item?.verdict === 'Fail' && (!item.note.trim() || item.evidenceRefs.length === 0)
  })
  const newMarks = marks.filter((mark) => !mark.existing)
  const damageIncomplete = newMarks.some((mark) => !mark.note.trim() || !(mark.photoRefs?.length))
  const outstanding = useMemo(() => {
    const items: string[] = []
    if (decided < CHECKS.length) items.push(t('handover.capturePage.remainingChecks', { count: CHECKS.length - decided }))
    if (failedIncomplete) items.push(t('handover.capturePage.failedEvidence'))
    if (damageIncomplete) items.push(t('handover.capturePage.damageEvidence'))
    if (!keyConfirmed) items.push(t('handover.capturePage.key'))
    if (isReturn && !condition) items.push(t('handover.capturePage.condition'))
    if (isReturn && keyOutcome === 'Lost' && !keyLostReason.trim()) items.push(t('handover.capturePage.lostReason'))
    if (!signed) items.push(t('handover.capturePage.signature'))
    if (!odometer || Number.isNaN(Number(odometer)) || Number(odometer) < 0) items.push(t('handover.capturePage.odometer'))
    return items
  }, [condition, damageIncomplete, decided, failedIncomplete, isReturn, keyConfirmed, keyLostReason, keyOutcome, odometer, signed, t])
  const dirty = !completed && (decided > 0 || keyConfirmed || signed || vehiclePhotos.length > 0 || newMarks.length > 0 || Boolean(keyRef.trim()) || Boolean(condition))
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const command = useMutation({
    mutationFn: async () => {
      if (!data || !me?.personId) throw new Error('capture context is unavailable')
      const signature = signatureRef.current?.getValue()
      if (!signature?.value) throw new Error('signature is required')
      const signatureBlob = signature.mode === 'draw'
        ? await dataUrlToBlob(signature.value)
        : await typedSignatureBlob(signature.value)
      const signerPersonId = isReturn ? me.personId : data.driver.personId
      const stagedSignature = await stageWithRetry({
        file: signatureBlob,
        evidenceType: 'Signature',
        signerPersonId,
        deviceRef: navigator.userAgent.slice(0, 200),
      })
      const inspectionInput: HandoverV2Inspection[] = CHECKS.map((code) => ({
        code,
        verdict: inspection[code]!.verdict!,
        note: inspection[code]!.note.trim() || undefined,
        evidenceRefs: [...inspection[code]!.evidenceRefs].sort(),
      }))
      if (isReturn) {
        return returnHandoverV2({
          context: data,
          odometer: Number(odometer),
          fuelEighths: fuel,
          keyRef: keyRef.trim() || undefined,
          keyOutcome,
          keyLostReason: keyLostReason.trim() || undefined,
          condition: condition as 'Good' | 'MinorWear' | 'DamageNoted',
          inspection: inspectionInput,
          vehiclePhotoRefs: vehiclePhotos.map(({ ref }) => ref).sort(),
          signatureEvidenceRef: stagedSignature.id,
          newDamage: newMarks.map((mark) => ({
            x: normalizeDamageCoordinate(mark.x),
            y: normalizeDamageCoordinate(mark.y),
            region: mark.note.trim().slice(0, 60),
            templateVersion: 1,
            photoRef: mark.photoRefs?.[0],
            note: mark.note.trim(),
            state: 'new',
          })),
        }, commandKey.current)
      }
      return openHandoverV2({
        context: data,
        odometer: Number(odometer),
        fuelEighths: fuel,
        keyRef: keyRef.trim(),
        inspection: inspectionInput,
        vehiclePhotoRefs: vehiclePhotos.map(({ ref }) => ref).sort(),
        signatureEvidenceRef: stagedSignature.id,
        existingDamage: data.carriedDamage.map((mark) => ({
          x: mark.x,
          y: mark.y,
          region: mark.region,
          templateVersion: mark.templateVersion,
          note: mark.note ?? undefined,
          state: 'existing',
          carriedFromDamagePinId: mark.id,
        })),
      }, commandKey.current)
    },
    onSuccess: async () => {
      setCompleted(true)
      notify.ok(t(isReturn ? 'handover.capturePage.returnSuccess' : 'handover.capturePage.handoverSuccess'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: handoverKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['booking'] }),
        queryClient.invalidateQueries({ queryKey: ['operations'] }),
      ])
      navigate(`/${lang}/handover`)
    },
  })

  /** Stages one private image and returns its opaque evidence ID. */
  async function stagePhoto(file: File, evidenceType: 'VehiclePhoto' | 'DamagePhoto') {
    return (await stageWithRetry({ file, evidenceType, deviceRef: navigator.userAgent.slice(0, 200) })).id
  }

  /** Retries transient staged-evidence failures without changing the selected file. */
  async function stageWithRetry(input: Parameters<typeof stageHandoverEvidence>[0]) {
    setUploadError(null)
    let failure: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await stageHandoverEvidence(input)
      } catch (error) {
        failure = error
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt))
      }
    }
    setUploadError(t('handover.capturePage.uploadFailed'))
    throw failure
  }

  /** Confirms the complete evidence command after server-independent readiness checks. */
  async function submit() {
    if (outstanding.length || command.isPending) {
      setValidation(t('handover.capturePage.completeEvidence'))
      return
    }
    const accepted = await confirm({
      title: t(isReturn ? 'handover.capturePage.confirmReturnTitle' : 'handover.capturePage.confirmHandoverTitle'),
      description: t(isReturn ? 'handover.capturePage.confirmReturnBody' : 'handover.capturePage.confirmHandoverBody'),
      confirmLabel: t(isReturn ? 'handover.confirmReturn' : 'handover.capturePage.handOverKeys'),
    })
    if (accepted) command.mutate()
  }

  if (!bookingId) return <CaptureError message={t('handover.capturePage.bookingRequired')} />
  if (context.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('handover.capturePage.loading')}</p>
  if (context.isError || !data) return <CaptureError message={t('handover.capturePage.loadError')} onRetry={() => void context.refetch()} />

  const mode = isReturn ? 'return' : 'handover'
  const vehicleName = [data.vehicle.makeCode, data.vehicle.modelCode].filter(Boolean).join(' ').replaceAll('_', ' ') || data.vehicle.plate
  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow mb-1.5">{t('handover.capturePage.eyebrow', { scope: data.scope.name })}</p><h1 className="text-2xl font-bold tracking-tight">{t(isReturn ? 'handover.returnPage.title' : 'handover.title')}</h1>{isReturn && <p className="mt-1 text-sm text-muted-foreground">{t('handover.returnPage.subtitle')}</p>}</div>
        <Segmented aria-label={t('handover.capturePage.mode')} value={mode} onValueChange={() => undefined} options={[{ value: 'handover', label: t('handover.capturePage.handover'), disabled: !data.capabilities.handover }, { value: 'return', label: t('handover.capturePage.return'), disabled: !data.capabilities.return }]} />
      </div>

      <div className="rounded-[3px] bg-brand px-5 py-4 text-brand-foreground">
        <div className="flex flex-wrap items-center gap-x-9 gap-y-3">
          <StripFact label={t('handover.booking')} value={data.booking.number} mono />
          <StripFact label={t('handover.vehicle')} value={`${vehicleName} · ${data.vehicle.plate}`} />
          <StripFact label={t('handover.driver')} value={data.driver.fullName} />
          <span className="ms-auto"><StatusChip tone={data.telematics.status === 'MATCHED' ? 'ok' : 'warn'} label={t(`handover.capturePage.telematics.${data.telematics.status}`)} /></span>
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-foreground/65">✓ {t('handover.capturePage.evidenceLine', { consent: data.consent.version })}</p>
      </div>

      {isReturn && data.handover && (
        <ReturnComparison
          baseline={data.handover}
          returnOdometer={odometer}
          returnFuel={fuel}
          keyOutcome={keyOutcome}
          keyRef={keyRef}
          returnLocation={data.scope.name}
          carriedDamage={data.carriedDamage.length}
          newDamage={newMarks.length}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded-[3px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-bold">{t(isReturn ? 'handover.returnPage.inspection' : 'handover.inspection')}</h2><span className="eyebrow">{t('handover.capturePage.decided', { decided, total: CHECKS.length })}</span></div>
            <div className="space-y-2.5 p-5">
              {CHECKS.map((code) => <InspectionRow key={code} code={code} value={inspection[code]!} onChange={(next) => setInspection((current) => ({ ...current, [code]: next }))} onPhoto={() => setInspectionCamera(code)} />)}
            </div>
          </section>
          <Readings odometer={odometer} setOdometer={setOdometer} fuel={fuel} setFuel={setFuel} isReturn={isReturn} telematics={data.telematics.odometer} telematicsStatus={data.telematics.status} />
          <section className="rounded-[3px] border border-border bg-card p-5">
            <p className="eyebrow mb-3">{t('handover.capturePage.key')}</p>
            <Input value={keyRef} onChange={(event) => setKeyRef(event.target.value)} placeholder={t(isReturn ? 'handover.keyReturn' : 'handover.keyIssue')} />
            {isReturn && <div className="mt-4"><Segmented aria-label={t('handover.capturePage.keyOutcome')} value={keyOutcome} onValueChange={(value) => setKeyOutcome(value as 'Returned' | 'Lost')} options={[{ value: 'Returned', label: t('handover.capturePage.keyReturned') }, { value: 'Lost', label: t('handover.capturePage.keyLost') }]} />{keyOutcome === 'Lost' && <Input className="mt-3" value={keyLostReason} onChange={(event) => setKeyLostReason(event.target.value)} placeholder={t('handover.capturePage.lostReasonPlaceholder')} />}</div>}
            <Button className="mt-4" variant={keyConfirmed ? 'default' : 'secondary'} onClick={() => setKeyConfirmed((value) => !value)}><KeyRound />{t(keyConfirmed ? 'handover.capturePage.keyConfirmed' : isReturn ? 'handover.capturePage.confirmKeyReturn' : 'handover.capturePage.confirmKeyIssue')}</Button>
            {isReturn && <div className="mt-5"><p className="eyebrow mb-2">{t('handover.condition')}</p><Segmented aria-label={t('handover.condition')} value={condition} onValueChange={(value) => setCondition(value as typeof condition)} options={[{ value: 'Good', label: t('handover.capturePage.conditions.Good') }, { value: 'MinorWear', label: t('handover.capturePage.conditions.MinorWear') }, { value: 'DamageNoted', label: t('handover.capturePage.conditions.DamageNoted') }]} /></div>}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[3px] border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-bold">{t(isReturn ? 'handover.returnPage.conditionCapture' : 'handover.capturePage.conditionCapture')}</h2><p className="mt-1 text-xs text-muted-foreground">{t(isReturn ? 'handover.returnPage.conditionHelp' : 'handover.capturePage.conditionHelp')}</p></div><div className="p-5"><DamageMarker marks={marks} onChange={setMarks} onStagePhoto={(file) => stagePhoto(file, 'DamagePhoto')} labels={{ markDamage: t('handover.capturePage.damage.mark'), existingHelp: t('handover.capturePage.damage.help'), empty: t('handover.capturePage.damage.empty'), existing: t('handover.capturePage.damage.existing'), logged: t('handover.capturePage.damage.logged'), newMark: t('handover.capturePage.damage.new'), describePlaceholder: t('handover.capturePage.damage.describe'), photo: t('handover.capturePage.damage.photo'), photoRequired: t('handover.capturePage.damage.photoRequired') }} /></div></section>
          <section className="rounded-[3px] border border-border bg-card p-5"><div className="mb-3 flex items-center justify-between"><p className="eyebrow">{t('handover.capturePage.vehiclePhotos', { mode: t(`handover.capturePage.${mode}`) })}</p><Button size="sm" variant="secondary" onClick={() => setVehicleCameraOpen(true)}><Camera />{t('handover.capturePage.capture')}</Button></div><PhotoList photos={vehiclePhotos} onRemove={(index) => setVehiclePhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} empty={t('handover.capturePage.noPhotos')} /></section>
          <section className="rounded-[3px] border border-border bg-card p-5"><div className="mb-2 flex justify-between"><p className="eyebrow">{t('handover.capturePage.signatureFor', { name: isReturn ? me?.fullName : data.driver.fullName })}</p><button type="button" className="text-sm text-muted-foreground" onClick={() => signatureRef.current?.clear()}>{t('handover.capturePage.clear')}</button></div><SignaturePad ref={signatureRef} signerName={isReturn ? me?.fullName : data.driver.fullName} onSignedChange={setSigned} labels={{ method: t('handover.capturePage.signatureMethod'), draw: t('handover.capturePage.draw'), type: t('handover.capturePage.type'), area: t('handover.capturePage.signatureArea'), typeName: t('handover.capturePage.typeName'), signature: t('handover.capturePage.signature') }} /><p className="mt-3 rounded-[3px] bg-brand-soft p-3 text-xs text-brand">✓ {t('handover.capturePage.signatureScope', { consent: data.consent.version, mode: t(`handover.capturePage.${mode}`) })}</p></section>
        </div>
      </div>

      {(validation || command.isError) && <p role="alert" className="text-sm text-destructive">{validation ?? t('handover.actionError')}</p>}
      {uploadError && <p role="alert" className="text-sm text-destructive">{uploadError}</p>}
      {blocker.state === 'blocked' && <div role="alertdialog" aria-modal="true" className="fixed inset-x-4 bottom-4 z-50 border border-warning/40 bg-background p-4 shadow-[var(--shadow-float)]"><p className="font-bold">{t('handover.capturePage.discardTitle')}</p><p className="mt-1 text-sm text-muted-foreground">{t('handover.capturePage.discardBody')}</p><div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => blocker.reset()}>{t('handover.capturePage.stay')}</Button><Button variant="destructive" onClick={() => blocker.proceed()}>{t('handover.capturePage.discard')}</Button></div></div>}
      <div className="sticky bottom-0 z-10 -mx-5 border-t border-border bg-background/95 px-5 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] backdrop-blur md:-mx-[34px] md:px-[34px]"><div className="flex items-center gap-4"><span className="text-sm text-muted-foreground">{outstanding.length ? t('handover.capturePage.itemsLeft', { count: outstanding.length, items: outstanding.join(' · ') }) : t('handover.capturePage.ready')}</span><Button className="ms-auto" size="lg" disabled={outstanding.length > 0 || command.isPending} onClick={() => void submit()}>{isReturn ? t('handover.confirmReturn') : t('handover.capturePage.handOverKeys')}</Button></div></div>

      <CameraCapture open={vehicleCameraOpen} onOpenChange={setVehicleCameraOpen} onCaptureError={() => setUploadError(t('handover.capturePage.uploadRetry'))} onCaptureFile={async (file) => { const ref = await stagePhoto(file, 'VehiclePhoto'); setVehiclePhotos((current) => [...current, { ref, url: URL.createObjectURL(file) }]) }} title={t('handover.capturePage.photoTitle')} description={t('handover.capturePage.photoDescription')} />
      <CameraCapture open={inspectionCamera !== null} onOpenChange={(open) => { if (!open) setInspectionCamera(null) }} onCaptureError={() => setUploadError(t('handover.capturePage.uploadRetry'))} onCaptureFile={async (file) => { if (!inspectionCamera) return; const ref = await stagePhoto(file, 'DamagePhoto'); setInspection((current) => ({ ...current, [inspectionCamera]: { ...current[inspectionCamera]!, evidenceRefs: [...current[inspectionCamera]!.evidenceRefs, ref] } })); setInspectionCamera(null) }} title={t('handover.capturePage.inspectionPhotoTitle')} description={t('handover.capturePage.inspectionPhotoDescription')} />
    </div>
  )
}

function ReturnComparison({ baseline, returnOdometer, returnFuel, keyOutcome, keyRef, returnLocation, carriedDamage, newDamage }: {
  baseline: NonNullable<import('./handover.contract').HandoverCaptureContext['handover']>
  returnOdometer: string
  returnFuel: number
  keyOutcome: 'Returned' | 'Lost'
  keyRef: string
  returnLocation: string
  carriedDamage: number
  newDamage: number
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const start = Number(baseline.startOdometer)
  const end = Number(returnOdometer)
  const distance = Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null
  const fuelDelta = returnFuel - baseline.startFuelEighths
  const sameLocation = Boolean(baseline.releaseLocation.name && baseline.releaseLocation.name === returnLocation)
  const rows = [
    { key: 'odometer', baseline: `${baseline.startOdometer} km`, capture: returnOdometer ? `${returnOdometer} km` : t('handover.returnPage.pending'), result: distance === null ? t('handover.returnPage.pending') : t('handover.returnPage.distance', { value: distance }) },
    { key: 'fuel', baseline: `${EIGHTHS[baseline.startFuelEighths]} (${baseline.startFuelEighths}/8)`, capture: `${EIGHTHS[returnFuel]} (${returnFuel}/8)`, result: t('handover.returnPage.fuelDelta', { value: fuelDelta }) },
    { key: 'damage', baseline: t('handover.returnPage.carriedCount', { count: carriedDamage }), capture: t('handover.returnPage.newCount', { count: newDamage }), result: newDamage ? t('handover.returnPage.reviewRequired') : t('handover.returnPage.noNewDamage') },
    { key: 'key', baseline: baseline.keyIssueRef ?? t('booking.notAvailable'), capture: keyOutcome === 'Lost' ? t('handover.capturePage.keyLost') : keyRef || t('handover.returnPage.pending'), result: keyOutcome === 'Lost' ? t('handover.returnPage.keyReview') : keyRef ? t('handover.returnPage.custodyCloses') : t('handover.returnPage.pending') },
    { key: 'location', baseline: baseline.releaseLocation.name ?? t('booking.notAvailable'), capture: returnLocation, result: sameLocation ? t('handover.returnPage.sameLocation') : t('handover.returnPage.alternateLocation') },
  ]
  return <section className="overflow-hidden rounded-[3px] border border-info/30 bg-card" aria-labelledby="return-comparison-title"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-info/5 px-5 py-4"><div><h2 id="return-comparison-title" className="font-bold">{t('handover.returnPage.comparison')}</h2><p className="mt-1 text-xs text-muted-foreground">{t('handover.returnPage.baselineLocked', { time: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(baseline.issuedAtUtc)) })}</p></div><StatusChip tone="info" label={t('handover.returnPage.appendOnly')} /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-surface-2 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start">{t('handover.returnPage.evidence')}</th><th className="p-3 text-start">{t('handover.returnPage.baseline')}</th><th className="p-3 text-start">{t('handover.returnPage.capture')}</th><th className="p-3 text-start">{t('handover.returnPage.result')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-t border-border"><th scope="row" className="p-3 text-start font-bold">{t(`handover.returnPage.rows.${row.key}`)}</th><td className="p-3 text-muted-foreground"><bdi>{row.baseline}</bdi></td><td className="p-3"><bdi>{row.capture}</bdi></td><td className="p-3 font-semibold"><bdi>{row.result}</bdi></td></tr>)}</tbody></table></div></section>
}

function InspectionRow({ code, value, onChange, onPhoto }: { code: string; value: InspectionState; onChange: (value: InspectionState) => void; onPhoto: () => void }) {
  const { t } = useTranslation()
  return <div className={cn('rounded-[3px] border p-3', value.verdict === 'Pass' && 'border-success/40 bg-success/10', value.verdict === 'Fail' && 'border-destructive/40 bg-destructive/10')}><div className="flex items-center justify-between gap-3"><div><strong className="text-sm">{t(`handover.capturePage.checks.${code}.label`)}</strong><p className="text-xs text-muted-foreground">{t(`handover.capturePage.checks.${code}.description`)}</p></div><div className="flex gap-1"><VerdictButton active={value.verdict === 'Pass'} onClick={() => onChange({ ...value, verdict: 'Pass' })}>{t('handover.capturePage.pass')}</VerdictButton><VerdictButton active={value.verdict === 'Fail'} danger onClick={() => onChange({ ...value, verdict: 'Fail' })}>{t('handover.capturePage.fail')}</VerdictButton></div></div>{value.verdict === 'Fail' && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder={t('handover.capturePage.failureNote')} /><Button type="button" variant="secondary" onClick={onPhoto}><Camera />{t('handover.capturePage.evidenceCount', { count: value.evidenceRefs.length })}</Button></div>}</div>
}

function VerdictButton({ active, danger, onClick, children }: { active: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn('min-h-9 min-w-14 rounded-[3px] border px-2 font-data text-xs font-bold', active && !danger ? 'border-success bg-success text-white' : active && danger ? 'border-destructive bg-destructive text-white' : 'border-input bg-card text-muted-foreground')}>{children}</button>
}

function Readings({ odometer, setOdometer, fuel, setFuel, isReturn, telematics, telematicsStatus }: { odometer: string; setOdometer: (value: string) => void; fuel: number; setFuel: (value: number) => void; isReturn: boolean; telematics: string | null; telematicsStatus: 'MATCHED' | 'STALE' | 'UNAVAILABLE' }) {
  const { t } = useTranslation()
  const tone = fuel <= 1 ? 'bg-destructive' : fuel <= 3 ? 'bg-warning' : 'bg-success'
  return <section className="rounded-[3px] border border-border bg-card"><div className="flex justify-between border-b border-border px-5 py-4"><h2 className="font-bold">{t('handover.capturePage.odometerFuel')}</h2><StatusChip tone={telematicsStatus === 'MATCHED' ? 'ok' : 'warn'} label={t(`handover.capturePage.telematics.${telematicsStatus}`)} /></div><div className="grid gap-5 p-5 sm:grid-cols-2"><div><label htmlFor="capture-odometer" className="eyebrow">{t(isReturn ? 'handover.endOdometer' : 'handover.startOdometer')}</label><Input id="capture-odometer" className="mt-2" value={odometer} inputMode="numeric" onChange={(event) => setOdometer(event.target.value)} /><p className="mt-2 text-xs text-muted-foreground">{t('handover.capturePage.telematicsReads', { value: telematics ?? '—' })}</p></div><div><p className="eyebrow">{t('handover.capturePage.fuelLevel', { value: EIGHTHS[fuel] })}</p><Slider className="mt-3" min={0} max={8} step={1} value={[fuel]} onValueChange={(value) => setFuel(value[0] ?? 0)} /><div className="mt-3 h-2 bg-surface-2"><div className={cn('h-full', tone)} style={{ width: `${fuel / 8 * 100}%` }} /></div><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>E</span><span>½</span><span>F</span></div></div></div></section>
}

function StripFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div><span className="block text-[11px] uppercase tracking-[.08em] text-brand-foreground/60">{label}</span><strong className={cn('mt-1 block text-lg', mono && 'font-data')}><bdi>{value}</bdi></strong></div> }
function PhotoList({ photos, onRemove, empty }: { photos: CapturedPhoto[]; onRemove: (index: number) => void; empty: string }) { const { t } = useTranslation(); return photos.length ? <div className="flex flex-wrap gap-2">{photos.map((photo, index) => <span key={photo.ref} className="relative size-20 overflow-hidden rounded-[3px] border"><img src={photo.url} alt={t('handover.capturePage.vehiclePhotoAlt', { number: index + 1 })} className="size-full object-cover" /><button type="button" aria-label={t('handover.capturePage.removePhoto', { number: index + 1 })} onClick={() => { URL.revokeObjectURL(photo.url); onRemove(index) }} className="absolute end-0 top-0 bg-destructive p-1 text-white"><X className="size-3" /></button></span>)}</div> : <p className="border border-dashed p-4 text-center text-sm text-muted-foreground">{empty}</p> }
function CaptureError({ message, onRetry }: { message: string; onRetry?: () => void }) { const { t } = useTranslation(); return <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p>{message}</p>{onRetry && <Button className="mt-3" variant="secondary" onClick={onRetry}><RefreshCw />{t('common.retry')}</Button>}</div> }
async function dataUrlToBlob(value: string): Promise<Blob> { return (await fetch(value)).blob() }
async function typedSignatureBlob(value: string): Promise<Blob> { const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 240; const context = canvas.getContext('2d')!; context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#10181f'; context.font = 'italic 54px serif'; context.textAlign = 'center'; context.fillText(value, canvas.width / 2, 140); return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('signature capture failed')), 'image/png')) }
