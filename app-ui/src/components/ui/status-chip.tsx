import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusChipVariants = cva(
  'inline-flex items-center gap-2 rounded-[3px] border px-2 py-1 font-mono text-[11px] font-semibold uppercase leading-none tracking-[0.06em]',
  {
    variants: {
      tone: {
        ok: 'border-success/40 bg-success/10 text-success',
        warn: 'border-warning/40 bg-warning/10 text-warning',
        danger: 'border-destructive/40 bg-destructive/10 text-destructive',
        info: 'border-info/40 bg-info/10 text-info',
        neutral: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

type Tone = NonNullable<VariantProps<typeof statusChipVariants>['tone']>

const dotColor: Record<Tone, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
}

interface StatusChipProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipVariants> {
  label: string
}

/**
 * Wayfinding status pill: a square signal dot + an uppercase mono label. Colour
 * is never the only signal — the label always names the state (design-system
 * §10.2), readable in sunlight, grayscale and by screen readers.
 */
export function StatusChip({
  tone = 'neutral',
  label,
  className,
  ...props
}: StatusChipProps) {
  const resolvedTone: Tone = tone ?? 'neutral'
  return (
    <span
      className={cn(statusChipVariants({ tone: resolvedTone }), className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn('size-[7px]', dotColor[resolvedTone])}
      />
      {label}
    </span>
  )
}
