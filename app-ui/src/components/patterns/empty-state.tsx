import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Calm, centred placeholder for "no results / nothing here yet" (not an error). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[3px] border border-dashed border-border bg-card px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 grid size-11 place-items-center rounded-[3px] bg-surface-2 text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
