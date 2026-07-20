import * as React from 'react'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  delta?: string
  deltaTone?: 'ok' | 'danger' | 'neutral'
  icon?: LucideIcon
  iconTone?: 'brand' | 'ok' | 'warn' | 'danger' | 'info'
  className?: string
}

const iconToneClass: Record<NonNullable<StatCardProps['iconTone']>, string> = {
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
}

/** Executive KPI cell: eyebrow label, big value, optional delta + icon. */
export function StatCard({
  label,
  value,
  sublabel,
  delta,
  deltaTone = 'neutral',
  icon: Icon,
  iconTone = 'brand',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[3px] border border-border bg-card p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">{label}</div>
        {Icon ? (
          <span
            className={cn(
              'grid size-8 place-items-center rounded-[3px]',
              iconToneClass[iconTone],
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-2 font-data text-3xl font-bold leading-none">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold',
              deltaTone === 'ok' && 'text-success',
              deltaTone === 'danger' && 'text-destructive',
              deltaTone === 'neutral' && 'text-muted-foreground',
            )}
          >
            {deltaTone === 'danger' ? (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            )}
            {delta}
          </span>
        ) : null}
        {sublabel ? (
          <span className="text-xs text-muted-foreground">{sublabel}</span>
        ) : null}
      </div>
    </div>
  )
}

interface DescriptionListProps {
  items: { label: string; value: React.ReactNode }[]
  className?: string
}

/** Label → value rows (trip summary, vehicle facts). */
export function DescriptionList({ items, className }: DescriptionListProps) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-4 py-2.5 text-sm"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-end font-semibold text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
