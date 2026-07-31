import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Check, KeyRound, RefreshCw, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Slider } from '@/components/ui/slider'
import { ApiRequestError } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import {
  getHandoverWorklist,
  openHandover,
  returnHandover,
  type Handover,
  type HandoverCaptureInput,
  type HandoverWorkItem,
} from './handover.contract'

const CHECKS = ['body', 'tyres', 'lights', 'assets', 'cabin'] as const

/** Live Fleet custody register, release capture, return reconciliation, and receipt. */
export function HandoverPage() {
  const { t, i18n } = useTranslation()
  const { me } = useAuth()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const worklist = useQuery({ queryKey: ['handover', 'worklist'], queryFn: getHandoverWorklist })
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('bookingId'))
  const [odometer, setOdometer] = useState('')
  const [fuel, setFuel] = useState(8)
  const [keyRef, setKeyRef] = useState('')
  const [signerName, setSignerName] = useState('')
  const [condition, setCondition] = useState('')
  const [damageRegion, setDamageRegion] = useState('')
  const [damageNote, setDamageNote] = useState('')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [validation, setValidation] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Handover | null>(null)
  const commandKeys = useRef({ open: crypto.randomUUID(), return: crypto.randomUUID() })
  const selected = worklist.data?.find((item) => item.bookingId === selectedId) ?? worklist.data?.[0] ?? null
  const isReturn = selected?.phase === 'ActiveCustody'
  const expectedSigner = isReturn ? me?.fullName ?? '' : selected?.driverName ?? ''

  useEffect(() => {
    setOdometer('')
    setFuel(8)
    setKeyRef('')
    setSignerName('')
    setCondition('')
    setDamageRegion('')
    setDamageNote('')
    setChecks({})
    setValidation(null)
    setReceipt(null)
    commandKeys.current = { open: crypto.randomUUID(), return: crypto.randomUUID() }
  }, [selected?.bookingId])

  const command = useMutation({
    mutationFn: ({ item, input }: { item: HandoverWorkItem; input: HandoverCaptureInput }) =>
      item.phase === 'ActiveCustody'
        ? returnHandover(item, input, commandKeys.current.return)
        : openHandover(item, input, commandKeys.current.open),
    onSuccess: async (result) => {
      setReceipt(result)
      await queryClient.invalidateQueries({ queryKey: ['handover', 'worklist'] })
      await queryClient.invalidateQueries({ queryKey: ['booking'] })
    },
  })

  /** Validates the capture and invokes the correct custody command. */
  function submit() {
    if (!selected) return
    const reading = Number(odometer)
    const allChecks = CHECKS.every((check) => checks[check])
    const signerMatches = signerName.trim().toLocaleLowerCase(locale) === expectedSigner.trim().toLocaleLowerCase(locale)
    if (!Number.isFinite(reading) || reading < 0 || !allChecks || !keyRef.trim() || !signerMatches || (isReturn && !condition.trim())) {
      setValidation(t('handover.validation'))
      return
    }
    setValidation(null)
    command.mutate({
      item: selected,
      input: {
        odometer: reading,
        fuelEighths: fuel,
        keyRef: keyRef.trim(),
        signatureRef: `typed-name:${crypto.randomUUID()}`,
        checklist: CHECKS.map((item) => ({ item, pass: true })),
        condition: condition.trim() || undefined,
        damageRegion: damageRegion.trim() || undefined,
        damageNote: damageNote.trim() || undefined,
      },
    })
  }

  if (worklist.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">{t('handover.loading')}</p>
  if (worklist.isError) return (
    <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5">
      <p>{t('handover.loadError')}</p>
      <Button className="mt-3" variant="secondary" onClick={() => void worklist.refetch()}><RefreshCw />{t('common.retry')}</Button>
    </div>
  )

  return (
    <div className="space-y-5 pb-24">
      <PageHeader eyebrow={t('handover.eyebrow')} title={t('handover.title')} description={t('handover.subtitle')} />
      {!worklist.data?.length ? (
        <p className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">{t('handover.empty')}</p>
      ) : (
        <div className="grid min-h-[650px] border border-border bg-card lg:grid-cols-[340px_1fr]">
          <aside className="border-b border-border lg:border-b-0 lg:border-e" aria-label={t('handover.register')}>
            {worklist.data.map((item) => (
              <button key={item.bookingId} type="button" onClick={() => setSelectedId(item.bookingId)} className={`block w-full border-b border-border p-4 text-start ${selected?.bookingId === item.bookingId ? 'bg-brand/5' : 'hover:bg-muted'}`}>
                <div className="flex items-start justify-between gap-2">
                  <strong><bdi>{item.bookingNumber}</bdi></strong>
                  <Badge variant="secondary">{t(`handover.phase.${item.phase}`)}</Badge>
                </div>
                <p className="mt-2 text-sm"><bdi>{item.vehiclePlate}</bdi> · {item.driverName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.pickupAtUtc))}</p>
              </button>
            ))}
          </aside>
          {selected && (
            <section className="min-w-0" aria-label={t('handover.capture')}>
              <header className="border-b border-border bg-brand p-5 text-brand-foreground">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <Fact label={t('handover.booking')} value={selected.bookingNumber} />
                  <Fact label={t('handover.vehicle')} value={selected.vehiclePlate} />
                  <Fact label={t('handover.driver')} value={selected.driverName} />
                  <Fact label={t('handover.scope')} value={selected.scopeName ?? t('booking.notAvailable')} />
                </div>
              </header>
              <div className="grid gap-5 p-5 xl:grid-cols-2">
                <section className="border border-border p-4">
                  <h2 className="font-bold">{t('handover.inspection')}</h2>
                  <div className="mt-3 space-y-2">
                    {CHECKS.map((check) => (
                      <label key={check} className="flex items-center gap-3 border border-border p-3 text-sm">
                        <Checkbox checked={checks[check] ?? false} onCheckedChange={(value) => setChecks((current) => ({ ...current, [check]: value === true }))} />
                        {t(`handover.checks.${check}`)}
                      </label>
                    ))}
                  </div>
                </section>
                <section className="border border-border p-4">
                  <h2 className="font-bold">{t('handover.capture')}</h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="handover-odometer">{t(isReturn ? 'handover.endOdometer' : 'handover.startOdometer')}</Label>
                      <Input id="handover-odometer" className="mt-2" inputMode="numeric" value={odometer} onChange={(event) => setOdometer(event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="handover-key">{t(isReturn ? 'handover.keyReturn' : 'handover.keyIssue')}</Label>
                      <Input id="handover-key" className="mt-2" value={keyRef} onChange={(event) => setKeyRef(event.target.value)} />
                    </div>
                  </div>
                  <Label htmlFor="handover-fuel" className="mt-4 block">{t('handover.fuel', { value: fuel })}</Label>
                  <Slider id="handover-fuel" className="mt-3" min={0} max={8} step={1} value={[fuel]} onValueChange={(value) => setFuel(value[0] ?? 0)} />
                  {isReturn && <div className="mt-4"><Label htmlFor="handover-condition">{t('handover.condition')}</Label><Input id="handover-condition" className="mt-2" value={condition} onChange={(event) => setCondition(event.target.value)} /></div>}
                  <div className="mt-4"><Label htmlFor="handover-damage-region">{t('handover.damageRegion')}</Label><Input id="handover-damage-region" className="mt-2" value={damageRegion} onChange={(event) => setDamageRegion(event.target.value)} /></div>
                  <div className="mt-4"><Label htmlFor="handover-damage-note">{t('handover.damageNote')}</Label><Input id="handover-damage-note" className="mt-2" value={damageNote} onChange={(event) => setDamageNote(event.target.value)} /></div>
                  <div className="mt-4"><Label htmlFor="handover-signer">{t('handover.signer', { name: expectedSigner })}</Label><Input id="handover-signer" className="mt-2" value={signerName} onChange={(event) => setSignerName(event.target.value)} /></div>
                </section>
              </div>
              {validation && <p role="alert" className="mx-5 text-sm text-destructive">{validation}</p>}
              {command.isError && <p role="alert" className="mx-5 text-sm text-destructive">{command.error instanceof ApiRequestError && command.error.status === 409 ? t('handover.stale') : t('handover.actionError')}</p>}
              {receipt && <Receipt value={receipt} />}
              <div className="mt-5 flex justify-end border-t border-border p-4">
                <Button size="lg" disabled={command.isPending} onClick={submit}><KeyRound />{t(isReturn ? 'handover.confirmReturn' : 'handover.confirmOpen')}</Button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/** Displays one operational fact while isolating identifiers in RTL. */
function Fact({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-xs text-brand-foreground/60">{label}</span><strong className="mt-1 block"><bdi>{value}</bdi></strong></div>
}

/** Renders the persisted custody completion receipt and advisory flags. */
function Receipt({ value }: { value: Handover }) {
  const { t } = useTranslation()
  return (
    <section role="status" className="mx-5 border border-success/40 bg-success/5 p-4">
      <div className="flex items-center gap-2 font-bold text-success"><Check className="size-4" />{t(`handover.receipt.${value.phase}`)}</div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <span>{t('handover.receipt.odometer')}: <bdi>{value.endOdometer ?? value.startOdometer}</bdi></span>
        <span>{t('handover.receipt.fuel')}: {value.endFuelEighths ?? value.startFuelEighths}/8</span>
        <span>{t('handover.receipt.damage')}: {value.damage.length}</span>
      </div>
      {(value.fuelDeviationFlagged || value.odometerConflict || value.lateReturn) && <p className="mt-3 flex items-center gap-2 text-sm text-warning"><TriangleAlert className="size-4" />{t('handover.receipt.review')}</p>}
    </section>
  )
}
