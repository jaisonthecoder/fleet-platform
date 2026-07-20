import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  value?: Date
  onChange?: (date?: Date) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
}

/** Single-date picker: token field trigger + popover calendar. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  invalid,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex h-11 w-full items-center gap-2 rounded-[3px] border border-input bg-surface-2 px-3.5 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
            invalid && 'border-destructive',
            !value && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-4 text-ink-3" />
          {value ? format(value, 'dd MMM yyyy') : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
