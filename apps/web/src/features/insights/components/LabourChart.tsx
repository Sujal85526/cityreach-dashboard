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
import { formatDay, formatMoney } from '@/lib/format'

/** Sales and staff cost side by side, per day, on one money axis. */
export function LabourChart({ days }: { days: { date: string; sales: number; labour: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Sales and staff cost for each day of the month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => String(Number(d.slice(8)))}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={48}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            labelFormatter={(d) => formatDay(String(d))}
            formatter={(value) => formatMoney(Number(value))}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="sales"
            name="Sales"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
          />
          <Bar
            dataKey="labour"
            name="Staff cost"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
