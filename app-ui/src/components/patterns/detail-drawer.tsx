import { type ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/** Right-side inspector for record detail. Header + scrollable body + optional action footer. */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[92vw] max-w-md flex-col gap-0 p-0"
      >
        <div className="border-b border-border p-5">
          <SheetTitle className="text-base font-bold text-foreground">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          ) : null}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-5">{children}</div>
        </ScrollArea>
        {footer ? <div className="border-t border-border p-4">{footer}</div> : null}
      </SheetContent>
    </Sheet>
  )
}
