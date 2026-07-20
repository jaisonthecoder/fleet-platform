import * as React from 'react'
import { cn } from '@/lib/utils'

/** Renders a consistent form-field label. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-sm font-medium leading-none', className)}
      {...props}
    />
  )
}

export { Label }
