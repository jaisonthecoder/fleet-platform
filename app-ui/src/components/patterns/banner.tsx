import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const bannerVariants = cva(
  'flex items-start gap-3 rounded-[3px] border px-4 py-3.5 text-sm',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-card [&_[data-icon]]:text-muted-foreground',
        info: 'border-info/30 bg-info/10 [&_[data-icon]]:text-info',
        ok: 'border-success/30 bg-success/10 [&_[data-icon]]:text-success',
        warn: 'border-warning/30 bg-warning/10 [&_[data-icon]]:text-warning',
        danger:
          'border-destructive/30 bg-destructive/10 [&_[data-icon]]:text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

interface BannerProps extends VariantProps<typeof bannerVariants> {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  /** Provide to render a dismiss button. */
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
}

/** Full-width, page-level notice. Tone + icon + message (+ optional CTA / dismiss). */
export function Banner({
  tone,
  icon: Icon,
  title,
  description,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}: BannerProps) {
  return (
    <div role="status" className={cn(bannerVariants({ tone }), className)}>
      {Icon ? (
        <Icon
          data-icon
          aria-hidden="true"
          className="mt-0.5 size-[18px] shrink-0"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-foreground">{title}</div>
        {description ? (
          <div className="mt-1 text-muted-foreground">{description}</div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="-me-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-[3px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
