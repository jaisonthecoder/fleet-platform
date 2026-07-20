import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
  /** Bar height in px. */
  size?: number
  /**
   * `ink` (default): outer bars inherit `currentColor` (ink on paper), centre
   * bar is signal gold — the header/wordmark mark. `rail`: outer bars are gold,
   * centre bar inherits `currentColor` (white on the navy rail) — matches the
   * prototype rail logo exactly.
   */
  variant?: 'ink' | 'rail'
}

/**
 * Name-agnostic logo mark — three wayfinding bars (berth-marking motif). The
 * product name is not final, so identity lives in this mark + the single
 * `common.appName` string, never in bespoke lettering.
 */
export function BrandMark({
  className,
  size = 22,
  variant = 'ink',
}: BrandMarkProps) {
  const outer = variant === 'rail' ? 'var(--signal)' : 'currentColor'
  const centre = variant === 'rail' ? 'currentColor' : 'var(--signal)'
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      width={size * 0.82}
      height={size}
      viewBox="0 0 18 22"
      className={cn('shrink-0', className)}
    >
      <rect x="0" y="1" width="4.2" height="20" fill={outer} />
      <rect x="6.9" y="1" width="4.2" height="20" fill={centre} />
      <rect x="13.8" y="1" width="4.2" height="20" fill={outer} />
    </svg>
  )
}
