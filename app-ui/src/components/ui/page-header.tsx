import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  /** Context/date line under the description. Defaults to today's full date. */
  date?: string
  /** Hide the date/context line (e.g. cinematic dashboards). */
  hideDate?: boolean
  className?: string
}

/**
 * Page hero — the navy wayfinding banner at the top of every page: a gold
 * marker + eyebrow + large title on the start side, primary/secondary actions
 * on the end side, and a context/date line under the description (registered
 * design approach — present on every page). Sits on the `--hero-gradient`
 * token. Action buttons should use the `signal` (gold, primary) and `railGhost`
 * (secondary) variants so they read on the navy surface.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  date,
  hideDate,
  className,
}: PageHeaderProps) {
  const { i18n } = useTranslation()
  const contextDate = hideDate
    ? null
    : (date ??
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' }).format(
        new Date(),
      ))
  return (
    <div
      className={cn(
        'relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[10px] bg-[image:var(--hero-gradient)] px-6 py-6 text-[color:var(--hero-foreground)] shadow-[var(--shadow-raised)] rtl:[--hero-gradient-angle:225deg] sm:px-8',
        className,
      )}
    >
      {/* Faint wayfinding vignette on the inline-end corner (mirrors under RTL). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-0 w-2/3 bg-[radial-gradient(120%_140%_at_100%_0%,rgba(255,255,255,0.10),transparent_60%)] rtl:bg-[radial-gradient(120%_140%_at_0%_0%,rgba(255,255,255,0.10),transparent_60%)]"
      />
      <div className="relative min-w-0">
        {eyebrow ? (
          <p className="mb-2 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-[3px] w-6 rounded-full bg-signal"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-signal">
              {eyebrow}
            </span>
          </p>
        ) : null}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-white/70">{description}</p>
        ) : null}
        {contextDate ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-white/85">
            <CalendarDays aria-hidden="true" className="size-4 text-signal" />
            <span className="font-data">{contextDate}</span>
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="relative flex shrink-0 flex-wrap items-center gap-2.5 self-start">
          {action}
        </div>
      ) : null}
    </div>
  )
}
