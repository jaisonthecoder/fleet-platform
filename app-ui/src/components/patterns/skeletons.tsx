import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Structure-shaped loading placeholders (no spinners for content). */

export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[3px] border border-border bg-card p-4',
        className,
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[3px] border border-border bg-card p-[18px]',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mt-3 h-3 w-40" />
      <Skeleton className="mt-4 h-8 w-24" />
    </div>
  )
}

export function TableRowsSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn('h-4', c === 0 ? 'w-40' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-40" />
    </div>
  )
}
