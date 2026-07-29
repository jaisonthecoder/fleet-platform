import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeftRight,
  CarFront,
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api-client'
import { Segmented } from '@/components/ui/segmented'
import { Drawer } from '@/components/patterns/drawer'
import { StatusChip } from '@/components/ui/status-chip'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AvailableVehicle, MyBooking } from './booking.contract'
import {
  useBookingEvents,
  useCancelBooking,
  useExtendBooking,
  useModifyBooking,
} from './hooks/use-booking'

export interface BookingSearchForm {
  destination: string
  pickup: string
  returnAt: string
  passengers: string
}

interface BookingDiscoveryViewProps {
  form: BookingSearchForm
  setForm: Dispatch<SetStateAction<BookingSearchForm>>
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  formError: string | null
  scopeName: string
  locale: string
  vehicles: AvailableVehicle[]
  vehiclesLoading: boolean
  vehiclesError: boolean
  onRetryVehicles: () => void
  onSelectVehicle: (vehicle: AvailableVehicle) => void
  myBookings: MyBooking[]
  myBookingsLoading: boolean
  myBookingsError: boolean
  onRetryMyBookings: () => void
  onConsentBooking: (booking: MyBooking) => void
}

interface BookingJourneyHeaderProps {
  activeStep: 0 | 1 | 2 | 3
}

interface BookingTabsFrameProps {
  children: ReactNode
  locale: string
  myBookings: MyBooking[]
  myBookingsLoading: boolean
  myBookingsError: boolean
  onRetryMyBookings: () => void
  onConsentBooking?: (booking: MyBooking) => void
}

interface MyBookingsPanelProps {
  locale: string
  myBookings: MyBooking[]
  myBookingsLoading: boolean
  myBookingsError: boolean
  onRetryMyBookings: () => void
  onOpen: (booking: MyBooking) => void
}

const vehicleName = (
  vehicle: Pick<AvailableVehicle, 'makeCode' | 'modelCode' | 'bodyTypeCode'>,
) =>
  [vehicle.makeCode, vehicle.modelCode]
    .filter(Boolean)
    .join(' ')
    .replaceAll('_', ' ') || vehicle.bodyTypeCode.replaceAll('_', ' ')

/** Mockup-aligned booking search/results plus persistent owner Booking details. */
export function BookingDiscoveryView(props: BookingDiscoveryViewProps) {
  const { t } = useTranslation()
  const [bodyType, setBodyType] = useState<string | null>(null)
  const [fuel, setFuel] = useState<string | null>(null)
  const [sort, setSort] = useState('plate')
  const bodyOptions = useMemo(
    () => [...new Set(props.vehicles.map((v) => v.bodyTypeCode))].sort(),
    [props.vehicles],
  )
  const fuelOptions = useMemo(
    () =>
      [
        ...new Set(
          props.vehicles
            .map((v) => v.fuelTypeCode)
            .filter((v): v is string => Boolean(v)),
        ),
      ].sort(),
    [props.vehicles],
  )
  const visibleVehicles = useMemo(
    () =>
      props.vehicles
        .filter(
          (vehicle) =>
            bodyType === null || bodyType === vehicle.bodyTypeCode,
        )
        .filter(
          (vehicle) =>
            fuel === null || vehicle.fuelTypeCode === fuel,
        )
        .toSorted((a, b) =>
          sort === 'seats'
            ? (b.seatingCapacity ?? 0) - (a.seatingCapacity ?? 0)
            : sort === 'fuel'
              ? (a.fuelTypeCode ?? '').localeCompare(b.fuelTypeCode ?? '')
              : sort === 'name'
                ? vehicleName(a).localeCompare(vehicleName(b))
                : a.plate.localeCompare(b.plate),
        ),
    [props.vehicles, bodyType, fuel, sort],
  )
  const bodyCounts = useMemo(
    () => new Map(bodyOptions.map((option) => [option, props.vehicles.filter((vehicle) => vehicle.bodyTypeCode === option).length])),
    [bodyOptions, props.vehicles],
  )

  const updateTripDate = (date: string) => {
    if (!date) return
    props.setForm((current) => ({
      ...current,
      pickup: `${date}T${current.pickup.slice(11)}`,
      returnAt: `${date}T${current.returnAt.slice(11)}`,
    }))
  }

  const updateTripTime = (field: 'pickup' | 'returnAt', time: string) => {
    props.setForm((current) => ({ ...current, [field]: `${current[field].slice(0, 10)}T${time}` }))
  }

  const adjustPassengers = (delta: number) => {
    props.setForm((current) => ({
      ...current,
      passengers: String(Math.min(7, Math.max(1, Number(current.passengers) + delta))),
    }))
  }

  return (
    <BookingTabsFrame
      locale={props.locale}
      myBookings={props.myBookings}
      myBookingsLoading={props.myBookingsLoading}
      myBookingsError={props.myBookingsError}
      onRetryMyBookings={props.onRetryMyBookings}
      onConsentBooking={props.onConsentBooking}
    >
      <div className="space-y-5">
          <BookingJourneyHeader activeStep={0} />
          <form
            onSubmit={props.onSearch}
            className="relative overflow-hidden rounded-[18px] bg-brand text-brand-foreground shadow-[0_14px_30px_rgba(11,61,92,.18)]"
          >
            <div className="flex flex-col gap-3 px-5 pb-4 pt-5 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                aria-label={t('booking.redesign.tripType')}
                value="oneway"
                onValueChange={() => undefined}
                className="w-full max-w-[350px] rounded-[12px] border border-white/15 bg-white/10 p-1 [&_[role=tab]]:h-11 [&_[role=tab]]:flex-1 [&_[role=tab]]:rounded-[9px] [&_[role=tab]]:px-4 [&_[role=tab]]:text-white/65 [&_[aria-selected=true]]:!bg-white [&_[aria-selected=true]]:!text-brand"
                options={[
                  { value: 'return', label: t('booking.redesign.returnToYard'), disabled: true },
                  { value: 'oneway', label: t('booking.redesign.oneWayDrop') },
                ]}
              />
              <p className="text-xs font-semibold text-white/65">
                {t('booking.redesign.poolRule')}
              </p>
            </div>
            <div className="mx-5 mb-5 grid overflow-visible rounded-[14px] border border-white/25 bg-black/5 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.35fr_.8fr_.75fr_.75fr_.8fr_auto]">
              <TripFact label={t('booking.redesign.fromPool')} className="relative border-white/20 xl:border-e" value={props.scopeName}>
                <span aria-hidden="true" className="absolute -end-[18px] top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-signal text-brand shadow-sm xl:grid"><ArrowLeftRight className="size-4" /></span>
              </TripFact>
              <div className="flex min-h-[64px] min-w-0 flex-col justify-center border-t border-white/20 px-4 sm:border-s sm:border-t-0 xl:border-s-0 xl:border-e">
                <Label htmlFor="bk-destination" className="text-[10px] font-bold uppercase tracking-[.08em] text-white/55">{t('booking.redesign.toDestination')}</Label>
                <Input id="bk-destination" aria-label={t('booking.destination')} value={props.form.destination} onChange={(event) => props.setForm((current) => ({ ...current, destination: event.target.value }))} placeholder={t('booking.redesign.destinationPlaceholder')} className="mt-1 h-5 rounded-none border-0 bg-transparent p-0 text-[13px] font-bold leading-5 text-white shadow-none placeholder:text-white/40 focus-visible:ring-0 [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#0b496b_inset] [&:-webkit-autofill:hover]:[-webkit-text-fill-color:white] [&:-webkit-autofill:focus]:[-webkit-text-fill-color:white]" />
              </div>
              <div className="flex min-h-[64px] flex-col justify-center border-t border-white/20 px-4 sm:border-e xl:border-t-0">
                <Label htmlFor="bk-date" className="text-[10px] font-bold uppercase tracking-[.08em] text-white/55">{t('booking.redesign.date')}</Label>
                <Input id="bk-date" type="date" value={props.form.pickup.slice(0, 10)} onChange={(event) => updateTripDate(event.target.value)} className="mt-1 h-6 border-0 bg-transparent p-0 font-data text-[13px] font-bold text-white [color-scheme:dark] focus-visible:ring-0" />
              </div>
              <div className="flex min-h-[64px] flex-col justify-center border-t border-white/20 px-4 sm:border-e xl:border-t-0">
                <Label htmlFor="bk-pickup" className="text-[10px] font-bold uppercase tracking-[.08em] text-white/55">{t('booking.pickup')}</Label>
                <Input id="bk-pickup" type="time" value={props.form.pickup.slice(11)} onChange={(event) => updateTripTime('pickup', event.target.value)} className="mt-1 h-6 border-0 bg-transparent p-0 font-data text-[13px] font-bold text-white [color-scheme:dark] focus-visible:ring-0" />
              </div>
              <div className="flex min-h-[64px] flex-col justify-center border-t border-white/20 px-4 sm:border-e xl:border-t-0">
                <Label htmlFor="bk-return" className="text-[10px] font-bold uppercase tracking-[.08em] text-white/55">{t('booking.return')}</Label>
                <Input id="bk-return" type="time" value={props.form.returnAt.slice(11)} onChange={(event) => updateTripTime('returnAt', event.target.value)} className="mt-1 h-6 border-0 bg-transparent p-0 font-data text-[13px] font-bold text-white [color-scheme:dark] focus-visible:ring-0" />
              </div>
              <div className="flex min-h-[64px] flex-col justify-center border-t border-white/20 px-4 sm:border-e xl:border-t-0">
                <Label className="text-[10px] font-bold uppercase tracking-[.08em] text-white/55">{t('booking.passengers')}</Label>
                <div className="mt-1 flex h-6 items-center gap-2"><button type="button" aria-label={t('booking.redesign.removePassenger')} onClick={() => adjustPassengers(-1)} className="grid size-5 place-items-center rounded-[4px] border border-white/30 text-white"><Minus className="size-3" /></button><strong className="min-w-4 text-center font-data text-[13px]">{props.form.passengers}</strong><button type="button" aria-label={t('booking.redesign.addPassenger')} onClick={() => adjustPassengers(1)} className="grid size-5 place-items-center rounded-[4px] border border-white/30 text-white"><Plus className="size-3" /></button></div>
              </div>
              <Button type="submit" variant="signal" disabled={props.vehiclesLoading} className="h-[64px] min-h-[64px] rounded-none rounded-e-[13px] px-5 text-[13px]"><Search />{t('booking.search')}</Button>
            </div>
            {props.formError && (
              <p role="alert" className="px-5 pb-4 text-sm text-red-200">
                {props.formError}
              </p>
            )}
          </form>

          <div className="flex flex-wrap gap-3">
            <SummaryBadge tone="ok" title={t('booking.redesign.availabilityLive')} detail={t('booking.redesign.availabilityLiveDetail')} />
            <SummaryBadge tone="ok" title={t('booking.redesign.consentProtected')} detail={t('booking.redesign.consentProtectedDetail')} />
            <SummaryBadge tone="info" title={t('booking.redesign.bookingCount', { count: props.myBookings.length })} detail={t('booking.redesign.bookingCountDetail')} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="h-fit rounded-[12px] border border-border bg-card p-4 shadow-[var(--shadow-rest)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">{t('booking.redesign.filters')}</h2>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand"
                  onClick={() => {
                    setBodyType(null)
                    setFuel(null)
                  }}
                >
                  {t('booking.redesign.clear')}
                </button>
              </div>
              <div className="mt-5 rounded-[10px] border border-border p-3"><div className="flex items-center gap-3"><Switch disabled aria-label={t('booking.redesign.hideReadyLater')} /><span className="text-xs text-muted-foreground">{t('booking.redesign.hideReadyLater')}</span></div></div>
              <fieldset className="mt-5"><legend className="mb-2 text-[11px] font-bold uppercase tracking-[.06em] text-muted-foreground">{t('booking.redesign.vehicleClass')}</legend><div className="space-y-1"><FilterRow label={t('booking.redesign.allClasses')} count={props.vehicles.length} active={bodyType === null} onClick={() => setBodyType(null)} />{bodyOptions.map((option) => <FilterRow key={option} label={option.replaceAll('_', ' ')} count={bodyCounts.get(option) ?? 0} active={bodyType === option} onClick={() => setBodyType(option)} />)}</div></fieldset>
              <fieldset className="mt-6"><legend className="mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-muted-foreground">{t('booking.redesign.fuel')}</legend><div className="flex flex-wrap gap-2"><FilterPill label={t('booking.redesign.anyFuel')} active={fuel === null} onClick={() => setFuel(null)} />{fuelOptions.map((option) => <FilterPill key={option} label={option.replaceAll('_', ' ')} active={fuel === option} onClick={() => setFuel(option)} />)}</div></fieldset>
            </aside>
            <section aria-labelledby="vehicle-results-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="vehicle-results-title" className="text-sm font-bold">
                    {t('booking.redesign.results')}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('booking.matching', { count: visibleVehicles.length })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">{t('booking.redesign.sort')}</span>{[['plate','sortPlate'],['seats','sortSeats'],['fuel','sortFuel'],['name','sortName']].map(([value,key]) => <button key={value} type="button" onClick={() => setSort(value)} className={`rounded-[8px] px-3 py-1.5 text-[11px] font-bold transition-colors ${sort === value ? 'bg-brand text-brand-foreground' : 'bg-surface-2 text-muted-foreground hover:text-foreground'}`}>{t(`booking.redesign.${key}`)}</button>)}</div>
              </div>
              {props.vehiclesLoading && (
                <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  {t('booking.loadingVehicles')}
                </p>
              )}
              {props.vehiclesError && (
                <div
                  role="alert"
                  className="border border-destructive/30 bg-destructive/5 p-4"
                >
                  <p>{t('booking.vehicleError')}</p>
                  <Button
                    className="mt-2"
                    variant="secondary"
                    onClick={props.onRetryVehicles}
                  >
                    {t('common.retry')}
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {visibleVehicles.map((vehicle) => (
                  <article
                    key={vehicle.vehicleId}
                    className="relative grid min-h-[76px] gap-3 rounded-[12px] border border-border bg-card px-4 py-3 shadow-[var(--shadow-rest)] sm:grid-cols-[44px_minmax(200px,.9fr)_minmax(170px,1fr)_auto] sm:items-center"
                  >
                    <div className="grid size-11 place-items-center rounded-[10px] bg-brand/10 text-brand">
                      <CarFront className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13px] font-bold">{vehicleName(vehicle)}</h3>
                      </div>
                      <p className="mt-1 font-data text-xs text-muted-foreground"><bdi>{vehicle.plate}</bdi> · {vehicle.fuelTypeCode ?? t('booking.notAvailable')} {vehicle.bodyTypeCode.replaceAll('_',' ')}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {t('booking.seats', {
                            count: vehicle.seatingCapacity ?? 0,
                          })}
                        </span>
                        <span className="rounded-[4px] bg-surface-2 px-2 py-1">{vehicle.fuelTypeCode ?? t('booking.notAvailable')}</span>
                        <span className="rounded-[4px] bg-surface-2 px-2 py-1">{t('booking.redesign.poolVehicle')}</span>
                      </div>
                    </div>
                    <div className="min-w-0 border-t border-border pt-3 sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0"><span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success"><Check className="me-1 size-3.5" />{t('booking.redesign.availableNow')}</span><p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" />{vehicle.locationName ?? t('booking.notAvailable')}</p></div>
                    <Button
                      type="button"
                      className="h-9 min-w-[84px] rounded-[10px] text-[13px]"
                      onClick={() => props.onSelectVehicle(vehicle)}
                    >
                      {t('booking.redesign.select')}
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          </div>
      </div>
    </BookingTabsFrame>
  )
}

/** Hosts every Booking journey stage and My Bookings under one tab header. */
export function BookingTabsFrame({
  children,
  locale,
  myBookings,
  myBookingsLoading,
  myBookingsError,
  onRetryMyBookings,
  onConsentBooking,
}: BookingTabsFrameProps) {
  const { t } = useTranslation()
  const [selectedBooking, setSelectedBooking] = useState<MyBooking | null>(null)
  return (
    <>
      <Tabs defaultValue="search">
        <TabsList className="justify-end gap-1 border-b border-border px-4 sm:px-6">
          <TabsTrigger value="search">{t('booking.redesign.searchTab')}</TabsTrigger>
          <TabsTrigger value="mine">{t('booking.redesign.myBookingsTab', { count: myBookings.length })}</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="pt-5">{children}</TabsContent>
        <TabsContent value="mine" className="pt-5">
          <MyBookingsPanel
            locale={locale}
            myBookings={myBookings}
            myBookingsLoading={myBookingsLoading}
            myBookingsError={myBookingsError}
            onRetryMyBookings={onRetryMyBookings}
            onOpen={setSelectedBooking}
          />
        </TabsContent>
      </Tabs>
      <Drawer
        open={selectedBooking !== null}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
        title={t('booking.redesign.details')}
        description={selectedBooking?.bookingNumber ?? selectedBooking?.id}
        width="md"
        closeLabel={t('common.close')}
      >
          {selectedBooking && (
            <BookingDetail
              booking={selectedBooking}
              locale={locale}
              onConsent={() => {
                onConsentBooking?.(selectedBooking)
                setSelectedBooking(null)
              }}
              onChanged={() => {
                setSelectedBooking(null)
                onRetryMyBookings()
              }}
            />
          )}
      </Drawer>
    </>
  )
}

/** Renders state-aware progress guidance inside the active Booking tab. */
export function BookingJourneyHeader({
  activeStep,
}: BookingJourneyHeaderProps) {
  const { t } = useTranslation()
  return (
      <ol className="grid w-full grid-cols-4 items-start py-1 sm:flex sm:items-center" aria-label={t('booking.redesign.progress')}>
        {['search', 'choose', 'consent', 'confirmed'].map((step, index) => {
          const completed = index < activeStep
          const active = index === activeStep
          return (
            <li key={step} className={`relative flex min-w-0 flex-col items-center sm:flex-row ${index < 3 ? 'sm:flex-1' : 'sm:shrink-0'}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full font-data text-sm font-bold ${completed ? 'bg-success text-white' : active ? 'bg-brand text-brand-foreground' : 'bg-[#ebe8df] text-[#8b96a8]'}`}>
                {completed ? <Check className="size-4" /> : index + 1}
              </span>
              <span className={`mt-2 px-1 text-center text-[9px] font-bold leading-tight sm:ms-3 sm:mt-0 sm:whitespace-nowrap sm:px-0 sm:text-sm ${active || completed ? 'text-foreground' : 'text-[#8b96a8]'}`}>
                {t(`booking.redesign.steps.${step}`)}
              </span>
              {index < 3 && <span aria-hidden="true" className={`absolute start-[calc(50%+20px)] top-4 h-px w-[calc(100%-40px)] sm:static sm:mx-4 sm:min-w-3 sm:flex-1 ${completed ? 'bg-success' : 'bg-[#d8d1c2]'}`} />}
            </li>
          )
        })}
      </ol>
  )
}

function TripFact({
  label,
  value,
  className = '',
  children,
}: {
  label: string
  value: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={`flex min-h-[64px] min-w-0 flex-col justify-center px-4 ${className}`}>
      <span className="block text-[10px] font-bold uppercase tracking-[.08em] text-white/55">
        {label}
      </span>
      <span className="mt-1 block truncate text-[13px] font-bold text-white">
        {value}
      </span>
      {children}
    </div>
  )
}

function SummaryBadge({
  tone,
  title,
  detail,
}: {
  tone: 'ok' | 'info'
  title: string
  detail: string
}) {
  return (
    <div className="flex min-w-52 items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3">
      <span className={`grid size-6 place-items-center rounded-full ${tone === 'ok' ? 'bg-success/10 text-success' : 'bg-info/10 text-info'}`}>
        <Check className="size-3.5" />
      </span>
      <span><strong className="block text-xs">{title}</strong><span className="block text-[11px] text-muted-foreground">{detail}</span></span>
    </div>
  )
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" aria-label={`${label} ${count}`} aria-pressed={active} onClick={onClick} className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-start text-[13px] font-semibold ${active ? 'bg-brand text-brand-foreground' : 'text-foreground hover:bg-surface-2'}`}>
      <span>{label}</span><span className={`font-data text-xs ${active ? 'text-white/70' : 'text-muted-foreground'}`}>{count}</span>
    </button>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${active ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground'}`}>
      {label}
    </button>
  )
}

function MyBookingsPanel(props: MyBookingsPanelProps) {
  const { t } = useTranslation()
  if (props.myBookingsLoading)
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t('booking.redesign.loadingMine')}
      </p>
    )
  if (props.myBookingsError)
    return (
      <div role="alert" className="border border-destructive/30 p-4">
        <p>{t('booking.redesign.mineError')}</p>
        <Button
          className="mt-2"
          variant="secondary"
          onClick={props.onRetryMyBookings}
        >
          {t('common.retry')}
        </Button>
      </div>
    )
  if (props.myBookings.length === 0)
    return (
      <p className="border border-border bg-card p-10 text-center text-muted-foreground">
        {t('booking.redesign.mineEmpty')}
      </p>
    )
  const groups = {
    upcoming: props.myBookings.filter((booking) => ['Draft', 'PendingApproval', 'Approved'].includes(booking.status)),
    active: props.myBookings.filter((booking) => booking.status === 'Active'),
    past: props.myBookings.filter((booking) => ['Completed', 'Declined', 'Cancelled', 'Expired', 'NoShow'].includes(booking.status)),
  }
  const rows = (bookings: MyBooking[]) => bookings.length === 0 ? (
    <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t('booking.redesign.groupEmpty')}</p>
  ) : (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <button
          key={booking.id}
          type="button"
          onClick={() => props.onOpen(booking)}
          className="grid w-full gap-3 rounded-[6px] border border-border bg-card p-4 text-start shadow-[var(--shadow-rest)] sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div>
            <div className="flex flex-wrap gap-2">
              <strong>
                {[booking.vehicle.makeCode, booking.vehicle.modelCode]
                  .filter(Boolean)
                  .join(' ')
                  .replaceAll('_', ' ') || booking.vehicle.bodyTypeCode}
              </strong>
              <bdi className="font-data text-xs">{booking.vehicle.plate}</bdi>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat(props.locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).formatRange(
                new Date(booking.pickupAtUtc),
                new Date(booking.returnAtUtc),
              )}
            </p>
          </div>
          <StatusChip
            tone={
              booking.status === 'Approved' || booking.status === 'Active'
                ? 'ok'
                : booking.status === 'Declined' || booking.status === 'Cancelled'
                  ? 'danger'
                  : 'warn'
            }
            label={t(`booking.status.${booking.status}`)}
          />
        </button>
      ))}
    </div>
  )
  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">{t('booking.redesign.upcomingTab', { count: groups.upcoming.length })}</TabsTrigger>
        <TabsTrigger value="active">{t('booking.redesign.activeTab', { count: groups.active.length })}</TabsTrigger>
        <TabsTrigger value="past">{t('booking.redesign.pastTab', { count: groups.past.length })}</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming" className="pt-4">{rows(groups.upcoming)}</TabsContent>
      <TabsContent value="active" className="pt-4">{rows(groups.active)}</TabsContent>
      <TabsContent value="past" className="pt-4">{rows(groups.past)}</TabsContent>
    </Tabs>
  )
}

function BookingDetail({
  booking,
  locale,
  onConsent,
  onChanged,
}: {
  booking: MyBooking
  locale: string
  onConsent: () => void
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const events = useBookingEvents(booking.id)
  const modify = useModifyBooking()
  const extend = useExtendBooking()
  const cancel = useCancelBooking()
  const [modifyPickup, setModifyPickup] = useState(toLocalDateTime(booking.pickupAtUtc))
  const [modifyReturn, setModifyReturn] = useState(toLocalDateTime(booking.returnAtUtc))
  const [extensionReturn, setExtensionReturn] = useState(toLocalDateTime(booking.returnAtUtc))
  const [cancelReason, setCancelReason] = useState('')
  const [validation, setValidation] = useState<string | null>(null)
  const commandKeys = useRef({
    modify: crypto.randomUUID(),
    extend: crypto.randomUUID(),
    cancel: crypto.randomUUID(),
  })
  const actionError = modify.error ?? extend.error ?? cancel.error

  /** Validates and submits a Booking window modification. */
  async function submitModification() {
    const pickup = new Date(modifyPickup)
    const returnAt = new Date(modifyReturn)
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(returnAt.getTime()) || returnAt <= pickup) {
      setValidation(t('booking.lifecycle.validation.window'))
      return
    }
    setValidation(null)
    try {
      await modify.mutateAsync({
        bookingId: booking.id,
        expectedRevision: booking.revision,
        pickupAtUtc: pickup.toISOString(),
        returnAtUtc: returnAt.toISOString(),
        idempotencyKey: commandKeys.current.modify,
      })
      onChanged()
    } catch {
      // React Query retains the normalized error for the recovery message.
    }
  }

  /** Validates and submits a Booking extension. */
  async function submitExtension() {
    const returnAt = new Date(extensionReturn)
    if (Number.isNaN(returnAt.getTime()) || returnAt <= new Date(booking.returnAtUtc)) {
      setValidation(t('booking.lifecycle.validation.extension'))
      return
    }
    setValidation(null)
    try {
      await extend.mutateAsync({
        bookingId: booking.id,
        expectedRevision: booking.revision,
        newReturnAtUtc: returnAt.toISOString(),
        idempotencyKey: commandKeys.current.extend,
      })
      onChanged()
    } catch {
      // React Query retains the normalized error for the recovery message.
    }
  }

  /** Submits a reasoned pre-custody Booking cancellation. */
  async function submitCancellation() {
    if (!cancelReason.trim()) {
      setValidation(t('booking.lifecycle.validation.reason'))
      return
    }
    setValidation(null)
    try {
      await cancel.mutateAsync({
        bookingId: booking.id,
        expectedRevision: booking.revision,
        reason: cancelReason.trim(),
        idempotencyKey: commandKeys.current.cancel,
      })
      onChanged()
    } catch {
      // React Query retains the normalized error for the recovery message.
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <StatusChip
        tone={
          booking.status === 'Approved' || booking.status === 'Active'
            ? 'ok'
            : 'warn'
        }
        label={t(`booking.status.${booking.status}`)}
      />
      <dl className="grid gap-4 text-sm">
        <Detail
          label={t('booking.vehicle')}
          value={`${[booking.vehicle.makeCode, booking.vehicle.modelCode].filter(Boolean).join(' ').replaceAll('_', ' ')} · ${booking.vehicle.plate}`}
        />
        <Detail
          label={t('booking.tripWindow')}
          value={new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).formatRange(
            new Date(booking.pickupAtUtc),
            new Date(booking.returnAtUtc),
          )}
        />
        <Detail
          label={t('booking.destination')}
          value={booking.destination ?? t('booking.notAvailable')}
        />
        <Detail
          label={t('booking.passengers')}
          value={String(booking.passengerCount ?? 0)}
        />
        <Detail
          label={t('booking.redesign.location')}
          value={booking.scopeName ?? t('booking.notAvailable')}
        />
        <Detail
          label={t('booking.redesign.revision')}
          value={String(booking.revision)}
        />
      </dl>
      {(booking.capabilities.modify || booking.capabilities.extend || booking.capabilities.cancel) && (
        <section className="border-t border-border pt-4">
          <h3 className="font-bold">{t('booking.lifecycle.actions')}</h3>
          {booking.capabilities.modify && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="booking-modify-pickup">{t('booking.lifecycle.pickup')}</Label>
                <Input id="booking-modify-pickup" className="mt-2" type="datetime-local" value={modifyPickup} onChange={(event) => setModifyPickup(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="booking-modify-return">{t('booking.lifecycle.return')}</Label>
                <Input id="booking-modify-return" className="mt-2" type="datetime-local" value={modifyReturn} onChange={(event) => setModifyReturn(event.target.value)} />
              </div>
              <Button className="sm:col-span-2" variant="secondary" disabled={modify.isPending} onClick={() => void submitModification()}>
                {t('booking.lifecycle.modify')}
              </Button>
              <p className="text-xs text-muted-foreground sm:col-span-2">{t('booking.lifecycle.reconsentGuidance')}</p>
            </div>
          )}
          {booking.capabilities.extend && (
            <div className="mt-4">
              <Label htmlFor="booking-extend-return">{t('booking.lifecycle.newReturn')}</Label>
              <Input id="booking-extend-return" className="mt-2" type="datetime-local" value={extensionReturn} onChange={(event) => setExtensionReturn(event.target.value)} />
              <Button className="mt-3 w-full" variant="secondary" disabled={extend.isPending} onClick={() => void submitExtension()}>
                {t('booking.lifecycle.extend')}
              </Button>
            </div>
          )}
          {booking.capabilities.cancel && (
            <div className="mt-4">
              <Label htmlFor="booking-cancel-reason">{t('booking.lifecycle.cancelReason')}</Label>
              <Input id="booking-cancel-reason" className="mt-2" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
              <Button className="mt-3 w-full" variant="destructive" disabled={cancel.isPending} onClick={() => void submitCancellation()}>
                {t('booking.lifecycle.cancel')}
              </Button>
            </div>
          )}
          {validation && <p role="alert" className="mt-3 text-sm text-destructive">{validation}</p>}
          {actionError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {actionError instanceof ApiRequestError && actionError.status === 409
                ? t('booking.lifecycle.stale')
                : t('booking.lifecycle.error')}
            </p>
          )}
        </section>
      )}
      {booking.capabilities.consent && (
        <Button className="w-full" onClick={onConsent}>{t('booking.lifecycle.continueConsent')}</Button>
      )}
      <section className="border-t border-border pt-4">
        <h3 className="font-bold">{t('booking.lifecycle.history')}</h3>
        {events.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('booking.lifecycle.historyLoading')}</p>
        ) : events.isError ? (
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => void events.refetch()}>{t('common.retry')}</Button>
        ) : (
          <ol className="mt-3 divide-y divide-border">
            {events.data?.map((event) => (
              <li key={event.id} className="py-3 text-sm">
                <strong>{t(`booking.events.${event.eventType}`, { defaultValue: event.eventType })}</strong>
                <time className="mt-1 block text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.atUtc))}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/** Converts an ISO instant to a local datetime input value. */
function toLocalDateTime(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  )
}
