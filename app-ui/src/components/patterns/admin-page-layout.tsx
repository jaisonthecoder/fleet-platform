import { type ReactNode } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

interface AdminPageLayoutProps {
  eyebrow?: string
  title: string
  description?: string
  /** Primary action(s) rendered on the header's end side. */
  actions?: ReactNode
  /** Optional filter/toolbar row rendered above the content. */
  filterBar?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Consistent frame for every admin / governance screen: page header (eyebrow =
 * register, title, description, primary action) + optional filter bar + content.
 * Domain-agnostic — reused across all modules.
 */
export function AdminPageLayout({
  eyebrow,
  title,
  description,
  actions,
  filterBar,
  children,
  className,
}: AdminPageLayoutProps) {
  return (
    <div className={cn('flex w-full flex-col gap-5', className)}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={actions}
      />
      {filterBar}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
