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

export interface WeekPoint {
  day: string
  onTime: number
  late: number
  absent: number
}

const SERIES = [
  { key: 'onTime', name: 'On time', color: 'var(--success)' },
  { key: 'late', name: 'Late', color: 'var(--warning)' },
  { key: 'absent', name: 'Absent', color: 'var(--danger)' },
] as const

/** Stacked bars of the past 7 days (prototype "Attendance summary"). */
export function WeekChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-64" role="img" aria-label="Attendance over the past 7 days">
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
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="a"
              fill={s.color}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
