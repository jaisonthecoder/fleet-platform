import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative grid grid-cols-[auto_1fr] gap-x-3 rounded-[3px] border px-4 py-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-[18px]',
  {
    variants: {
      tone: {
        neutral:
          'border-border bg-card text-foreground [&>svg]:text-muted-foreground',
        info: 'border-info/30 bg-info/10 text-foreground [&>svg]:text-info',
        ok: 'border-success/30 bg-success/10 text-foreground [&>svg]:text-success',
        warn: 'border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning',
        danger:
          'border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>

/** Inline contextual feedback. Tone sets border/fill/icon; pass an icon as the first child. */
function Alert({ className, tone, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  )
}
function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn('col-start-2 font-semibold', className)} {...props} />
  )
}
function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('col-start-2 mt-1 text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
