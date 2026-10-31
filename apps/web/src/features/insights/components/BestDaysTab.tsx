import {
  addDays,
  bestAndWorstDates,
  bestAndWorstWeekday,
  salesByMonth,
  salesByWeekday,
} from '@cityreach/shared'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { TonePill } from '@/components/common/StatusPill'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToday } from '@/hooks/use-today'
import { formatDay, formatMoney } from '@/lib/format'
import { useSalesBetween } from '../queries'

const PERIODS = { '30': 'Last 30 days', '90': 'Last 3 months', '180': 'Last 6 months' } as const
type Period = keyof typeof PERIODS

type Month = ReturnType<typeof salesByMonth>[number]
const monthColumns: Column<Month>[] = [
  { key: 'month', header: 'Month', cell: (m) => m.month },
  { key: 'total', header: 'Sales', cell: (m) => formatMoney(m.total) },
  { key: 'average', header: 'Per day', cell: (m) => formatMoney(m.average) },
  { key: 'days', header: 'Days entered', cell: (m) => m.days },
  {
    key: 'change',
    header: 'vs month before',
    cell: (m) =>
      m.changePercent === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <TonePill tone={m.changePercent >= 0 ? 'success' : 'danger'}>
          {m.changePercent >= 0 ? '+' : ''}
          {m.changePercent} %
        </TonePill>
      ),
  },
]

/** Which weekdays and dates sell best and worst, to plan staff and stock around. */
export function BestDaysTab() {
  const today = useToday()
  const [period, setPeriod] = useState<Period>('90')
  const sales = useSalesBetween(addDays(today, -Number(period)), today)
  const days = useMemo(() => sales.days ?? [], [sales.days])
  const weekdays = useMemo(() => salesByWeekday(days), [days])
  const extremes = bestAndWorstWeekday(weekdays)
  const dates = useMemo(() => bestAndWorstDates(days), [days])
  const months = useMemo(() => salesByMonth(days), [days])
  const loading = !sales.days

  if (sales.error) return <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />

  return (
    <>
      <div className="flex justify-end">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-44" aria-label="Period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIODS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!loading && days.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No sales in this period"
          description="Enter daily takings in Sales & finance to see your best and worst days."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Best weekday"
              icon={TrendingUp}
              loading={loading}
              value={extremes?.best.weekday ?? '—'}
              caption={
                extremes ? `${formatMoney(extremes.best.average)} on average` : 'Needs more days'
              }
            />
            <StatCard
              label="Quietest weekday"
              icon={TrendingDown}
              loading={loading}
              value={extremes?.worst.weekday ?? '—'}
              caption={
                extremes ? `${formatMoney(extremes.worst.average)} on average` : 'Needs more days'
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Average sales by weekday</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56" role="img" aria-label="Average sales for each weekday">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdays} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="weekday"
                      tickFormatter={(w: string) => w.slice(0, 3)}
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
                      formatter={(value) => [formatMoney(Number(value)), 'Average']}
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="average"
                      fill="var(--chart-1)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <DateList title="Highest days" rows={dates.best} />
            <DateList title="Lowest days" rows={dates.worst} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Month by month</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={monthColumns}
                rows={months}
                rowKey={(m) => m.month}
                loading={loading}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

function DateList({ title, rows }: { title: string; rows: { date: string; total: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {rows.map((d) => (
            <li key={d.date} className="flex items-center justify-between py-2">
              <span>{formatDay(d.date)}</span>
              <span className="font-medium">{formatMoney(d.total)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
