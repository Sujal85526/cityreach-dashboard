import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/** Average staff score per week (prototype "Performance trend", 8 weeks). */
export function TrendChart({ data }: { data: { label: string; score: number | null }[] }) {
  if (data.every((d) => d.score === null))
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No weekly scores yet. They appear after the first daily calculation.
      </p>
    )
  return (
    <div className="h-56" role="img" aria-label="Average performance score over the last 8 weeks">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Avg score"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
