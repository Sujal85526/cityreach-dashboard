import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/** Tasks due each of the past 7 days: completed vs still open (prototype "Task completion"). */
export function TaskWeekChart({
  data,
  pendingLabel = 'Not completed',
}: {
  data: { day: string; completed: number; pending: number }[]
  /** "Missed" in reports (shown in red); "Not completed" on the dashboard. */
  pendingLabel?: string
}) {
  return (
    <div className="h-56" role="img" aria-label="Task completion over the past 7 days">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="completed"
            name="Completed"
            fill="var(--success)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="pending"
            name={pendingLabel}
            fill={pendingLabel === 'Missed' ? 'var(--danger)' : 'var(--info)'}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
