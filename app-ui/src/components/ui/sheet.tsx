import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

/** Renders a responsive off-canvas panel. */
function SheetContent({
  className,
  children,
  side = 'left',
  closeLabel = 'Close',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: 'left' | 'right'
  closeLabel?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/25" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 w-[85vw] max-w-xs border-border bg-background p-5 shadow-xl outline-none',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute top-4 z-10 grid size-9 place-items-center rounded-full bg-signal text-signal-foreground shadow-lg outline-none transition-colors hover:bg-signal-strong focus-visible:ring-2 focus-visible:ring-ring',
            side === 'left'
              ? 'right-0 translate-x-[calc(100%+0.5rem)]'
              : 'left-0 -translate-x-[calc(100%+0.5rem)]',
          )}
        >
          <X className="size-4" />
          <span className="sr-only">{closeLabel}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

const SheetTitle = DialogPrimitive.Title
const SheetDescription = DialogPrimitive.Description

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
}
