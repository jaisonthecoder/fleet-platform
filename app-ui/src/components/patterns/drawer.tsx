import { type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type DrawerWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

/** Responsive max-width per size; the panel is always full-width on small screens. */
const WIDTH: Record<DrawerWidth, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
}

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Small uppercase context label above the title (e.g. "IDENTITY · MANAGE ACCESS"). */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Node pinned to the header's end row, aligned with the title (e.g. a StatusChip). */
  headerAccessory?: ReactNode
  /** Dynamic panel width. Defaults to `md`. */
  width?: DrawerWidth
  side?: 'left' | 'right'
  /** Sticky action bar at the bottom. */
  footer?: ReactNode
  children: ReactNode
  /** When false, the body is not wrapped in the default scroll+padding container. */
  scrollable?: boolean
  /** Extra classes for the body container (e.g. remove padding for full-bleed content). */
  bodyClassName?: string
  /** Escape hatch for the panel itself (e.g. a custom width). */
  className?: string
  closeLabel?: string
}

/**
 * The canonical off-canvas drawer for record detail and side forms. Provides a
 * consistent, themed header (eyebrow · title · description + optional accessory),
 * a scrollable body, and an optional sticky footer, with dynamic width.
 */
export function Drawer({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  headerAccessory,
  width = 'md',
  side = 'right',
  footer,
  children,
  scrollable = true,
  bodyClassName,
  className,
  closeLabel,
}: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        closeLabel={closeLabel}
        className={cn('flex w-[92vw] flex-col gap-0 p-0', WIDTH[width], className)}
      >
        <header className="border-b border-border bg-card px-5 py-4">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-base font-bold text-foreground">{title}</SheetTitle>
            {headerAccessory ? <div className="shrink-0">{headerAccessory}</div> : null}
          </div>
          {description ? (
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          ) : null}
        </header>
        {scrollable ? (
          <div className={cn('flex-1 overflow-y-auto p-5', bodyClassName)}>
            {children}
          </div>
        ) : (
          <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{children}</div>
        )}
        {footer ? <footer className="border-t border-border bg-card p-4">{footer}</footer> : null}
      </SheetContent>
    </Sheet>
  )
}
