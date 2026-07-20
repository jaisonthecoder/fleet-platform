import * as React from 'react'
import { cn } from '@/lib/utils'

export type SlotState = 'free' | 'booked' | 'buffer' | 'mine' | 'blocked'

export interface AvailabilitySlot {
  state: SlotState
  /** Screen-reader / tooltip label, e.g. "09:00 booked". */
  label?: string
}

interface AvailabilityStripProps extends React.HTMLAttributes<HTMLDivElement> {
  slots: AvailabilitySlot[]
  ticks?: string[]
  /** Screen-reader summary of the whole strip; falls back to a state count. */
  ariaLabel?: string
}

const slotClass: Record<SlotState, string> = {
  free: 'border border-dashed border-border bg-transparent',
  booked: 'bg-brand',
  buffer:
    'border border-warning/40 bg-[repeating-linear-gradient(45deg,var(--warn)_0_4px,transparent_4px_8px)]',
  mine: 'bg-success',
  blocked: 'bg-destructive',
}

/** Builds a compact count summary, e.g. "3 free, 4 booked, 1 buffer". */
function summarise(slots: AvailabilitySlot[]): string {
  const counts = slots.reduce<Partial<Record<SlotState, number>>>(
    (acc, slot) => ({ ...acc, [slot.state]: (acc[slot.state] ?? 0) + 1 }),
    {},
  )
  return Object.entries(counts)
    .map(([state, count]) => `${count} ${state}`)
    .join(', ')
}

/**
 * Berth-occupancy strip: the day's slots rendered like a harbor schedule. Time
 * flows start→end and mirrors under `dir="rtl"`. Occupied = solid, buffer =
 * hatched, free = outlined/bookable. Status is encoded in fill + label, not
 * colour alone. The visual row is decorative; a single summary is exposed to
 * assistive tech (per-cell labels would be noise).
 */
export function AvailabilityStrip({
  slots,
  ticks,
  ariaLabel,
  className,
  ...props
}: AvailabilityStripProps) {
  return (
    <div className={cn('space-y-1.5', className)} {...props}>
      <div className="flex h-8 gap-0.5" aria-hidden="true">
        {slots.map((slot, index) => (
          <span
            key={index}
            title={slot.label ?? slot.state}
            className={cn('flex-1 rounded-sm', slotClass[slot.state])}
          />
        ))}
      </div>
      <span className="sr-only">{ariaLabel ?? summarise(slots)}</span>
      {ticks ? (
        <div className="flex justify-between font-data text-[11px] text-muted-foreground">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
