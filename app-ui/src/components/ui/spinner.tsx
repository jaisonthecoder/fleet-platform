import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  /** Accessible label. If omitted the spinner is decorative (aria-hidden). */
  label?: string
}

/** Inline loading spinner for buttons/async regions. Respects prefers-reduced-motion. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <Loader2
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('size-4 animate-spin text-muted-foreground', className)}
    />
  )
}
