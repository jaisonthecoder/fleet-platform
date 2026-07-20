import { cn } from '@/lib/utils'

export interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedProps {
  options: SegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  'aria-label'?: string
}

/**
 * Controlled segmented control (the Helm request-type / handover-return toggle).
 * Active segment = brand fill; keyboard + RTL correct via the button group.
 */
export function Segmented({
  options,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex gap-1 rounded-[3px] bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'rounded-[2px] px-4 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-brand text-brand-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
