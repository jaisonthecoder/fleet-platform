import * as TooltipPrimitive from '@radix-ui/react-tooltip'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

/** Renders an accessible hover/focus tooltip. */
function TooltipContent(
  props: React.ComponentProps<typeof TooltipPrimitive.Content>,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={6}
        className="z-[80] rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md"
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
