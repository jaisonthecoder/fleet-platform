import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/form/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Combobox } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { notify } from '@/hooks/use-toast'

const schema = z.object({
  destination: z.string().min(2, 'Enter a destination'),
  requestType: z.enum(['long', 'temp']),
  pool: z.string().min(1, 'Select a pool'),
  date: z.date({ error: 'Pick a date' }),
  fuel: z.number().min(0).max(100),
  withDriver: z.boolean(),
  vehicleClass: z.enum(['sedan', 'suv', 'van']),
  agree: z
    .boolean()
    .refine((value) => value === true, 'You must accept to continue'),
})
type Values = z.infer<typeof schema>

const pools = [
  { value: 'gs', label: 'GS Pool — Mina Zayed' },
  { value: 'khalifa', label: 'Khalifa Port Pool' },
  { value: 'kezad', label: 'Kezad HQ' },
]

/** Reference form exercising the RHF + Zod layer and every control (validated). */
export function ReferenceForm() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      destination: '',
      requestType: 'long',
      pool: '',
      fuel: 60,
      withDriver: false,
      vehicleClass: 'suv',
      agree: false,
    },
  })

  const onSubmit = (values: Values) => {
    notify.ok('Request submitted', { description: values.destination })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-xl space-y-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="destination"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination</FormLabel>
              <FormControl>
                <Input placeholder="Khalifa Port, Gate 4" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requestType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Request type</FormLabel>
              <div>
                <Segmented
                  aria-label="Request type"
                  options={[
                    { value: 'long', label: 'Long-term' },
                    { value: 'temp', label: 'Temporary' },
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pool"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Pool</FormLabel>
              <Combobox
                options={pools}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose a pool"
                invalid={!!fieldState.error}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                invalid={!!fieldState.error}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vehicleClass"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle class</FormLabel>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex gap-4"
              >
                {(['sedan', 'suv', 'van'] as const).map((v) => (
                  <label
                    key={v}
                    htmlFor={`vehicle-${v}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <RadioGroupItem id={`vehicle-${v}`} value={v} />{' '}
                    {v.toUpperCase()}
                  </label>
                ))}
              </RadioGroup>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fuel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fuel level — {field.value}%</FormLabel>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[field.value]}
                onValueChange={(v) => field.onChange(v[0])}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="withDriver"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="With driver"
                />
                <span className="text-[13px] font-semibold text-foreground">
                  With driver
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agree"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Accept terms"
                />
                <span className="text-sm">
                  I accept responsibility for fines, tolls and damage during
                  this booking.
                </span>
              </div>
              <FormDescription>Policy v3.2</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Sign &amp; submit</Button>
      </form>
    </Form>
  )
}
