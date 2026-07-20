import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** Timeline occupancy tone → cell classes (our brand tokens). */
const segmentTone = {
  open: 'bg-success/10 text-success',
  yours: 'bg-brand text-brand-foreground',
  booked: 'bg-ink-3 text-white',
} as const

type SegmentTone = keyof typeof segmentTone

interface TimelineSegment {
  left: number
  width: number
  tone: SegmentTone
  label: string
}

interface TimelineRow {
  plate: string
  model: string
  segments: TimelineSegment[]
}

const timeline: TimelineRow[] = [
  {
    plate: 'AD 40213',
    model: 'Land Cruiser · 7 seats',
    segments: [
      { left: 0, width: 50, tone: 'booked', label: 'Booked' },
      { left: 54, width: 46, tone: 'open', label: 'Book from 12:30 →' },
    ],
  },
  {
    plate: 'AD 88914',
    model: 'Patrol · 5 seats',
    segments: [
      { left: 0, width: 25, tone: 'open', label: 'Open' },
      { left: 25, width: 50, tone: 'yours', label: 'Your booking · 09–15' },
      { left: 79, width: 21, tone: 'open', label: 'Open' },
    ],
  },
  {
    plate: 'AD 55102',
    model: 'Hiace · 12 seats',
    segments: [
      { left: 0, width: 58, tone: 'booked', label: 'Under maintenance' },
      { left: 60, width: 40, tone: 'open', label: 'Book from 13:00 →' },
    ],
  },
]

const availabilityTone = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  muted: 'bg-surface-2 text-muted-foreground',
} as const

type AvailabilityTone = keyof typeof availabilityTone

interface EligibleVehicle {
  id: string
  model: string
  plate: string
  seats: number
  fuel: string
  yard: string
  availability: string
  tone: AvailabilityTone
  fuelEstimate: string
}

const eligibleVehicles: EligibleVehicle[] = [
  {
    id: 'v1',
    model: 'Toyota Land Cruiser',
    plate: 'AD 40213',
    seats: 7,
    fuel: 'Hybrid',
    yard: 'Yard B',
    availability: 'Available from 12:30',
    tone: 'warn',
    fuelEstimate: 'Est. fuel 6.1L',
  },
  {
    id: 'v2',
    model: 'Nissan Patrol',
    plate: 'AD 88914',
    seats: 5,
    fuel: 'Petrol',
    yard: 'Yard A',
    availability: 'Booked until 15:00',
    tone: 'muted',
    fuelEstimate: 'Est. fuel 7.4L',
  },
  {
    id: 'v3',
    model: 'Toyota Hiace',
    plate: 'AD 55102',
    seats: 12,
    fuel: 'Diesel',
    yard: 'Yard B',
    availability: 'Free from 13:00',
    tone: 'warn',
    fuelEstimate: 'Est. fuel 9.8L',
  },
  {
    id: 'v4',
    model: 'Kia EV6',
    plate: 'AD 90044',
    seats: 5,
    fuel: 'Electric',
    yard: 'Yard A',
    availability: 'Available all day',
    tone: 'ok',
    fuelEstimate: 'Est. 9.1 kWh',
  },
]

const FIELD =
  'h-11 w-full rounded-[2px] border border-border bg-surface-2 px-3.5 text-[13.5px] text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring'
const FIELD_LABEL = 'mb-1.5 block text-[11.5px] font-bold text-muted-foreground'

/** Employee “Book a vehicle” — search, today's occupancy, and eligible vehicles. */
export function BookVehiclePage() {
  const { t } = useTranslation()
  const [destination, setDestination] = useState('Khalifa Port, Gate 4')
  const [pickup, setPickup] = useState('09:00')
  const [ret, setRet] = useState('15:00')
  const [pax, setPax] = useState('2')

  return (
    <div className="space-y-7">
      <header>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-brand">
          {t('booking.eyebrow')}
        </p>
        <h1 className="text-[26px] font-bold tracking-[-0.015em] text-foreground">
          {t('booking.title')}
        </h1>
        <p className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">
          {t('booking.subtitle')}
        </p>
      </header>

      {/* Search */}
      <div className="grid grid-cols-1 gap-3.5 rounded-[3px] border border-border bg-card p-5 shadow-[var(--shadow-rest)] sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_0.8fr] lg:items-end">
        <div>
          <label className={FIELD_LABEL} htmlFor="bk-destination">
            {t('booking.destination')}
          </label>
          <input
            id="bk-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="bk-pickup">
            {t('booking.pickup')}
          </label>
          <input
            id="bk-pickup"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            className={cn(FIELD, 'font-data')}
          />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="bk-return">
            {t('booking.return')}
          </label>
          <input
            id="bk-return"
            value={ret}
            onChange={(e) => setRet(e.target.value)}
            className={cn(FIELD, 'font-data')}
          />
        </div>
        <div>
          <label className={FIELD_LABEL} htmlFor="bk-pax">
            {t('booking.passengers')}
          </label>
          <select
            id="bk-pax"
            value={pax}
            onChange={(e) => setPax(e.target.value)}
            className={FIELD}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="7">7+</option>
          </select>
        </div>
      </div>

      {/* Today's occupancy */}
      <section>
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2 className="text-base font-bold text-foreground">
            {t('booking.todayAt')}
          </h2>
          <span className="font-data text-xs text-ink-3">
            {t('booking.todayRange')}
          </span>
        </div>
        <div className="rounded-[3px] border border-border bg-card px-5 pb-5 pt-[18px]">
          {timeline.map((row) => (
            <div
              key={row.plate}
              className="grid grid-cols-[130px_1fr] items-center gap-4 py-2.5 md:grid-cols-[150px_1fr]"
            >
              <div>
                <div className="font-data text-[13px] font-bold text-foreground">
                  {row.plate}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-3">
                  {row.model}
                </div>
              </div>
              <div className="relative flex h-[30px] overflow-hidden rounded-[2px] bg-surface-2">
                {row.segments.map((seg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'absolute inset-y-0 m-0.5 flex items-center justify-center overflow-hidden whitespace-nowrap rounded-[6px] px-2 text-[10.5px] font-bold',
                      segmentTone[seg.tone],
                    )}
                    style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                  >
                    {seg.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3.5 flex flex-wrap gap-5 border-t border-border pt-3.5 text-[11.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-[11px] rounded-[3px] bg-brand" />
              {t('booking.legendYours')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-[11px] rounded-[3px] bg-ink-3" />
              {t('booking.legendBooked')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-[11px] rounded-[3px] border border-success bg-success/10" />
              {t('booking.legendOpen')}
            </span>
          </div>
        </div>
      </section>

      {/* Eligible vehicles */}
      <section>
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2 className="text-base font-bold text-foreground">
            {t('booking.eligible')}
          </h2>
          <span className="font-data text-xs text-ink-3">
            {t('booking.matching', { count: eligibleVehicles.length })}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {eligibleVehicles.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-3 rounded-[3px] border border-border bg-card p-[18px] shadow-[var(--shadow-rest)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15px] font-bold text-foreground">
                  {v.model}
                </div>
                <div className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-data text-[11px] font-bold">
                  {v.plate}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{t('booking.seats', { count: v.seats })}</span>
                <span>{v.fuel}</span>
                <span>{v.yard}</span>
              </div>
              <div
                className={cn(
                  'w-fit rounded-[4px] px-2.5 py-1.5 text-[11.5px] font-bold',
                  availabilityTone[v.tone],
                )}
              >
                {v.availability}
              </div>
              <div className="mt-auto flex items-center justify-between pt-1.5">
                <span className="text-xs text-ink-3">{v.fuelEstimate}</span>
                <button
                  type="button"
                  className="h-[38px] rounded-[2px] bg-primary px-[18px] text-[12.5px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t('booking.book')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
