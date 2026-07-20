import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Fuel,
  Inbox,
  Info,
  MapPin,
  Users,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusChip } from '@/components/ui/status-chip'
import { SignalCard } from '@/components/ui/signal-card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Banner } from '@/components/patterns/banner'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeletons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { useConfirm } from '@/hooks/use-confirm'
import { notify } from '@/hooks/use-toast'
import { ReferenceForm } from './reference-form'
import { DataDemo } from './data-demo'
import { ChartsDemo } from './charts-demo'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AvailabilityStrip,
  type AvailabilitySlot,
} from '@/components/patterns/availability-strip'
import { cn } from '@/lib/utils'

/** Mono uppercase section label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-brand">
      {children}
    </h2>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 border-t border-border pt-8">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </section>
  )
}

function Swatch({
  className,
  name,
  token,
}: {
  className: string
  name: string
  token: string
}) {
  return (
    <div>
      <div className={cn('h-16 rounded-lg border border-border', className)} />
      <div className="mt-2 text-xs font-semibold">{name}</div>
      <div className="font-data text-[11px] text-muted-foreground">{token}</div>
    </div>
  )
}

const stripSlots: AvailabilitySlot[] = [
  { state: 'booked', label: '06:00 booked' },
  { state: 'booked', label: '07:00 booked' },
  { state: 'mine', label: '08:00 your booking' },
  { state: 'mine', label: '09:00 your booking' },
  { state: 'free', label: '10:00 free' },
  { state: 'free', label: '11:00 free' },
  { state: 'buffer', label: '12:00 handover buffer' },
  { state: 'free', label: '13:00 free' },
  { state: 'blocked', label: '14:00 maintenance' },
  { state: 'free', label: '15:00 free' },
  { state: 'booked', label: '16:00 booked' },
  { state: 'free', label: '17:00 free' },
]

/** Design-system reference: tokens, typography, components and patterns. */
export function DesignShowcasePage() {
  const { t } = useTranslation()
  const confirm = useConfirm()

  const handleConfirm = async () => {
    const ok = await confirm({
      title: 'Decline booking?',
      description: 'The requester will be notified with your reason.',
      tone: 'danger',
      confirmLabel: 'Decline',
    })
    if (ok) notify.danger('Booking declined')
    else notify.info('Kept — no change')
  }

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow={t('common.appName')}
        title={t('showcase.title')}
        description={t('showcase.subtitle')}
      />

      {/* Colour */}
      <Section label={t('showcase.colour')}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Swatch className="bg-brand" name="Brand" token="--brand" />
          <Swatch className="bg-signal" name="Signal" token="--signal" />
          <Swatch className="bg-success" name="OK" token="--ok" />
          <Swatch className="bg-warning" name="Warn" token="--warn" />
          <Swatch className="bg-destructive" name="Danger" token="--danger" />
          <Swatch className="bg-info" name="Info" token="--info" />
          <Swatch className="bg-background" name="Paper" token="--paper" />
          <Swatch className="bg-card" name="Surface" token="--surface" />
          <Swatch
            className="bg-surface-2"
            name="Surface 2"
            token="--surface-2"
          />
          <Swatch className="bg-foreground" name="Ink" token="--ink" />
          <Swatch
            className="bg-muted-foreground"
            name="Ink 2"
            token="--ink-2"
          />
          <Swatch className="bg-border" name="Line" token="--line" />
        </div>
      </Section>

      {/* Typography */}
      <Section label={t('showcase.typography')}>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          <div className="flex items-baseline gap-6 p-4">
            <span className="w-20 shrink-0 font-data text-xs text-muted-foreground">
              Display
            </span>
            <span className="text-4xl font-bold tracking-tight">
              Fleet, governed.
            </span>
          </div>
          <div className="flex items-baseline gap-6 p-4">
            <span className="w-20 shrink-0 font-data text-xs text-muted-foreground">
              Title
            </span>
            <span className="text-2xl font-semibold">
              Dedicated vehicle entitlement
            </span>
          </div>
          <div className="flex items-baseline gap-6 p-4">
            <span className="w-20 shrink-0 font-data text-xs text-muted-foreground">
              Body
            </span>
            <span className="max-w-lg text-[15px] leading-relaxed">
              The interface speaks the user&apos;s job — one plain verb, the
              same verb through the whole flow.
            </span>
          </div>
          <div className="flex items-baseline gap-6 p-4">
            <span className="w-20 shrink-0 font-data text-xs text-muted-foreground">
              Data
            </span>
            <span className="font-data text-[15px]">
              DXB-42198 · Mulkiya exp 04 AUG 2026 · AED 1,240.00
            </span>
          </div>
          <div className="flex items-baseline gap-6 p-4">
            <span className="w-20 shrink-0 font-data text-xs text-muted-foreground">
              Label
            </span>
            <span className="eyebrow">Booking reference</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          One type family — IBM Plex. Sans for all UI and reading; Mono only for
          data a human verifies character-by-character. No second typeface.
        </p>
      </Section>

      {/* Components */}
      <Section label={t('showcase.components')}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Confirm booking</Button>
            <Button variant="signal">Wayfind</Button>
            <Button variant="secondary">View details</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Decline</Button>
            <Button disabled>Disabled</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="ok" label="Compliant" />
            <StatusChip tone="warn" label="Expires 12d" />
            <StatusChip tone="danger" label="Blocked" />
            <StatusChip tone="info" label="Pending" />
            <StatusChip tone="neutral" label="Draft" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Approved</Badge>
            <Badge variant="warning">At risk</Badge>
            <Badge variant="destructive">Expired</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>

          <div className="grid max-w-xl gap-3">
            <Input placeholder="Destination — e.g. Khalifa Port, Gate 4" />
            <Input type="date" />
          </div>

          <Alert>
            <AlertTriangle className="size-4 text-warning" />
            <AlertTitle>Booking blocked — licence expired 12 Mar</AlertTitle>
            <AlertDescription>
              Renew with HR, then try again. Blocks always name the cause and
              the next action.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      {/* Signature patterns */}
      <Section label={t('showcase.patterns')}>
        <div className="grid gap-4 md:grid-cols-3">
          <SignalCard tone="ok">
            <div className="eyebrow">Compliant</div>
            <div className="mt-1 font-semibold">Toyota Land Cruiser</div>
            <div className="font-data text-sm text-muted-foreground">
              DXB-42198 · AED 0.84/km
            </div>
          </SignalCard>
          <SignalCard tone="warn">
            <div className="eyebrow">Insurance 9d</div>
            <div className="mt-1 font-semibold">Nissan Patrol</div>
            <div className="font-data text-sm text-muted-foreground">
              AUH-10233 · AED 1.02/km
            </div>
          </SignalCard>
          <SignalCard tone="signal">
            <div className="eyebrow">Selected</div>
            <div className="mt-1 font-semibold">Toyota Hiace</div>
            <div className="font-data text-sm text-muted-foreground">
              DXB-55102 · AED 0.71/km
            </div>
          </SignalCard>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="eyebrow mb-3">
            Availability strip — berth occupancy
          </div>
          <AvailabilityStrip
            slots={stripSlots}
            ticks={['06:00', '10:00', '14:00', '18:00']}
          />
        </div>
      </Section>

      {/* Registers */}
      <Section label={t('showcase.registers')}>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Calm */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="eyebrow mb-3">Calm</div>
            <SignalCard tone="brand" className="shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Toyota Camry</div>
                  <div className="font-data text-xs text-muted-foreground">
                    DXB-30541
                  </div>
                </div>
                <StatusChip tone="ok" label="Available" />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" /> 5 seats
                </span>
                <span className="inline-flex items-center gap-1">
                  <Fuel className="size-3.5" /> Petrol
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> Yard A · 80m
                </span>
              </div>
              <Button className="mt-4 w-full" size="sm">
                Select <ArrowRight className="size-4" />
              </Button>
            </SignalCard>
          </div>

          {/* Operational */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="eyebrow mb-3">Operational</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Land Cruiser</TableCell>
                  <TableCell className="font-data">DXB-42198</TableCell>
                  <TableCell>
                    <StatusChip tone="ok" label="On trip" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Patrol</TableCell>
                  <TableCell className="font-data">AUH-10233</TableCell>
                  <TableCell>
                    <StatusChip tone="warn" label="Buffer" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Hiace</TableCell>
                  <TableCell className="font-data">DXB-55102</TableCell>
                  <TableCell>
                    <StatusChip tone="danger" label="Maint." />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Cinematic */}
          <div className="rounded-xl border border-brand bg-brand p-5 text-brand-foreground">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-brand-foreground/70">
              Cinematic
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="font-data text-3xl font-bold">AED 1.84</div>
                <div className="text-sm text-brand-foreground/70">
                  Cost / km — down 6.2%
                </div>
              </div>
              <div>
                <div className="font-data text-3xl font-bold">100%</div>
                <div className="text-sm text-brand-foreground/70">
                  Fines attributed this month
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Feedback */}
      <Section label="Feedback">
        <div className="space-y-6">
          <div>
            <div className="eyebrow mb-3">Toasts</div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  notify.ok('Booking confirmed', {
                    description: 'WF-482910 is on your calendar.',
                  })
                }
              >
                OK toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  notify.warn('Insurance expires in 9 days', {
                    description: 'Renew before 18 Jul.',
                  })
                }
              >
                Warn toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  notify.danger('Booking blocked', {
                    description: 'Licence expired 12 Mar.',
                    action: { label: 'Renew', onClick: () => undefined },
                  })
                }
              >
                Danger toast
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  notify.info('3 approvals pending', {
                    description: 'Routed to your inbox.',
                  })
                }
              >
                Info toast
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Alert tone="ok">
              <CheckCircle2 />
              <AlertTitle>Compliant</AlertTitle>
              <AlertDescription>Licence valid to Feb 2027.</AlertDescription>
            </Alert>
            <Alert tone="warn">
              <AlertTriangle />
              <AlertTitle>Insurance expiring</AlertTitle>
              <AlertDescription>Renew within 9 days.</AlertDescription>
            </Alert>
            <Alert tone="danger">
              <XCircle />
              <AlertTitle>Booking blocked — licence expired</AlertTitle>
              <AlertDescription>
                Renew with HR, then try again. Blocks name the cause and the
                next action.
              </AlertDescription>
            </Alert>
            <Alert tone="info">
              <Info />
              <AlertTitle>Pending approval</AlertTitle>
              <AlertDescription>Awaiting your line manager.</AlertDescription>
            </Alert>
          </div>

          <Banner
            tone="warn"
            icon={AlertTriangle}
            title="One fine needs your attention"
            description="Transfer the black points by 18 Jul — bookings are blocked after that date."
            action={
              <Button size="sm" variant="signal">
                Start transfer
              </Button>
            }
            onDismiss={() => undefined}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="eyebrow">Progress</div>
              <Progress value={64} label="Upload" />
              <Progress value={null} tone="warn" label="Working" />
              <div className="flex items-center gap-2 pt-1">
                <Spinner label="Loading" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            </div>
            <EmptyState
              icon={Inbox}
              title="No bookings yet"
              description="Your upcoming trips will appear here."
              action={<Button size="sm">Book a vehicle</Button>}
            />
          </div>

          <CardSkeleton />
        </div>
      </Section>

      {/* Overlays */}
      <Section label="Overlays">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="destructive" onClick={handleConfirm}>
            Decline (confirm)
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="text-sm font-semibold">Quick filter</div>
              <p className="mt-1 text-sm text-muted-foreground">
                A non-modal panel on a token surface, RTL-aware.
              </p>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>View details</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost">Hover me</Button>
            </HoverCardTrigger>
            <HoverCardContent>
              <div className="text-sm font-semibold">Amina Khoury</div>
              <p className="text-sm text-muted-foreground">
                EMP-20481 · GS Pool
              </p>
            </HoverCardContent>
          </HoverCard>

          <span className="text-sm text-muted-foreground">
            …or press{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 text-[11px]">
              Ctrl/⌘ K
            </kbd>
          </span>
        </div>
      </Section>

      {/* Forms */}
      <Section label="Forms">
        <ReferenceForm />
      </Section>

      {/* Data display */}
      <Section label="Data display">
        <DataDemo />
      </Section>

      {/* Charts */}
      <Section label="Charts">
        <ChartsDemo />
      </Section>
    </div>
  )
}
