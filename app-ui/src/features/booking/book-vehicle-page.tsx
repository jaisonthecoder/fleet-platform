import { type FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, CalendarSearch, CarFront, Check, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api-client'
import type { AvailableVehicle, Booking, BookingSearchInput } from './booking.contract'
import {
  BookingDiscoveryView,
  BookingJourneyHeader,
  BookingTabsFrame,
  type BookingSearchForm,
} from './booking-discovery-view'
import {
  useAvailabilityTimeline,
  useAvailableVehicles,
  useBookablePeople,
  useBookingContext,
  useBookingReconciliation,
  useCreateBooking,
  useMyBookings,
  useSignBookingConsent,
  useSubmitBooking,
} from './hooks/use-booking'

interface SelectedVehicle {
  vehicle: AvailableVehicle
  idempotencyKey: string
}

interface ConsentCommandKeys {
  consent: string
  submit: string
}

interface ManagedDraft {
  booking: Booking
  personName: string
}

type ConsentPhase = 'idle' | 'signing' | 'submitting' | 'reconciling' | 'error'

/** Converts a Date to the local datetime-input representation. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/** Creates the initial two-hour Booking search window. */
function initialSearch(): BookingSearchForm {
  const pickup = new Date()
  pickup.setMinutes(0, 0, 0)
  pickup.setHours(pickup.getHours() + 1)
  return {
    destination: '',
    pickup: toLocalInput(pickup),
    returnAt: toLocalInput(new Date(pickup.getTime() + 7_200_000)),
    passengers: '1',
  }
}

/** Maps local form values to the Booking availability contract. */
function toSearchInput(form: BookingSearchForm): BookingSearchInput {
  return {
    pickupAtUtc: new Date(form.pickup).toISOString(),
    returnAtUtc: new Date(form.returnAt).toISOString(),
    seatingCapacity: Number(form.passengers),
  }
}

/** Expands a search into the privacy-safe timeline window. */
function toTimelineInput(search: BookingSearchInput) {
  const start = new Date(search.pickupAtUtc)
  start.setHours(6, 0, 0, 0)
  const end = new Date(start)
  end.setHours(18, 0, 0, 0)
  return { startAtUtc: start.toISOString(), endAtUtc: end.toISOString() }
}

/** Produces a user-facing Vehicle name from governed lookup codes. */
function vehicleLabel(
  vehicle: Pick<AvailableVehicle, 'makeCode' | 'modelCode' | 'bodyTypeCode'>,
): string {
  return (
    [vehicle.makeCode, vehicle.modelCode]
      .filter(Boolean)
      .join(' ')
      .replaceAll('_', ' ') || vehicle.bodyTypeCode.replaceAll('_', ' ')
  )
}

/** Employee Booking entry: discovery, direct selection, consent, and confirmation. */
export function BookVehiclePage() {
  const { t, i18n } = useTranslation()
  const initial = useMemo(initialSearch, [])
  const [form, setForm] = useState<BookingSearchForm>(initial)
  const [submitted, setSubmitted] = useState<BookingSearchInput>(() => toSearchInput(initial))
  const [formError, setFormError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedVehicle | null>(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [consentKeys, setConsentKeys] = useState<ConsentCommandKeys | null>(null)
  const [confirmation, setConfirmation] = useState<Booking | null>(null)
  const [journeyVehicle, setJourneyVehicle] = useState<AvailableVehicle | null>(null)
  const [consentPhase, setConsentPhase] = useState<ConsentPhase>('idle')
  const [consentBooking, setConsentBooking] = useState<Booking | null>(null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [managedDraft, setManagedDraft] = useState<ManagedDraft | null>(null)

  const context = useBookingContext()
  const people = useBookablePeople(context.data?.modes.onBehalf.enabled === true)
  const myBookings = useMyBookings()
  const availability = useAvailableVehicles(submitted)
  const timeline = useAvailabilityTimeline(useMemo(() => toTimelineInput(submitted), [submitted]))
  const createDraft = useCreateBooking()
  const signConsent = useSignBookingConsent()
  const submitBooking = useSubmitBooking()
  const reconcileBooking = useBookingReconciliation()
  const locale = i18n.resolvedLanguage ?? i18n.language

  /** Validates the current trip form and returns its API search projection. */
  function validateSearch(): BookingSearchInput | null {
    const pickup = new Date(form.pickup)
    const returnAt = new Date(form.returnAt)
    if (!form.destination.trim()) {
      setFormError(t('booking.validation.destination'))
      return null
    }
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(returnAt.getTime()) || returnAt <= pickup) {
      setFormError(t('booking.validation.window'))
      return null
    }
    if (pickup <= new Date()) {
      setFormError(t('booking.validation.future'))
      return null
    }
    setFormError(null)
    return toSearchInput(form)
  }

  /** Validates and submits a new availability search. */
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = validateSearch()
    if (!input) return
    setSubmitted(input)
    createDraft.reset()
  }

  /** Creates a governed Draft and transitions directly to the Consent stage. */
  async function selectVehicle(vehicle: AvailableVehicle) {
    createDraft.reset()
    const currentSearch = validateSearch()
    if (!currentSearch) return
    const selection = selected?.vehicle.vehicleId === vehicle.vehicleId
      ? selected
      : { vehicle, idempotencyKey: crypto.randomUUID() }
    setSelected(selection)
    setSubmitted(currentSearch)
    if (!context.data) return
    const bookingPersonId = selectedPersonId ?? context.data.defaults.requestedByPersonId
    try {
      const draft = await createDraft.mutateAsync({
        idempotencyKey: selection.idempotencyKey,
        input: {
          ...currentSearch,
          vehicleId: vehicle.vehicleId,
          requestedByPersonId: bookingPersonId,
          driverPersonId: bookingPersonId,
          destination: form.destination.trim(),
          passengerCount: Number(form.passengers),
        },
      })
      setSelected(null)
      if (bookingPersonId !== context.data.actor.personId) {
        const person = people.data?.find((candidate) => candidate.personId === bookingPersonId)
        setManagedDraft({ booking: draft, personName: person?.fullName ?? bookingPersonId })
        return
      }
      setConsentBooking(draft)
      setJourneyVehicle(vehicle)
      setAgreed(false)
      setSignerName('')
      setConsentKeys({ consent: crypto.randomUUID(), submit: crypto.randomUUID() })
      setConsentPhase('idle')
      setConsentOpen(true)
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 409 &&
        !error.reasons?.includes('booking-vehicle-capacity-insufficient')
      ) {
        await Promise.all([availability.refetch(), timeline.refetch()])
      }
    }
  }

  const consentBusy =
    consentPhase === 'signing' ||
    consentPhase === 'submitting' ||
    consentPhase === 'reconciling'

  /** Signs the server template and submits the persisted Booking with stable keys. */
  async function completeConsent() {
    const draft = consentBooking
    const consent = context.data?.consent
    const signerMatches = signerName.trim().toLocaleLowerCase(locale) === context.data?.actor.fullName.trim().toLocaleLowerCase(locale)
    if (!draft || !consentKeys || !consent?.version || !agreed || !signerMatches) return
    try {
      setConsentPhase('signing')
      const reserved = await signConsent.mutateAsync({
        bookingId: draft.id,
        driverPersonId: draft.driverPersonId,
        consentDocumentVersion: consent.version,
        idempotencyKey: consentKeys.consent,
      })
      setConsentPhase('submitting')
      const result = await submitBooking.mutateAsync({
        bookingId: reserved.id,
        idempotencyKey: consentKeys.submit,
      })
      showConfirmation(result)
    } catch (error) {
      if (error instanceof ApiRequestError && error.reasons?.includes('booking-consent-version-changed')) {
        setAgreed(false)
        setConsentPhase('error')
        await context.refetch()
        return
      }
      if (error instanceof ApiRequestError && error.status >= 500) {
        setConsentPhase('reconciling')
        try {
          const reconciled = await reconcileBooking.mutateAsync(draft.id)
          if (reconciled.bookingNumber && reconciled.workflowInstanceId) {
            showConfirmation(reconciled)
            return
          }
          if (reconciled.bookingNumber && reconciled.consentRecordId) {
            const result = await submitBooking.mutateAsync({
              bookingId: reconciled.id,
              idempotencyKey: consentKeys.submit,
            })
            showConfirmation(result)
            return
          }
        } catch {
          setConsentPhase('error')
          return
        }
      }
      setConsentPhase('error')
    }
  }

  /** Moves the journey to the persisted confirmation stage. */
  function showConfirmation(booking: Booking) {
    setConsentPhase('idle')
    setConfirmation(booking)
    setConsentOpen(false)
    void myBookings.refetch()
  }

  /** Downloads a calendar event for the confirmed Booking. */
  function downloadCalendarEvent() {
    if (!confirmation) return
    const compactUtc = (value: string) =>
      new Date(value).toISOString().replaceAll('-', '').replaceAll(':', '').replace('.000', '')
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wayfinder//Fleet Booking//EN',
      'BEGIN:VEVENT',
      `UID:${confirmation.id}@wayfinder.local`,
      `DTSTART:${compactUtc(confirmation.pickupAtUtc)}`,
      `DTEND:${compactUtc(confirmation.returnAtUtc)}`,
      `SUMMARY:${t('booking.confirmation.calendarSummary', { number: confirmation.bookingNumber })}`,
      `LOCATION:${confirmation.destination ?? ''}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `booking-${confirmation.bookingNumber ?? confirmation.id}.ics`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** Resets transient journey state to start another Booking. */
  function resetJourney() {
    setConfirmation(null)
    setJourneyVehicle(null)
    setConsentOpen(false)
    setAgreed(false)
    setSignerName('')
    setSelected(null)
    setManagedDraft(null)
    createDraft.reset()
    signConsent.reset()
    submitBooking.reset()
    reconcileBooking.reset()
  }

  if (context.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('booking.loadingContext')}</div>
  }
  if (context.isError || (!context.data?.modes.self.enabled && !context.data?.modes.onBehalf.enabled)) {
    return (
      <div className="border border-destructive/30 bg-destructive/5 p-5" role="alert">
        <h1 className="text-lg font-bold">{t('booking.contextErrorTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('booking.contextErrorBody')}</p>
        <Button className="mt-4" variant="secondary" onClick={() => void context.refetch()}>{t('common.retry')}</Button>
      </div>
    )
  }

  const scopeName = context.data.defaults.scopeName ?? t('booking.scopeUnavailable')
  const selectedPerson = people.data?.find((person) => person.personId === selectedPersonId)
  const consentTemplate = context.data.consent
  const consentText = locale.startsWith('ar') ? consentTemplate.content?.ar : consentTemplate.content?.en
  const consentDelimiter = consentTemplate.version?.startsWith('local-dummy-')
    ? /(?:\r?\n|,\s+|،\s*)/
    : /\r?\n/
  const consentStatements = consentText?.split(consentDelimiter).map((statement) => statement.trim()).filter(Boolean) ?? []
  const signerMatches = signerName.trim().toLocaleLowerCase(locale) === context.data.actor.fullName.trim().toLocaleLowerCase(locale)
  const tripRange = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).formatRange(
    new Date(submitted.pickupAtUtc),
    new Date(submitted.returnAtUtc),
  )

  if (managedDraft) {
    return (
      <section className="mx-auto max-w-[640px] border border-border bg-card p-6 text-center" aria-labelledby="managed-draft-title">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success"><Check /></span>
        <h1 id="managed-draft-title" className="mt-4 text-xl font-bold">{t('booking.onBehalf.createdTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('booking.onBehalf.createdBody', { name: managedDraft.personName })}</p>
        <bdi className="mt-3 block font-data text-xs text-muted-foreground">{managedDraft.booking.id}</bdi>
        <Button className="mt-5" variant="secondary" onClick={resetJourney}>{t('booking.confirmation.bookAnother')}</Button>
      </section>
    )
  }

  if (confirmation && journeyVehicle) {
    return (
      <BookingTabsFrame locale={locale} myBookings={myBookings.data ?? []} myBookingsLoading={myBookings.isLoading} myBookingsError={myBookings.isError} onRetryMyBookings={() => void myBookings.refetch()}>
      <div className="space-y-7">
        <BookingJourneyHeader activeStep={3} />
        <section className="mx-auto w-full max-w-[560px] py-2 text-center" aria-labelledby="booking-confirmed-title">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success"><Check className="size-7" /></span>
          <h2 id="booking-confirmed-title" className="mt-4 text-2xl font-bold">{t('booking.confirmation.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('booking.confirmation.description')}</p>
          <div className="mt-5 overflow-hidden rounded-[14px] border border-border bg-card text-start shadow-[var(--shadow-raised)]">
            <div className="bg-brand px-6 py-5 text-brand-foreground">
              <p className="text-[10px] font-bold uppercase tracking-[.1em] text-white/60">{t('booking.confirmation.pass')}</p>
              <bdi className="mt-1 block font-data text-2xl font-bold">{confirmation.bookingNumber ?? confirmation.id}</bdi>
            </div>
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <JourneyFact label={t('booking.vehicle')} value={vehicleLabel(journeyVehicle)} detail={journeyVehicle.plate} />
              <JourneyFact label={t('booking.destination')} value={confirmation.destination ?? t('booking.notAvailable')} />
              <JourneyFact label={t('booking.confirmation.keyCollection')} value={journeyVehicle.locationName ?? scopeName} />
              <JourneyFact label={t('booking.tripWindow')} value={tripRange} />
              <JourneyFact label={t('booking.confirmation.status')} value={t('booking.confirmation.pendingApproval')} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={resetJourney}>{t('booking.confirmation.bookAnother')}</Button>
            <Button onClick={downloadCalendarEvent}><CalendarSearch />{t('booking.confirmation.addCalendar')}</Button>
          </div>
        </section>
      </div>
      </BookingTabsFrame>
    )
  }

  if (consentOpen && journeyVehicle && consentBooking) {
    const pickupTime = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(submitted.pickupAtUtc))
    const returnTime = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(submitted.returnAtUtc))
    return (
      <BookingTabsFrame locale={locale} myBookings={myBookings.data ?? []} myBookingsLoading={myBookings.isLoading} myBookingsError={myBookings.isError} onRetryMyBookings={() => void myBookings.refetch()}>
      <div className="space-y-7">
        <BookingJourneyHeader activeStep={2} />
        <div className="mx-auto w-full max-w-[1120px]">
          <button type="button" onClick={() => setConsentOpen(false)} disabled={consentBusy} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            <ArrowLeft className="size-4 rtl:rotate-180" />{t('booking.consent.backToResults')}
          </button>
        </div>
        <div className="mx-auto grid w-full max-w-[1120px] gap-5 lg:grid-cols-2 lg:items-start">
          <section className="overflow-hidden rounded-[12px] border border-border bg-card p-5 shadow-[var(--shadow-rest)]" aria-labelledby="selected-vehicle-title">
            <div className="flex items-center gap-4 border-b border-border pb-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-brand/10 text-brand"><CarFront /></span>
              <div>
                <h2 id="selected-vehicle-title" className="font-bold">{vehicleLabel(journeyVehicle)}</h2>
                <p className="font-data text-xs text-muted-foreground"><bdi>{journeyVehicle.plate}</bdi> · {journeyVehicle.fuelTypeCode ?? t('booking.notAvailable')} {journeyVehicle.bodyTypeCode.replaceAll('_', ' ')}</p>
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border py-5">
              <div><strong className="block font-data text-xl"><bdi>{pickupTime}</bdi></strong><span className="mt-1 block max-w-36 truncate text-[11px] text-muted-foreground">{scopeName}</span></div>
              <div className="flex min-w-8 items-center" aria-hidden="true"><span className="size-2 shrink-0 rounded-full bg-brand" /><span className="mx-2 h-px flex-1 border-t border-dashed border-[#b9af9b]" /><MapPin className="size-4 shrink-0 text-brand" /></div>
              <div className="text-end"><strong className="block font-data text-xl"><bdi>{returnTime}</bdi></strong><span className="mt-1 block max-w-36 truncate text-[11px] text-muted-foreground">{form.destination}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-5 pt-4">
              <JourneyFact label={t('booking.redesign.date')} value={new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(submitted.pickupAtUtc))} />
              <JourneyFact label={t('booking.passengers')} value={form.passengers} />
            </div>
          </section>
          <section className="rounded-[12px] border border-border bg-card p-5 shadow-[var(--shadow-rest)]" aria-labelledby="digital-consent-title">
            <h2 id="digital-consent-title" className="text-lg font-bold">{t('booking.consent.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('booking.consent.description')}</p>
            {consentTemplate.status !== 'AVAILABLE' || !consentTemplate.version || !consentText ? (
              <output className="mt-5 block border border-warning/30 bg-warning/10 p-4 text-sm">
                <strong className="text-warning">{t('booking.consent.pendingTitle')}</strong>
                <span className="mt-1 block text-muted-foreground">{t('booking.consent.pendingBody')}</span>
              </output>
            ) : (
              <>
                <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                  {consentStatements.map((statement) => <li key={statement} className="flex items-start gap-3"><Check className="mt-0.5 size-4 shrink-0 text-success" /><span>{statement}</span></li>)}
                </ul>
                <label className="mt-5 flex items-start gap-3 rounded-[8px] bg-surface-2 p-4 text-sm font-bold">
                  <Checkbox className="mt-0.5" checked={agreed} disabled={consentBusy} onCheckedChange={(checked) => setAgreed(checked === true)} />
                  <span>{t('booking.consent.agreementVersion', { version: consentTemplate.version })}</span>
                </label>
                <div className="mt-4">
                  <Label htmlFor="booking-signer-name" className="text-xs font-bold">{t('booking.consent.fullNameLabel')}</Label>
                  <Input id="booking-signer-name" value={signerName} disabled={consentBusy} autoComplete="name" onChange={(event) => setSignerName(event.target.value)} placeholder={t('booking.consent.fullNamePlaceholder')} className="mt-2 h-11 bg-surface-2" />
                  {signerName && !signerMatches && <p className="mt-2 text-xs text-destructive" role="alert">{t('booking.consent.fullNameMismatch')}</p>}
                </div>
                <span className="sr-only"><bdi>{consentTemplate.contentHash}</bdi></span>
                {(signConsent.isError || submitBooking.isError || reconcileBooking.isError) && <p className="mt-4 text-sm text-destructive" role="alert">{t('booking.consent.commandError')}</p>}
                {consentBusy && <output className="mt-4 block text-sm text-muted-foreground">{t(`booking.consent.phase.${consentPhase}`)}</output>}
                <Button className="mt-5 h-12 w-full" size="lg" disabled={!agreed || !signerMatches || consentBusy} onClick={() => void completeConsent()}>
                  {consentBusy ? t(`booking.consent.phase.${consentPhase}`) : t('booking.consent.sign')}
                </Button>
              </>
            )}
          </section>
        </div>
      </div>
      </BookingTabsFrame>
    )
  }

  return (
    <div className="space-y-7">
      {context.data.modes.onBehalf.enabled && (
        <section className="border border-border bg-card p-4" aria-labelledby="booking-for-title">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,360px)] sm:items-end">
            <div>
              <h2 id="booking-for-title" className="text-sm font-bold">{t('booking.onBehalf.title')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t('booking.onBehalf.description')}</p>
            </div>
            <div>
              <Label htmlFor="booking-person" className="text-xs font-bold">{t('booking.onBehalf.person')}</Label>
              <select
                id="booking-person"
                className="mt-2 h-10 w-full border border-input bg-background px-3 text-sm"
                value={selectedPersonId ?? context.data.defaults.requestedByPersonId}
                onChange={(event) => setSelectedPersonId(event.target.value)}
              >
                {(people.data ?? []).map((person) => (
                  <option key={person.personId} value={person.personId}>
                    {person.fullName} - {person.employeeId}{person.isSelf ? ` (${t('booking.onBehalf.self')})` : ''}
                  </option>
                ))}
              </select>
              {selectedPerson && !selectedPerson.isSelf && (
                <p className="mt-2 text-xs text-muted-foreground">{t('booking.onBehalf.driverConsent', { name: selectedPerson.fullName })}</p>
              )}
            </div>
          </div>
        </section>
      )}
      <BookingDiscoveryView
        form={form}
        setForm={setForm}
        onSearch={submitSearch}
        formError={formError}
        scopeName={scopeName}
        locale={locale}
        vehicles={availability.data ?? []}
        vehiclesLoading={availability.isLoading || availability.isFetching}
        vehiclesError={availability.isError}
        onRetryVehicles={() => void availability.refetch()}
        onSelectVehicle={selectVehicle}
        myBookings={myBookings.data ?? []}
        myBookingsLoading={myBookings.isLoading}
        myBookingsError={myBookings.isError}
        onRetryMyBookings={() => void myBookings.refetch()}
        onConsentBooking={(booking) => {
          setConsentBooking(booking)
          setJourneyVehicle({
            vehicleId: booking.vehicleId,
            plate: booking.vehicle.plate,
            makeCode: booking.vehicle.makeCode,
            modelCode: booking.vehicle.modelCode,
            bodyTypeCode: booking.vehicle.bodyTypeCode,
            useCategoryCode: 'POOL',
            seatingCapacity: booking.vehicle.seatingCapacity,
            fuelTypeCode: booking.vehicle.fuelTypeCode,
            locationName: booking.scopeName,
          })
          setAgreed(false)
          setSignerName('')
          setConsentKeys({ consent: crypto.randomUUID(), submit: crypto.randomUUID() })
          setConsentPhase('idle')
          setConsentOpen(true)
        }}
      />
      {createDraft.isError && (
        <p className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {createDraft.error instanceof ApiRequestError && createDraft.error.reasons?.includes('booking-vehicle-capacity-insufficient')
            ? t('booking.draftCapacityError', { count: form.passengers })
            : createDraft.error instanceof ApiRequestError && createDraft.error.status === 409
              ? t('booking.draftStaleError')
              : t('booking.draftError')}
        </p>
      )}
    </div>
  )
}

/** Displays one real Booking fact without inventing unsupported mockup data. */
function JourneyFact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-[.06em] text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-sm"><bdi>{value}</bdi></strong>
      {detail && <span className="mt-0.5 block text-xs text-muted-foreground"><bdi>{detail}</bdi></span>}
    </div>
  )
}
