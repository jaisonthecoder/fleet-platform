import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const fillTone = cva('h-full rounded-full transition-[width] duration-300', {
  variants: {
    tone: {
      brand: 'bg-brand',
      ok: 'bg-success',
      warn: 'bg-warning',
      danger: 'bg-destructive',
    },
  },
  defaultVariants: { tone: 'brand' },
})

interface ProgressProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'role'>,
    VariantProps<typeof fillTone> {
  /** 0–100. Omit / null for an indeterminate bar. */
  value?: number | null
  label?: string
}

/**
 * Token-driven progress bar (no external dep). Determinate when `value` is a
 * number; indeterminate (animated sweep) otherwise.
 */
export function Progress({
  value,
  tone,
  label,
  className,
  ...props
}: ProgressProps) {
  const indeterminate = value == null
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-surface-2',
        className,
      )}
      {...props}
    >
      {indeterminate ? (
        <div className={cn(fillTone({ tone }), 'w-2/5 animate-pulse')} />
      ) : (
        <div className={fillTone({ tone })} style={{ width: `${clamped}%` }} />
      )}
    </div>
  )
}
