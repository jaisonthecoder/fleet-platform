import {
  BarChart,
  ChartFrame,
  Donut,
  HBars,
  KpiSparkline,
} from '@/components/charts'

const utilisation = [
  { cluster: 'Ports', util: 84 },
  { cluster: 'Economic Cities', util: 79 },
  { cluster: 'Maritime', util: 71 },
  { cluster: 'Logistics', util: 76 },
  { cluster: 'Digital', util: 62 },
]

const costPerKm = [
  { m: 'Feb', cost: 2.09 },
  { m: 'Mar', cost: 2.02 },
  { m: 'Apr', cost: 1.97 },
  { m: 'May', cost: 1.93 },
  { m: 'Jun', cost: 1.88 },
  { m: 'Jul', cost: 1.84 },
]

const spend = [
  { name: 'Fuel', value: 38 },
  { name: 'Maintenance', value: 24 },
  { name: 'Leasing', value: 22 },
  { name: 'Fines', value: 6 },
  { name: 'Other', value: 10 },
]

const bookings = [
  { d: 'Mon', n: 42 },
  { d: 'Tue', n: 51 },
  { d: 'Wed', n: 47 },
  { d: 'Thu', n: 63 },
  { d: 'Fri', n: 58 },
  { d: 'Sat', n: 24 },
  { d: 'Sun', n: 19 },
]

/** Executive-dashboard chart set rendered with the themed Recharts wrappers. */
export function ChartsDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartFrame
        title="Utilisation by cluster"
        description="Target ≥ 75%"
        data={utilisation}
        columns={[
          { key: 'cluster', label: 'Cluster' },
          { key: 'util', label: 'Utilisation %' },
        ]}
      >
        <HBars
          data={utilisation}
          categoryKey="cluster"
          dataKey="util"
          target={75}
          targetLabel="Target"
        />
      </ChartFrame>

      <ChartFrame
        title="Cost per km"
        description="Trailing 6 months · AED"
        data={costPerKm}
        columns={[
          { key: 'm', label: 'Month' },
          { key: 'cost', label: 'AED / km' },
        ]}
      >
        <BarChart data={costPerKm} xKey="m" dataKey="cost" highlightLast />
      </ChartFrame>

      <ChartFrame
        title="Spend composition"
        description="This quarter"
        data={spend}
        columns={[
          { key: 'name', label: 'Category' },
          { key: 'value', label: 'Share %' },
        ]}
      >
        <Donut data={spend} nameKey="name" dataKey="value" />
      </ChartFrame>

      <ChartFrame
        title="Bookings, last 7 days"
        description="Daily count"
        data={bookings}
        columns={[
          { key: 'd', label: 'Day' },
          { key: 'n', label: 'Bookings' },
        ]}
      >
        <KpiSparkline data={bookings} dataKey="n" tone="brand" height={140} />
      </ChartFrame>
    </div>
  )
}
