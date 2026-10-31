import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  axisProps,
  ChartLegend,
  ChartTooltip,
  chartMargin,
  Gradient,
  gridProps,
} from '@/components/charts/chart-kit'

export interface WeekPoint {
  day: string
  onTime: number
  late: number
  absent: number
}

const SERIES = [
  { key: 'onTime', name: 'On time', color: 'var(--chart-1)' },
  { key: 'late', name: 'Late', color: 'var(--chart-3)' },
  { key: 'absent', name: 'Absent', color: 'var(--chart-4)' },
] as const

/** Stacked bars of the past 7 days (prototype "Attendance summary"). */
export function WeekChart({ data }: { data: WeekPoint[] }) {
  const id = useId().replace(/:/g, '')
  return (
    <div>
      <div className="h-60" role="img" aria-label="Attendance over the past 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargin} barCategoryGap="28%">
            <defs>
              {SERIES.map((s) => (
                <Gradient key={s.key} id={`${id}-${s.key}`} color={s.color} from={1} to={0.7} />
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<ChartTooltip />} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="a"
                fill={`url(#${id}-${s.key})`}
                radius={i === SERIES.length - 1 ? [6, 6, 0, 0] : 0}
                maxBarSize={34}
                animationDuration={700}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={SERIES.map((s) => ({ name: s.name, color: s.color }))} />
    </div>
  )
}
