import {
  labourByDay,
  labourLevel,
  labourPercent,
  LABOUR_HIGH_PERCENT,
  LABOUR_TARGET_PERCENT,
  monthEnd,
  monthLabourCost,
} from '@cityreach/shared'
import { Percent, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { TonePill, type Tone } from '@/components/common/StatusPill'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAttendanceRange } from '@/features/attendance/queries'
import { useEmployees } from '@/features/employees/queries'
import { useMonthPayslips } from '@/features/payslips/queries'
import { useToday } from '@/hooks/use-today'
import { formatDay, formatMoney } from '@/lib/format'
import { useSalesBetween } from '../queries'
import { LabourChart } from './LabourChart'
import { MonthPicker } from './MonthPicker'

const LEVELS: Record<string, { text: string; tone: Tone } | undefined> = {
  good: { text: 'On target', tone: 'success' },
  watch: { text: 'Watch this', tone: 'warning' },
  high: { text: 'Too high', tone: 'danger' },
}

type Day = ReturnType<typeof labourByDay>[number]
const columns: Column<Day>[] = [
  { key: 'date', header: 'Day', cell: (d) => formatDay(d.date) },
  { key: 'sales', header: 'Sales', cell: (d) => formatMoney(d.sales) },
  { key: 'labour', header: 'Staff cost', cell: (d) => formatMoney(d.labour) },
  {
    key: 'percent',
    header: 'Staff cost %',
    cell: (d) => {
      const level = LEVELS[labourLevel(d.percent)]
      return level ? (
        <TonePill tone={level.tone}>{d.percent} %</TonePill>
      ) : (
        <span className="text-muted-foreground">No sales</span>
      )
    },
  },
]

/** Staff cost as a share of sales, for the month and day by day. */
export function LabourTab() {
  const today = useToday()
  const [month, setMonth] = useState(today.slice(0, 7))
  const from = `${month}-01`
  const end = monthEnd(month)
  const to = end < today ? end : today
  const sales = useSalesBetween(from, to)
  const attendance = useAttendanceRange(from, to)
  const employees = useEmployees()
  const payslips = useMonthPayslips(month)

  const error = sales.error ?? attendance.error ?? employees.error ?? payslips.error
  const loading = !sales.days || !attendance.data || !employees.data || !payslips.data
  // A month in progress: only the part of the monthly pay earned so far.
  const share = end > today ? Number(today.slice(8)) / Number(end.slice(8)) : 1

  const salesSum = (sales.days ?? []).reduce((sum, d) => sum + d.total, 0)
  const staff = useMemo(
    () => (employees.data ?? []).filter((e) => e.status !== 'inactive'),
    [employees.data],
  )
  const labour = monthLabourCost(staff, payslips.data ?? [], share)
  const percent = labourPercent(labour.cost, salesSum)
  const level = LEVELS[labourLevel(percent)]
  const days = useMemo(
    () => labourByDay(sales.days ?? [], attendance.data ?? [], staff),
    [sales.days, attendance.data, staff],
  )
  const costliest = useMemo(
    () => [...days].sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)).slice(0, 7),
    [days],
  )

  if (error) return <ErrorState error={error} onRetry={() => void sales.refetch()} />

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A good target is {LABOUR_TARGET_PERCENT} % of sales or less; over {LABOUR_HIGH_PERCENT} %
          is too high. Saved payslips count as paid, the rest as salary + allowances
          {share < 1 ? ' for the days so far' : ''}.
        </p>
        <MonthPicker month={month} max={today.slice(0, 7)} onChange={setMonth} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Staff cost % of sales"
          icon={Percent}
          loading={loading}
          value={percent === null ? '—' : `${percent} %`}
          caption={
            percent === null ? 'No sales entered' : `Target ${LABOUR_TARGET_PERCENT} % or less`
          }
          badge={level && { text: level.text, tone: level.tone }}
        />
        <StatCard
          label="Staff cost"
          icon={Users}
          loading={loading}
          value={formatMoney(labour.cost)}
          caption={`${payslips.data?.length ?? 0} payslips, ${labour.estimatedStaff} estimated`}
        />
        <StatCard
          label="Sales"
          icon={Wallet}
          loading={loading}
          value={formatMoney(salesSum)}
          caption={`${sales.days?.length ?? 0} ${sales.days?.length === 1 ? 'day' : 'days'} entered`}
        />
      </div>

      {!loading && labour.staffWithoutPay > 0 && (
        <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {labour.staffWithoutPay} staff have no salary set, so the real cost is higher.{' '}
          <Link to="/leave" className="font-medium underline">
            Set salaries in Leave & pay
          </Link>
        </p>
      )}

      {!loading && days.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No sales or attendance this month"
          description="Enter daily takings in Sales & finance to compare them with staff cost."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sales and staff cost per day</CardTitle>
              <CardDescription>
                A day's staff cost is one 30th of the monthly pay of everyone who clocked in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LabourChart days={days} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Days when staff cost the most against sales</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                rows={costliest}
                rowKey={(d) => d.date}
                loading={loading}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
