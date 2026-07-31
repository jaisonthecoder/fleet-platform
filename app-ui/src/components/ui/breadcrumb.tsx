import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  /** Optional destination; when omitted the tier renders as plain text. */
  to?: string
  /** Optional leading glyph (e.g. a Home icon on the root tier). */
  icon?: ReactNode
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
  /** When provided, renders a leading back button (mirrored under RTL). */
  onBack?: () => void
}

/**
 * Reusable breadcrumb trail: an optional back button, then muted tiers separated
 * by a chevron with the last tier emphasised and marked `aria-current`. Chevrons
 * and the back arrow mirror under RTL. Tiers with a `to` are links; the rest are
 * plain text. A tier may carry a leading `icon`. Copy is caller-provided (i18n).
 */
export function Breadcrumb({ items, className, onBack }: BreadcrumbProps) {
  const { t } = useTranslation()
  if (items.length === 0) return null

  return (
    <nav aria-label={t('common.breadcrumb')} className={cn('min-w-0', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? (
          <>
            <button
              type="button"
              onClick={onBack}
              aria-label={t('common.back')}
              className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-border text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            </button>
            <span
              aria-hidden="true"
              className="h-5 w-px shrink-0 bg-border"
            />
          </>
        ) : null}
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const content = (
              <span className="flex items-center gap-1.5">
                {item.icon ? (
                  <span className="shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                <span className="truncate">{item.label}</span>
              </span>
            )
            return (
              <Fragment key={`${item.label}-${index}`}>
                <li className="flex min-w-0 items-center">
                  {item.to && !isLast ? (
                    <Link
                      to={item.to}
                      className="flex min-w-0 items-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {content}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={cn(
                        'flex min-w-0 items-center',
                        isLast
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {content}
                    </span>
                  )}
                </li>
                {isLast ? null : (
                  <li aria-hidden="true" className="shrink-0">
                    <ChevronRight className="size-3.5 text-ink-3 rtl:rotate-180" />
                  </li>
                )}
              </Fragment>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
