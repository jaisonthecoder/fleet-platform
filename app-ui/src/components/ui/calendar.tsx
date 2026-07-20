import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/** react-day-picker calendar skinned to Wayfinder tokens (used by DatePicker). */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4 sm:flex-row',
        month: 'space-y-3',
        month_caption: 'relative flex items-center justify-center pt-1',
        caption_label: 'text-sm font-semibold',
        nav: 'absolute inset-x-1 top-1 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'secondary', size: 'icon' }),
          'size-7',
        ),
        button_next: cn(
          buttonVariants({ variant: 'secondary', size: 'icon' }),
          'size-7',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-[11px] font-semibold uppercase text-ink-3',
        week: 'mt-1 flex w-full',
        day: 'relative size-9 p-0 text-center text-sm',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 rounded-[3px] p-0 font-normal',
        ),
        selected:
          'rounded-[3px] [&_button]:bg-brand [&_button]:text-brand-foreground [&_button:hover]:bg-brand',
        today: 'font-bold text-brand',
        outside: 'text-ink-3 opacity-50',
        disabled: 'opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  )
}
