import { useMemo, useRef, useState } from 'react'
import { Camera, KeyRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Segmented } from '@/components/ui/segmented'
import { StatusChip } from '@/components/ui/status-chip'
import {
  DamageMarker,
  type DamageMark,
} from '@/components/patterns/damage-marker'
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/patterns/signature-pad'
import { CameraCapture } from '@/components/patterns/camera-capture'
import { useConfirm } from '@/hooks/use-confirm'
import { notify } from '@/hooks/use-toast'

type Verdict = 'pass' | 'fail' | undefined

const CHECKLIST = [
  {
    id: 'body',
    label: 'Body panels & glass',
    sub: 'no new damage vs last return record',
  },
  {
    id: 'tyres',
    label: 'Tyres & spare',
    sub: 'tread visual · pressure warning light off',
  },
  { id: 'lights', label: 'Lights & indicators', sub: 'head, brake, hazard' },
  {
    id: 'assets',
    label: 'On-vehicle assets',
    sub: 'Salik tag · Darb tag · fuel card FC-2291 · first-aid kit',
  },
  {
    id: 'cabin',
    label: 'Cabin condition',
    sub: 'clean · no personal items from previous booking',
  },
]

const EIGHTHS = ['E', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞', 'F']
const CONDITIONS = ['Good', 'Minor wear', 'Damage noted']

const initialMarks: DamageMark[] = [
  {
    id: 'existing-1',
    x: 24,
    y: 22,
    note: 'Scratch · front-left wing',
    photos: [],
    existing: true,
  },
]

/** Fleet-manager Handover & Return: inspection, readings, condition capture, signature. */
export function HandoverPage() {
  const confirm = useConfirm()
  const signatureRef = useRef<SignaturePadHandle>(null)

  const [mode, setMode] = useState<'handover' | 'return'>('handover')
  const [odometer, setOdometer] = useState('48213')
  const [fuel, setFuel] = useState(7)
  const [keyConfirmed, setKeyConfirmed] = useState(false)
  const [checks, setChecks] = useState<Record<string, Verdict>>({
    body: 'pass',
    tyres: 'pass',
  })
  const [marks, setMarks] = useState<DamageMark[]>(initialMarks)
  const [condition, setCondition] = useState<string | null>(null)
  const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [signed, setSigned] = useState(false)

  const isReturn = mode === 'return'
  const decided = CHECKLIST.filter((c) => checks[c.id]).length
  const fuelPct = (fuel / 8) * 100
  const fuelTone = fuel <= 1 ? 'danger' : fuel <= 3 ? 'warn' : 'ok'
  const fuelColor =
    fuelTone === 'danger'
      ? 'bg-destructive'
      : fuelTone === 'warn'
        ? 'bg-warning'
        : 'bg-success'

  const outstanding = useMemo(() => {
    const items: string[] = []
    if (decided < CHECKLIST.length)
      items.push(`${CHECKLIST.length - decided} checks`)
    if (!keyConfirmed) items.push('key')
    if (isReturn && !condition) items.push('condition')
    if (!signed) items.push('signature')
    return items
  }, [decided, keyConfirmed, isReturn, condition, signed])

  const canSubmit = outstanding.length === 0

  const setVerdict = (id: string, verdict: Verdict) =>
    setChecks((prev) => ({ ...prev, [id]: verdict }))

  const submit = async () => {
    if (!canSubmit) return
    const ok = await confirm({
      title: isReturn ? 'Confirm return?' : 'Hand over keys?',
      description: isReturn
        ? 'Reconciliation will be logged against this booking.'
        : 'The buffer starts on confirm and the trip becomes active.',
      confirmLabel: isReturn ? 'Confirm return' : 'Hand over',
    })
    if (!ok) return
    notify.ok(
      isReturn
        ? 'Return recorded — reconciliation logged'
        : 'Handover recorded — trip active',
    )
    setKeyConfirmed(false)
    setSigned(false)
    signatureRef.current?.clear()
    setChecks({})
    setCondition(null)
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Header row: title + Handover/Return toggle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">Fleet Manager · GS Pool</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Handover &amp; return
          </h1>
        </div>
        <Segmented
          aria-label="Handover or return"
          options={[
            { value: 'handover', label: 'Handover' },
            { value: 'return', label: 'Return' },
          ]}
          value={mode}
          onValueChange={(v) => setMode(v as 'handover' | 'return')}
        />
      </div>

      {/* Navy vehicle / booking strip */}
      <div className="rounded-[3px] bg-brand px-5 py-4 text-brand-foreground">
        <div className="flex flex-wrap items-center gap-x-9 gap-y-3">
          <StripFact label="Booking" value="BK-1204" mono />
          <StripFact label="Vehicle" value="Nissan Patrol · AD 88914" />
          <StripFact label="Driver" value="Amina Khoury" />
          <span className="ms-auto inline-flex items-center gap-2 rounded-[3px] border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-semibold">
            <span className="size-2 rounded-full bg-[#7fd39c]" />
            GPS ONLINE
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8fa9b8]">
          <span className="text-[#7fd39c]">✓</span>
          Eligibility gate passed · No blocks · Consent v3.2 signed 08:12
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT — checklist, readings, key */}
        <div className="space-y-4">
          <section className="rounded-[3px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-bold">Walkaround inspection</h2>
              <span className="eyebrow">
                {decided} of {CHECKLIST.length}
              </span>
            </div>
            <div className="space-y-2.5 p-5">
              {CHECKLIST.map((item) => {
                const verdict = checks[item.id]
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-[3px] border p-3',
                      verdict === 'pass' && 'border-success/40 bg-success/10',
                      verdict === 'fail' &&
                        'border-destructive/40 bg-destructive/10',
                      !verdict && 'border-border',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {item.sub}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <VerdictButton
                        active={verdict === 'pass'}
                        tone="pass"
                        onClick={() => setVerdict(item.id, 'pass')}
                      >
                        PASS
                      </VerdictButton>
                      <VerdictButton
                        active={verdict === 'fail'}
                        tone="fail"
                        onClick={() => setVerdict(item.id, 'fail')}
                      >
                        FAIL
                      </VerdictButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-[3px] border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-bold">Odometer &amp; fuel</h2>
              <StatusChip tone="ok" label="Telematics matched" />
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <label htmlFor="odo" className="eyebrow mb-2 block">
                  {isReturn ? 'Ending odometer' : 'Starting odometer'}
                </label>
                <div className="flex">
                  <Input
                    id="odo"
                    inputMode="numeric"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    className="h-12 rounded-e-none font-data text-lg"
                  />
                  <span className="grid place-items-center rounded-e-[3px] border border-s-0 border-input bg-surface-2 px-3 text-sm font-semibold text-muted-foreground">
                    km
                  </span>
                </div>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Telematics reads{' '}
                  <span className="font-data font-semibold text-brand">
                    48,213 km
                  </span>{' '}
                  · manual entry within tolerance
                </p>
              </div>
              <div>
                <label htmlFor="fuel" className="eyebrow mb-2 block">
                  Fuel level — {EIGHTHS[fuel]}
                </label>
                <Slider
                  id="fuel"
                  min={0}
                  max={8}
                  step={1}
                  value={[fuel]}
                  onValueChange={(v) => setFuel(v[0])}
                  aria-label="Fuel level"
                />
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn('h-full rounded-full', fuelColor)}
                    style={{ width: `${fuelPct}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between font-data text-[11px] text-muted-foreground">
                  <span>E</span>
                  <span>½</span>
                  <span>F · est. 68 L</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[3px] border border-border bg-card p-5">
            <div className="eyebrow mb-3">Key</div>
            <Button
              variant={keyConfirmed ? 'default' : 'secondary'}
              onClick={() => setKeyConfirmed((v) => !v)}
              className={cn(keyConfirmed && 'bg-success hover:bg-success/90')}
            >
              <KeyRound className="size-4" />
              {keyConfirmed
                ? `${isReturn ? 'Return' : 'Issue'} confirmed`
                : `Confirm key ${isReturn ? 'return' : 'issue'}`}
            </Button>

            {isReturn ? (
              <div className="mt-5">
                <div className="eyebrow mb-2">Condition on return</div>
                <Segmented
                  aria-label="Condition on return"
                  options={CONDITIONS.map((c) => ({ value: c, label: c }))}
                  value={condition ?? ''}
                  onValueChange={setCondition}
                />
                {Math.abs(fuel - 5) / 8 > 0.2 ? (
                  <div className="mt-3 flex items-center gap-2 rounded-[3px] border border-warning/40 bg-warning/10 px-3 py-2 text-[13px] text-warning">
                    <span className="size-2 rounded-full bg-warning" />
                    Fuel deviation exceeds ±20% — flagged for review, not
                    blocking.
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        {/* RIGHT — condition capture, vehicle photos, signature */}
        <div className="space-y-4">
          <section className="rounded-[3px] border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-bold">Condition capture</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Tap the diagram to pin any damage; attach a photo as evidence.
              </p>
            </div>
            <div className="p-5">
              <DamageMarker marks={marks} onChange={setMarks} />
            </div>
          </section>

          <section className="rounded-[3px] border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="eyebrow">
                Vehicle photos — {isReturn ? 'return' : 'handover'}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="size-4" />
                Capture
              </Button>
            </div>
            {vehiclePhotos.length === 0 ? (
              <p className="rounded-[3px] border border-dashed border-border bg-surface-2 px-3 py-4 text-center text-sm text-muted-foreground">
                No photos yet — capture the vehicle from the device camera.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {vehiclePhotos.map((photo, i) => (
                  <span
                    key={i}
                    className="relative size-20 overflow-hidden rounded-[3px] border border-border"
                  >
                    <img
                      src={photo}
                      alt={`Vehicle ${isReturn ? 'return' : 'handover'} ${i + 1}`}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove vehicle photo ${i + 1}`}
                      onClick={() =>
                        setVehiclePhotos((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      className="absolute end-0 top-0 grid size-5 place-items-center bg-destructive text-destructive-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[3px] border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="eyebrow">
                Signature — {isReturn ? 'Fleet Manager' : 'Amina Khoury'}
              </div>
              <button
                type="button"
                onClick={() => signatureRef.current?.clear()}
                className="text-[13px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <SignaturePad
              ref={signatureRef}
              signerName={isReturn ? 'Fleet Manager' : 'Amina Khoury'}
              onSignedChange={setSigned}
            />
            <p className="mt-1.5 text-[13px] font-semibold text-muted-foreground">
              {signed ? (
                <span className="text-success">
                  Signed — stored with timestamp + device ID
                </span>
              ) : (
                'Sign above to continue'
              )}
            </p>
            <div className="mt-3 rounded-[3px] bg-brand-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-brand">
              ✓ Booking consent v3.2 already on file (08:12, iOS) — this
              signature covers{' '}
              <b>condition acceptance at {isReturn ? 'return' : 'handover'}</b>{' '}
              only.
            </div>
          </section>
        </div>
      </div>

      {/* Readiness action bar */}
      <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:-mx-[34px] md:px-[34px]">
        <div className="mx-auto flex w-full items-center gap-4">
          <span className="text-[13px] font-semibold text-muted-foreground">
            {canSubmit ? (
              <span>
                <span className="text-foreground">Ready.</span> Keys →{' '}
                {isReturn ? 'pool' : 'Amina'} · buffer starts on confirm
              </span>
            ) : (
              <span>
                <span className="text-foreground">
                  {outstanding.length} item{outstanding.length > 1 ? 's' : ''}{' '}
                  left:
                </span>{' '}
                {outstanding.join(' · ')}
              </span>
            )}
          </span>
          <Button
            className="ms-auto"
            size="lg"
            disabled={!canSubmit}
            onClick={submit}
          >
            {isReturn ? 'Confirm return' : 'Hand over keys'}
          </Button>
        </div>
      </div>

      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(dataUrl) => setVehiclePhotos((prev) => [...prev, dataUrl])}
        title="Photograph the vehicle"
        description={`Capture the vehicle at ${isReturn ? 'return' : 'handover'}.`}
      />
    </div>
  )
}

function StripFact({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8fa9b8]">
        {label}
      </div>
      <div
        className={cn('mt-1 text-[19px] font-semibold', mono && 'font-data')}
      >
        {value}
      </div>
    </div>
  )
}

function VerdictButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: 'pass' | 'fail'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-9 min-w-[52px] rounded-[3px] border font-data text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        !active &&
          'border-input bg-card text-muted-foreground hover:bg-surface-hover',
        active && tone === 'pass' && 'border-success bg-success text-white',
        active &&
          tone === 'fail' &&
          'border-destructive bg-destructive text-white',
      )}
    >
      {children}
    </button>
  )
}
