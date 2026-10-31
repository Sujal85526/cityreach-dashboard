import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  axisProps,
  ChartTooltip,
  chartMargin,
  Gradient,
  gridProps,
} from '@/components/charts/chart-kit'

/** Average staff score per week (prototype "Performance trend", 8 weeks). */
export function TrendChart({ data }: { data: { label: string; score: number | null }[] }) {
  const id = useId().replace(/:/g, '')
  if (data.every((d) => d.score === null))
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No weekly scores yet. They appear after the first daily calculation.
      </p>
    )
  return (
    <div className="h-56" role="img" aria-label="Average performance score over the last 8 weeks">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ ...chartMargin, right: 14 }}>
          <defs>
            <Gradient id={`${id}-area`} color="var(--chart-1)" from={0.32} to={0} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis domain={[0, 100]} {...axisProps} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)' }} />
          <Area
            type="monotone"
            dataKey="score"
            name="Avg score"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill={`url(#${id}-area)`}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
            connectNulls
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
