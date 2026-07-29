import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  /** Optional destination; when omitted the tier renders as plain text. */
  to?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Reusable breadcrumb trail: muted tiers separated by a chevron, the last tier
 * emphasised and marked `aria-current`. Chevrons mirror under RTL. Tiers with a
 * `to` are links; the rest are plain text. Copy is caller-provided (i18n keys).
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const { t } = useTranslation()
  if (items.length === 0) return null

  return (
    <nav aria-label={t('common.breadcrumb')} className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="min-w-0">
                {item.to && !isLast ? (
                  <Link
                    to={item.to}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={cn(
                      'truncate',
                      isLast
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {item.label}
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
    </nav>
  )
}
