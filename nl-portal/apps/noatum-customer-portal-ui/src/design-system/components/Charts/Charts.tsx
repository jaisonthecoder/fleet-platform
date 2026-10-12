import { useId, type ReactNode } from 'react';

import { cn } from '../../utils';
import styles from './Charts.module.css';

/* ============================================================================
 * DA-10 · The chart kit.
 *
 * Plain inline SVG, no charting library. Three reasons, in order of how much
 * they matter here:
 *
 *  1. Colour. Every chart library wants its palette as hex in JavaScript, and
 *     this product's rule is that a colour comes from tokens.css or it does not
 *     exist. These read `var(--noa-chart-n)` like everything else, so a brand
 *     change is a token change rather than a sweep through chart configs.
 *  2. Weight. The dashboard draws nine charts; a library would add more to the
 *     bundle than the whole feature.
 *  3. Honesty. Every chart here carries the same visually hidden table of its
 *     own numbers. A canvas or an SVG path announces nothing, and a dashboard
 *     that cannot be read without seeing it is not accessible - it is decorative.
 *
 * Shared conventions, so nine charts read as one system:
 *   - a fixed viewBox scaled by CSS, so the type never resizes with the panel;
 *   - the plot is inset by PAD, and axis labels live outside it;
 *   - no gradients, no animation, no drop shadows;
 *   - the caller formats every number, because rounding and locale belong to
 *     whoever owns the figure, not to the thing drawing it.
 * ========================================================================== */

/** The one accessible fallback every chart owes. */
function DataTable({
  id,
  label,
  columns,
  rows,
}: {
  id: string;
  label: string;
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <table className="noa-visually-hidden" id={id}>
      <caption>{label}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A "nice" axis maximum, so ticks land on readable numbers. */
function ceilNice(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = value / magnitude;
  const rounded = step <= 1 ? 1 : step <= 2 ? 2 : step <= 2.5 ? 2.5 : step <= 5 ? 5 : 10;
  return rounded * magnitude;
}

export interface ChartLegendItem {
  label: string;
  /** A `--noa-chart-*` token reference, or any token the caller owns. */
  colour: string;
  /** Drawn as a line rather than a swatch, for a series that is one. */
  line?: boolean;
}

export function ChartLegend({ items }: { items: readonly ChartLegendItem[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={item.line ? styles.legendLine : styles.legendSwatch}
            style={{ background: item.colour }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* ── stacked columns with a line over them ─────────────────────────────── */

export interface BarLineSeries {
  key: string;
  label: string;
  colour: string;
  values: readonly number[];
}

export interface BarLineChartProps {
  /** One per column, e.g. "OCT". A second line can be passed as "OCT\n2025". */
  labels: readonly string[];
  /** Stacked bottom-first. */
  series: readonly BarLineSeries[];
  /** The overlaid line, on its own right-hand axis. */
  line?: { label: string; colour: string; values: readonly number[]; format: (value: number) => string };
  /** Names the chart. Required: an unlabelled chart is unreadable without sight. */
  chartLabel: string;
  formatBar?: (value: number) => string;
  className?: string;
}

const PAD = { top: 12, right: 46, bottom: 26, left: 34 };
const BOX = { width: 720, height: 260 };

export function BarLineChart({
  labels,
  series,
  line,
  chartLabel,
  formatBar = (value) => String(value),
  className,
}: BarLineChartProps) {
  const tableId = useId();
  const columns = labels.length;
  const totals = labels.map((_, index) =>
    series.reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0),
  );
  const barMax = ceilNice(Math.max(1, ...totals));
  const lineMax = ceilNice(Math.max(1, ...(line?.values ?? [1])));

  const plotWidth = BOX.width - PAD.left - PAD.right;
  const plotHeight = BOX.height - PAD.top - PAD.bottom;
  const step = plotWidth / Math.max(1, columns);
  const barWidth = Math.min(30, step * 0.54);
  const x = (index: number) => PAD.left + step * index + step / 2;
  const y = (value: number, max: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  const ticks = [0, 0.5, 1];

  return (
    <div className={cn(styles.chart, className)}>
      <svg viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-labelledby={tableId}>
        {ticks.map((ratio) => (
          <g key={ratio}>
            <line
              className={styles.grid}
              x1={PAD.left}
              x2={BOX.width - PAD.right}
              y1={y(barMax * ratio, barMax)}
              y2={y(barMax * ratio, barMax)}
            />
            <text className={styles.axis} x={PAD.left - 8} y={y(barMax * ratio, barMax) + 3} textAnchor="end">
              {formatBar(barMax * ratio)}
            </text>
            {line && (
              <text
                className={styles.axisRight}
                x={BOX.width - PAD.right + 8}
                y={y(lineMax * ratio, lineMax) + 3}
              >
                {line.format(lineMax * ratio)}
              </text>
            )}
          </g>
        ))}

        {labels.map((label, index) => {
          let base = 0;
          return (
            <g key={label + index}>
              {series.map((entry) => {
                const value = entry.values[index] ?? 0;
                const top = y(base + value, barMax);
                const height = y(base, barMax) - top;
                base += value;
                return height <= 0 ? null : (
                  <rect
                    key={entry.key}
                    x={x(index) - barWidth / 2}
                    y={top}
                    width={barWidth}
                    height={height}
                    fill={entry.colour}
                  />
                );
              })}
              {label.split('\n').map((part, partIndex) => (
                <text
                  key={part + partIndex}
                  className={styles.axis}
                  x={x(index)}
                  y={BOX.height - PAD.bottom + 14 + partIndex * 10}
                  textAnchor="middle"
                >
                  {part}
                </text>
              ))}
            </g>
          );
        })}

        {line && (
          <>
            <polyline
              className={styles.line}
              stroke={line.colour}
              points={line.values
                .map((value, index) => `${x(index)},${y(value, lineMax)}`)
                .join(' ')}
            />
            {line.values.map((value, index) => (
              <circle
                key={index}
                cx={x(index)}
                cy={y(value, lineMax)}
                r="3.2"
                fill="var(--surface-card)"
                stroke={line.colour}
                strokeWidth="2"
              />
            ))}
          </>
        )}
      </svg>

      <DataTable
        id={tableId}
        label={chartLabel}
        columns={['Month', ...series.map((entry) => entry.label), ...(line ? [line.label] : [])]}
        rows={labels.map((label, index) => [
          label.replace('\n', ' '),
          ...series.map((entry) => formatBar(entry.values[index] ?? 0)),
          ...(line ? [line.format(line.values[index] ?? 0)] : []),
        ])}
      />
    </div>
  );
}

/* ── donut ─────────────────────────────────────────────────────────────── */

export interface DonutSlice {
  key: string;
  label: string;
  colour: string;
  value: number;
}

export function DonutChart({
  slices,
  centreValue,
  centreLabel,
  chartLabel,
  format = (value) => String(value),
  className,
}: {
  slices: readonly DonutSlice[];
  centreValue: ReactNode;
  centreLabel: ReactNode;
  chartLabel: string;
  format?: (value: number) => string;
  className?: string;
}) {
  const tableId = useId();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn(styles.donut, className)}>
      <svg viewBox="0 0 160 160" role="img" aria-labelledby={tableId}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--noa-chart-track)" strokeWidth="22" />
        {total > 0 &&
          slices.map((slice) => {
            const length = (slice.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const element = (
              <circle
                key={slice.key}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={slice.colour}
                strokeWidth="22"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                // From twelve o'clock, like every other dial in the kit.
                transform="rotate(-90 80 80)"
              />
            );
            offset += length;
            return element;
          })}
        <text className={styles.donutValue} x="80" y="76" textAnchor="middle">
          {centreValue}
        </text>
        <text className={styles.donutLabel} x="80" y="94" textAnchor="middle">
          {centreLabel}
        </text>
      </svg>

      <DataTable
        id={tableId}
        label={chartLabel}
        columns={['Series', 'Value', 'Share']}
        rows={slices.map((slice) => [
          slice.label,
          format(slice.value),
          total === 0 ? '0%' : `${Math.round((slice.value / total) * 100)}%`,
        ])}
      />
    </div>
  );
}

/* ── a line against a target ───────────────────────────────────────────── */

export function TrendLine({
  labels,
  values,
  target,
  targetLabel,
  chartLabel,
  format = (value) => `${value}%`,
  min = 60,
  max = 100,
  className,
}: {
  labels: readonly string[];
  values: readonly number[];
  target?: number;
  targetLabel?: string;
  chartLabel: string;
  format?: (value: number) => string;
  min?: number;
  max?: number;
  className?: string;
}) {
  const tableId = useId();
  const pad = { top: 14, right: 46, bottom: 24, left: 34 };
  const box = { width: 560, height: 220 };
  const plotWidth = box.width - pad.left - pad.right;
  const plotHeight = box.height - pad.top - pad.bottom;
  const x = (index: number) =>
    pad.left + (plotWidth / Math.max(1, values.length - 1)) * index;
  const y = (value: number) =>
    pad.top + plotHeight - ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * plotHeight;

  return (
    <div className={cn(styles.chart, className)}>
      <svg viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-labelledby={tableId}>
        {[min, (min + max) / 2, max].map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={pad.left} x2={box.width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className={styles.axis} x={pad.left - 8} y={y(tick) + 3} textAnchor="end">
              {format(tick)}
            </text>
          </g>
        ))}

        {/* The band under the line, so "above target" reads as an area rather
            than as a set of dots you have to compare one by one. */}
        <polygon
          className={styles.area}
          points={`${x(0)},${y(min)} ${values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} ${x(values.length - 1)},${y(min)}`}
        />

        {target !== undefined && (
          <>
            <line
              className={styles.target}
              x1={pad.left}
              x2={box.width - pad.right}
              y1={y(target)}
              y2={y(target)}
            />
            {targetLabel && (
              <text className={styles.targetLabel} x={box.width - pad.right + 6} y={y(target) + 3}>
                {targetLabel}
              </text>
            )}
          </>
        )}

        <polyline
          className={styles.line}
          stroke="var(--noa-chart-1)"
          points={values.map((value, index) => `${x(index)},${y(value)}`).join(' ')}
        />
        {values.map((value, index) => (
          <circle
            key={index}
            cx={x(index)}
            cy={y(value)}
            r="3.4"
            fill="var(--surface-card)"
            // Colour is not the only signal: a point below target also sits
            // visibly under the dashed rule that crosses the whole chart.
            stroke={target !== undefined && value < target ? 'var(--color-primary)' : 'var(--noa-chart-target)'}
            strokeWidth="2"
          />
        ))}

        {labels.map((label, index) => (
          <text
            key={label + index}
            className={styles.axis}
            x={x(index)}
            y={box.height - pad.bottom + 14}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>

      <DataTable
        id={tableId}
        label={chartLabel}
        columns={['Month', 'Value']}
        rows={labels.map((label, index) => [label, format(values[index] ?? 0)])}
      />
    </div>
  );
}

/* ── quoted window against what happened ───────────────────────────────── */

export interface RangeRow {
  key: string;
  label: string;
  quotedMin: number;
  quotedMax: number;
  actualMin: number;
  actualMax: number;
  average: number;
  /** Already formatted, e.g. "31.6 d". */
  value: string;
}

export function RangeBars({
  rows,
  chartLabel,
  axisLabel,
  className,
}: {
  rows: readonly RangeRow[];
  chartLabel: string;
  axisLabel?: (value: number) => string;
  className?: string;
}) {
  const tableId = useId();
  const max = ceilNice(Math.max(1, ...rows.map((row) => Math.max(row.actualMax, row.quotedMax))));
  const format = axisLabel ?? ((value: number) => String(Math.round(value)));

  return (
    <div className={cn(styles.ranges, className)}>
      <div className={styles.rangeGrid}>
        {rows.map((row) => (
          <div className={styles.rangeRow} key={row.key}>
            <span className={styles.rangeLabel}>{row.label}</span>
            <span className={styles.rangeTrack}>
              {/* The quote is drawn as an outline and the outcome as a solid
                  bar: the customer was promised a window, and what matters is
                  whether reality sat inside it. */}
              <span
                className={styles.rangeQuoted}
                style={{
                  insetInlineStart: `${(row.quotedMin / max) * 100}%`,
                  inlineSize: `${((row.quotedMax - row.quotedMin) / max) * 100}%`,
                }}
              />
              <span
                className={styles.rangeActual}
                style={{
                  insetInlineStart: `${(row.actualMin / max) * 100}%`,
                  inlineSize: `${((row.actualMax - row.actualMin) / max) * 100}%`,
                }}
              />
              <span className={styles.rangeDot} style={{ insetInlineStart: `${(row.average / max) * 100}%` }} />
            </span>
            <span className={styles.rangeValue}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className={styles.rangeAxis} aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <span key={ratio}>{format(max * ratio)}</span>
        ))}
      </div>

      <DataTable
        id={tableId}
        label={chartLabel}
        columns={['Lane', 'Quoted', 'Actual', 'Average']}
        rows={rows.map((row) => [
          row.label,
          `${row.quotedMin} to ${row.quotedMax}`,
          `${row.actualMin} to ${row.actualMax}`,
          row.value,
        ])}
      />
    </div>
  );
}

/* ── plain columns ─────────────────────────────────────────────────────── */

export function ColumnBars({
  labels,
  values,
  colour = 'var(--noa-chart-1)',
  chartLabel,
  format = (value) => String(value),
  showValues = false,
  className,
}: {
  labels: readonly string[];
  values: readonly number[];
  colour?: string;
  chartLabel: string;
  format?: (value: number) => string;
  /** Prints each column's figure above it. For a short series only. */
  showValues?: boolean;
  className?: string;
}) {
  const tableId = useId();
  const max = Math.max(1, ...values);

  return (
    <div className={cn(styles.columns, className)}>
      <div className={styles.columnRow} aria-hidden="true">
        {values.map((value, index) => (
          <span className={styles.column} key={index}>
            {showValues && <span className={styles.columnValue}>{format(value)}</span>}
            <span
              className={styles.columnFill}
              style={{ blockSize: `${Math.max(2, (value / max) * 100)}%`, background: colour }}
            />
            <span className={styles.columnLabel}>{labels[index]}</span>
          </span>
        ))}
      </div>

      <DataTable
        id={tableId}
        label={chartLabel}
        columns={['Bucket', 'Value']}
        rows={labels.map((label, index) => [label, format(values[index] ?? 0)])}
      />
    </div>
  );
}

/* ── one bar, several parts ────────────────────────────────────────────── */

export interface SplitPart {
  key: string;
  label: string;
  colour: string;
  value: number;
}

export function SplitBar({
  parts,
  chartLabel,
  format = (value) => String(value),
  className,
}: {
  parts: readonly SplitPart[];
  chartLabel: string;
  format?: (value: number) => string;
  className?: string;
}) {
  const tableId = useId();
  const total = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <div className={cn(styles.split, className)}>
      <div className={styles.splitBar} aria-hidden="true">
        {parts.map((part) => (
          <span
            key={part.key}
            className={styles.splitPart}
            style={{
              inlineSize: total === 0 ? '0%' : `${(part.value / total) * 100}%`,
              background: part.colour,
            }}
          />
        ))}
      </div>

      <DataTable
        id={tableId}
        label={chartLabel}
        columns={['Part', 'Value', 'Share']}
        rows={parts.map((part) => [
          part.label,
          format(part.value),
          total === 0 ? '0%' : `${Math.round((part.value / total) * 100)}%`,
        ])}
      />
    </div>
  );
}

/* ── a bar inside a table cell ─────────────────────────────────────────── */

export function MeterCell({
  ratio,
  label,
  tone = 'neutral',
}: {
  /** 0–1. Clamped, because a ratio over one draws outside the cell. */
  ratio: number;
  label: ReactNode;
  tone?: 'good' | 'warning' | 'bad' | 'neutral';
}) {
  return (
    <span className={styles.meter}>
      <span className={styles.meterTrack} aria-hidden="true">
        <span
          className={styles.meterFill}
          data-tone={tone}
          style={{ inlineSize: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </span>
      <span className={styles.meterLabel} data-tone={tone}>
        {label}
      </span>
    </span>
  );
}

/* ── the small line inside a table cell ────────────────────────────────── */

export function MiniLine({ values, label }: { values: readonly number[]; label: string }) {
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 22 - ((value - min) / Math.max(1, max - min)) * 20;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className={styles.mini} viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline className={styles.miniLine} points={points} />
    </svg>
  );
}
