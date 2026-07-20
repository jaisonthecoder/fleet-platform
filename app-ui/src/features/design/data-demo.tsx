import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { StatusChip } from '@/components/ui/status-chip'
import { StatCard, DescriptionList } from '@/components/patterns/stat-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CarFront, Gauge, ShieldAlert } from 'lucide-react'

interface Vehicle {
  model: string
  plate: string
  pool: string
  status: 'ok' | 'warn' | 'danger'
  statusLabel: string
}

const vehicles: Vehicle[] = [
  {
    model: 'Toyota Land Cruiser',
    plate: 'AD 40213',
    pool: 'GS Pool',
    status: 'ok',
    statusLabel: 'Active',
  },
  {
    model: 'Nissan Patrol',
    plate: 'AD 88914',
    pool: 'GS Pool',
    status: 'warn',
    statusLabel: 'Insurance 9d',
  },
  {
    model: 'Toyota Hiace',
    plate: 'AD 55102',
    pool: 'Kezad',
    status: 'danger',
    statusLabel: 'Maintenance',
  },
  {
    model: 'Kia EV6',
    plate: 'AD 90044',
    pool: 'GS Pool',
    status: 'ok',
    statusLabel: 'Active',
  },
  {
    model: 'Toyota Corolla',
    plate: 'AD 77120',
    pool: 'Khalifa',
    status: 'warn',
    statusLabel: 'Fuel variance',
  },
  {
    model: 'Nissan Patrol',
    plate: 'AD 51002',
    pool: 'Zayed',
    status: 'danger',
    statusLabel: 'Maint. flag',
  },
  {
    model: 'Toyota Fortuner',
    plate: 'AD 33190',
    pool: 'Logistics',
    status: 'ok',
    statusLabel: 'Dedicated',
  },
  {
    model: 'Toyota Hiace',
    plate: 'AD 24410',
    pool: 'Zayed',
    status: 'danger',
    statusLabel: 'Insurance 7d',
  },
]

const columns: ColumnDef<Vehicle>[] = [
  { accessorKey: 'model', header: 'Vehicle' },
  {
    accessorKey: 'plate',
    header: 'Plate',
    cell: ({ row }) => (
      <span className="font-data">{row.getValue('plate')}</span>
    ),
    enableSorting: false,
  },
  { accessorKey: 'pool', header: 'Pool' },
  {
    id: 'status',
    header: 'State',
    enableSorting: false,
    cell: ({ row }) => (
      <StatusChip tone={row.original.status} label={row.original.statusLabel} />
    ),
  },
]

/** Data-display showcase: KPI cards, data table, tabs, accordion, avatar, description list. */
export function DataDemo() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Group utilisation"
          value="78.2%"
          delta="4.1 pts vs Q2"
          deltaTone="ok"
          icon={Gauge}
          iconTone="brand"
        />
        <StatCard
          label="Cost per km"
          value="AED 1.84"
          delta="7.4% trailing 6 mo"
          deltaTone="ok"
          icon={CarFront}
          iconTone="info"
        />
        <StatCard
          label="Open risk items"
          value="3"
          sublabel="1 this week"
          icon={ShieldAlert}
          iconTone="danger"
        />
      </div>

      <DataTable
        columns={columns}
        data={vehicles}
        searchPlaceholder="Search vehicles…"
        pageSize={5}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          <TabsContent
            value="upcoming"
            className="text-sm text-muted-foreground"
          >
            Two upcoming trips.
          </TabsContent>
          <TabsContent value="active" className="text-sm text-muted-foreground">
            One active trip.
          </TabsContent>
          <TabsContent value="past" className="text-sm text-muted-foreground">
            14 past trips this quarter.
          </TabsContent>
        </Tabs>

        <div className="rounded-[3px] border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-3">
            <Avatar>
              <AvatarFallback>AK</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-bold">Amina Khoury</div>
              <div className="text-xs text-ink-3">EMP-20481 · GS Pool</div>
            </div>
          </div>
          <DescriptionList
            items={[
              { label: 'Vehicle', value: 'Nissan Patrol · AD 88914' },
              {
                label: 'Window',
                value: <span className="font-data">09:00 → 15:00</span>,
              },
              { label: 'Destination', value: 'Khalifa Port Gate 4' },
            ]}
          />
        </div>
      </div>

      <Accordion
        type="single"
        collapsible
        className="rounded-[3px] border border-border bg-card px-4"
      >
        <AccordionItem value="policy">
          <AccordionTrigger>What is a hard block?</AccordionTrigger>
          <AccordionContent>
            A hard block denies booking with no override — expired Mulkiya or
            insurance. It names the cause and the next action.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="consent" className="border-b-0">
          <AccordionTrigger>When is re-consent required?</AccordionTrigger>
          <AccordionContent>
            Changing the vehicle category or driver requires re-consent before
            submission.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
