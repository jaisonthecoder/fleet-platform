import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const signalBar = cva('absolute inset-y-0 start-0 w-1', {
  variants: {
    tone: {
      brand: 'bg-brand',
      signal: 'bg-signal',
      ok: 'bg-success',
      warn: 'bg-warning',
      danger: 'bg-destructive',
      info: 'bg-info',
      neutral: 'bg-border',
    },
  },
  defaultVariants: { tone: 'brand' },
})

interface SignalCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof signalBar> {}

/**
 * Card with a slim start-edge signal bar encoding state — the painted
 * berth-marking motif. The bar mirrors automatically under `dir="rtl"`.
 */
export function SignalCard({
  tone,
  className,
  children,
  ...props
}: SignalCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card p-4 ps-5 shadow-[var(--shadow-rest)]',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={signalBar({ tone })} />
      {children}
    </div>
  )
}
