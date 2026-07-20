import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useChartTheme } from './chart-theme'

type Datum = Record<string, string | number>

interface ChartColumn {
  key: string
  label: string
}

interface ChartFrameProps {
  title: string
  description?: string
  data: Datum[]
  columns: ChartColumn[]
  className?: string
  children: React.ReactNode
}

/**
 * Wraps a chart with a visible caption and a visually-hidden data table so the
 * canvas/SVG has a semantic equivalent (adp-data-chartjs governance).
 */
export function ChartFrame({
  title,
  description,
  data,
  columns,
  className,
  children,
}: ChartFrameProps) {
  return (
    <figure
      className={cn(
        'rounded-[3px] border border-border bg-card p-4',
        className,
      )}
    >
      <figcaption className="mb-3">
        <div className="text-base font-bold text-foreground">{title}</div>
        {description ? (
          <div className="text-xs text-ink-3">{description}</div>
        ) : null}
      </figcaption>
      <div aria-hidden="true">{children}</div>
      <table className="sr-only" aria-label={title}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{String(row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function useTooltipStyle() {
  const theme = useChartTheme()
  return {
    contentStyle: {
      background: theme.surface,
      border: `1px solid ${theme.grid}`,
      borderRadius: 3,
      fontFamily: theme.fontFamily,
      fontSize: 12,
      color: theme.ink,
    },
    labelStyle: { color: theme.axis },
    itemStyle: { color: theme.ink },
  }
}

interface SparklineProps {
  data: Datum[]
  dataKey: string
  tone?: 'brand' | 'signal' | 'ok' | 'warn' | 'danger' | 'info'
  height?: number
}

/** Tiny axis-less trend line for KPI cells. */
export function KpiSparkline({
  data,
  dataKey,
  tone = 'brand',
  height = 44,
}: SparklineProps) {
  const theme = useChartTheme()
  const color = theme[tone]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface BarChartProps {
  data: Datum[]
  xKey: string
  dataKey: string
  height?: number
  /** Highlight the last bar in signal gold (e.g. the current month). */
  highlightLast?: boolean
  /** Draw a horizontal target reference line. */
  target?: number
  targetLabel?: string
}

/** Vertical bar trend (e.g. cost per km by month). */
export function BarChart({
  data,
  xKey,
  dataKey,
  height = 220,
  highlightLast = false,
  target,
  targetLabel,
}: BarChartProps) {
  const theme = useChartTheme()
  const tip = useTooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
      >
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={{
            fill: theme.axis,
            fontSize: 11,
            fontFamily: theme.fontFamily,
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{
            fill: theme.axis,
            fontSize: 11,
            fontFamily: theme.fontFamily,
          }}
        />
        <Tooltip cursor={{ fill: theme.grid }} {...tip} />
        {target != null ? (
          <ReferenceLine
            y={target}
            stroke={theme.signal}
            strokeDasharray="4 4"
            label={{ value: targetLabel, fill: theme.axis, fontSize: 11 }}
          />
        ) : null}
        <Bar dataKey={dataKey} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={
                highlightLast && i === data.length - 1
                  ? theme.signal
                  : theme.brand
              }
            />
          ))}
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  )
}

interface HBarsProps {
  data: Datum[]
  categoryKey: string
  dataKey: string
  height?: number
  target?: number
  targetLabel?: string
}

/** Horizontal bars with an optional target line (e.g. utilisation by cluster). */
export function HBars({
  data,
  categoryKey,
  dataKey,
  height = 240,
  target,
  targetLabel,
}: HBarsProps) {
  const theme = useChartTheme()
  const tip = useTooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid horizontal={false} stroke={theme.grid} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{
            fill: theme.axis,
            fontSize: 11,
            fontFamily: theme.fontFamily,
          }}
        />
        <YAxis
          type="category"
          dataKey={categoryKey}
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fill: theme.ink, fontSize: 12, fontFamily: theme.fontFamily }}
        />
        <Tooltip cursor={{ fill: theme.grid }} {...tip} />
        {target != null ? (
          <ReferenceLine
            x={target}
            stroke={theme.signal}
            strokeDasharray="4 4"
            label={{ value: targetLabel, fill: theme.axis, fontSize: 11 }}
          />
        ) : null}
        <Bar
          dataKey={dataKey}
          radius={[0, 3, 3, 0]}
          fill={theme.brand}
          isAnimationActive={false}
        />
      </RBarChart>
    </ResponsiveContainer>
  )
}

interface DonutProps {
  data: Datum[]
  nameKey: string
  dataKey: string
  height?: number
}

/** Composition donut (e.g. spend by category). */
export function Donut({ data, nameKey, dataKey, height = 220 }: DonutProps) {
  const theme = useChartTheme()
  const tip = useTooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip {...tip} />
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={dataKey}
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke={theme.surface}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={theme.palette[i % theme.palette.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}
