import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: ReactNode
  /** When provided, shows a "clear all" affordance on the end side. */
  onClear?: () => void
  className?: string
}

/** A labelled row of filter controls with an optional "clear all". Reused by every list screen. */
export function FilterBar({ children, onClear, className }: FilterBarProps) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-[3px] border border-border bg-card p-2.5',
        className,
      )}
    >
      {children}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="ms-auto inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
          {t('common.clearFilters')}
        </button>
      ) : null}
    </div>
  )
}
