import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Fuel, MapPin, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { SignalCard } from '@/components/ui/signal-card'
import {
  AvailabilityStrip,
  type AvailabilitySlot,
} from '@/components/patterns/availability-strip'
import { cn } from '@/lib/utils'

const windows = ['08:00 – 10:00', '10:00 – 13:00', '13:00 – 17:00', 'Full day']

const stripSlots: AvailabilitySlot[] = [
  { state: 'booked', label: '06:00 booked' },
  { state: 'booked', label: '07:00 booked' },
  { state: 'free', label: '08:00 free' },
  { state: 'free', label: '09:00 free' },
  { state: 'mine', label: '10:00 your booking' },
  { state: 'mine', label: '11:00 your booking' },
  { state: 'buffer', label: '12:00 handover buffer' },
  { state: 'free', label: '13:00 free' },
  { state: 'free', label: '14:00 free' },
  { state: 'blocked', label: '15:00 maintenance' },
  { state: 'free', label: '16:00 free' },
  { state: 'free', label: '17:00 free' },
]

interface Vehicle {
  id: string
  model: string
  plate: string
  seats: number
  fuel: string
  yard: string
  rate: string
  tone: 'ok' | 'warn'
  statusKey: 'available' | 'insurance'
}

const vehicles: Vehicle[] = [
  {
    id: 'v1',
    model: 'Toyota Camry',
    plate: 'DXB-30541',
    seats: 5,
    fuel: 'Petrol',
    yard: 'Yard A · 80m',
    rate: 'AED 0.68',
    tone: 'ok',
    statusKey: 'available',
  },
  {
    id: 'v2',
    model: 'Nissan Patrol',
    plate: 'AUH-10233',
    seats: 7,
    fuel: 'Petrol',
    yard: 'Yard B · 200m',
    rate: 'AED 1.02',
    tone: 'warn',
    statusKey: 'insurance',
  },
  {
    id: 'v3',
    model: 'Toyota Hiace',
    plate: 'DXB-55102',
    seats: 12,
    fuel: 'Diesel',
    yard: 'Yard A · 140m',
    rate: 'AED 0.94',
    tone: 'ok',
    statusKey: 'available',
  },
]

/** Calm-register sample screen: the first step of the 2-minute booking. */
export function BookingSamplePage() {
  const { t } = useTranslation()
  const [activeWindow, setActiveWindow] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow={t('sample.eyebrow')}
        title={t('sample.title')}
        description={t('sample.lead')}
      />

      <div className="flex flex-wrap gap-2">
        {windows.map((label, index) => (
          <Button
            key={label}
            variant={index === activeWindow ? 'default' : 'secondary'}
            size="sm"
            aria-pressed={index === activeWindow}
            onClick={() => setActiveWindow(index)}
          >
            {label}
          </Button>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="eyebrow">{t('sample.availabilityTitle')}</h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <AvailabilityStrip
            slots={stripSlots}
            ticks={['06:00', '10:00', '14:00', '18:00']}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">{t('sample.recommendedTitle')}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => {
            const isSelected = selected === vehicle.id
            return (
              <SignalCard
                key={vehicle.id}
                tone={isSelected ? 'signal' : vehicle.tone}
                className={cn(isSelected && 'ring-2 ring-signal')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{vehicle.model}</div>
                    <div className="font-data text-xs text-muted-foreground">
                      {vehicle.plate}
                    </div>
                  </div>
                  <StatusChip
                    tone={vehicle.tone}
                    label={
                      vehicle.statusKey === 'available'
                        ? t('sample.availableAllDay')
                        : 'Insurance 9d'
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {vehicle.seats}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Fuel className="size-3.5" /> {vehicle.fuel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {vehicle.yard}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="font-data text-sm">
                    {t('sample.perKm', { rate: vehicle.rate })}
                  </span>
                  <Button
                    size="sm"
                    variant={isSelected ? 'signal' : 'default'}
                    onClick={() => setSelected(vehicle.id)}
                  >
                    {isSelected ? t('sample.selected') : t('sample.select')}
                  </Button>
                </div>
              </SignalCard>
            )
          })}
        </div>
      </section>

      <div className="flex justify-end border-t border-border pt-6">
        <Button disabled={!selected}>
          {t('sample.continue')} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
