import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ButtonProps, buttonVariants } from '@/components/ui/button'

/** Pagination navigation landmark (official shadcn pattern, Wayfinder-themed). */
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'button'>

/** A single page button. `isActive` marks the current page (aria-current). */
function PaginationLink({
  className,
  isActive,
  size = 'icon',
  type = 'button',
  ...props
}: PaginationLinkProps) {
  return (
    <button
      type={type}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? 'secondary' : 'ghost',
          size,
        }),
        isActive && 'border-signal bg-signal/10 text-foreground',
        'font-data',
        className,
      )}
      {...props}
    />
  )
}

/** Previous-page control. */
function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn('gap-1 px-2.5', className)}
      {...props}
    >
      <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
    </PaginationLink>
  )
}

/** Next-page control. */
function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn('gap-1 px-2.5', className)}
      {...props}
    >
      <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
    </PaginationLink>
  )
}

/** Ellipsis placeholder for skipped page ranges. */
function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-9 items-center justify-center text-muted-foreground',
        className,
      )}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
