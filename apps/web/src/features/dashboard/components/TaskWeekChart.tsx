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

/** Tasks due each of the past 7 days: completed vs still open (prototype "Task completion"). */
export function TaskWeekChart({
  data,
  pendingLabel = 'Not completed',
}: {
  data: { day: string; completed: number; pending: number }[]
  /** "Missed" in reports (shown in a warm clay tone); "Not completed" on the dashboard. */
  pendingLabel?: string
}) {
  const id = useId().replace(/:/g, '')
  const pendingColor = pendingLabel === 'Missed' ? 'var(--chart-4)' : 'var(--chart-3)'
  return (
    <div>
      <div className="h-52" role="img" aria-label="Task completion over the past 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargin} barGap={3}>
            <defs>
              <Gradient id={`${id}-done`} color="var(--chart-1)" from={1} to={0.86} />
              <Gradient id={`${id}-open`} color={pendingColor} from={1} to={0.84} />
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<ChartTooltip />} />
            <Bar
              dataKey="completed"
              name="Completed"
              fill={`url(#${id}-done)`}
              radius={[6, 6, 0, 0]}
              barSize={11}
              animationDuration={700}
            />
            <Bar
              dataKey="pending"
              name={pendingLabel}
              fill={`url(#${id}-open)`}
              radius={[6, 6, 0, 0]}
              barSize={11}
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { name: 'Completed', color: 'var(--chart-1)' },
          { name: pendingLabel, color: pendingColor },
        ]}
      />
    </div>
  )
}
