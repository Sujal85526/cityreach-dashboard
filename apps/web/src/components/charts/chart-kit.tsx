import type { ReactNode } from 'react'

/** Shared look for every chart: quiet axes, soft grid, gradient fills, tidy tooltip and legend. */
export const axisProps = {
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  tickMargin: 8,
  stroke: 'var(--muted-foreground)',
} as const

export const gridProps = {
  vertical: false,
  stroke: 'var(--chart-grid)',
  strokeDasharray: '3 5',
} as const

export const chartMargin = { top: 8, right: 8, bottom: 0, left: -18 }

/** Vertical fade of one colour; reference it with fill={`url(#${id})`}. */
export function Gradient({ id, color, from = 0.95, to = 0.55 }: GradientProps) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  )
}
interface GradientProps {
  id: string
  color: string
  from?: number
  to?: number
}

interface TooltipEntry {
  name?: string | number
  value?: string | number
  color?: string
  dataKey?: string | number
}

/** Rounded card tooltip with a colour dot per series. */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormat,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: ReactNode
  valueFormat?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-32 rounded-xl border bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur">
      {label !== undefined && <p className="mb-1.5 font-medium text-foreground">{label}</p>}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ background: p.color }}
              aria-hidden
            />
            <span className="flex-1">{p.name}</span>
            <span className="font-medium text-foreground tabular-nums">
              {typeof p.value === 'number' && valueFormat ? valueFormat(p.value) : p.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Legend row under the chart (replaces Recharts' default). */
export function ChartLegend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.name}
        </li>
      ))}
    </ul>
  )
}
