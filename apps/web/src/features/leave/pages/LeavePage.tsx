import { toDateKey, type LeaveRequest } from '@cityreach/shared'
import { CalendarClock, CalendarDays, Hourglass, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEmployees } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { DecideDialog } from '../components/DecideDialog'
import { PayTable } from '../components/PayTable'
import { formatRange, plural } from '../model'
import { useBranchLeave } from '../queries'

/** Manager: leave requests to approve or reject, and the monthly pay estimate. */
export function LeavePage() {
  const branch = useBranch()
  const employees = useEmployees()
  const shifts = useShifts()
  const leave = useBranchLeave()
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [deciding, setDeciding] = useState<LeaveRequest | null>(null)
  const today = toDateKey(new Date(), branch.data?.rules.timeZone ?? 'UTC')
  const [month, setMonth] = useState(today.slice(0, 7))

  const stats = useMemo(() => {
    const all = leave.data ?? []
    const pending = all.filter((r) => r.status === 'pending')
    const onLeaveToday = new Set(
      all
        .filter((r) => r.status === 'approved' && r.dates.includes(today))
        .map((r) => r.employeeId),
    ).size
    const upcoming = all.filter((r) => r.status === 'approved' && r.from > today).length
    return { pending, onLeaveToday, upcoming }
  }, [leave.data, today])

  const error = branch.error ?? employees.error ?? shifts.error ?? leave.error
  if (error) return <ErrorState error={error} onRetry={() => void leave.refetch()} />
  const loading = !branch.data || !employees.data || !shifts.data || !leave.data
  const rows = (leave.data ?? []).filter((r) => filter === 'all' || r.status === 'pending')
  const employee = (id: string) => employees.data?.find((e) => e.id === id)

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      className: 'whitespace-normal',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.employeeName}</div>
          <div className="text-xs text-muted-foreground">{r.typeName}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      cell: (r) => (
        <div>
          <div>{formatRange(r.from, r.to)}</div>
          <div className="text-xs text-muted-foreground">{plural(r.dates.length, 'day')}</div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      className: 'hidden max-w-64 truncate md:table-cell',
      cell: (r) => r.reason || '—',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="space-y-0.5">
          <StatusPill status={r.status} />
          {r.status === 'approved' && r.paidDays !== null && r.paidDays < r.dates.length && (
            <div className="text-xs text-warning">
              {plural(r.dates.length - r.paidDays, 'day')} unpaid
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      cell: (r) =>
        r.status === 'pending' && employee(r.employeeId) ? (
          <Button size="sm" onClick={() => setDeciding(r)}>
            Review
          </Button>
        ) : null,
    },
  ]

  const target = deciding ? employee(deciding.employeeId) : undefined
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Waiting for you"
          icon={Hourglass}
          loading={loading}
          value={stats.pending.length}
          caption="Leave requests to review"
          badge={stats.pending.length ? { text: 'Needs a decision', tone: 'warning' } : undefined}
        />
        <StatCard
          label="On leave today"
          icon={CalendarDays}
          loading={loading}
          value={stats.onLeaveToday}
          caption="Approved leave"
        />
        <StatCard
          label="Upcoming leave"
          icon={CalendarClock}
          loading={loading}
          value={stats.upcoming}
          caption="Approved, starting later"
        />
      </div>

      <Card>
        <CardHeader>
          <PageHeader
            title="Leave requests"
            description="Approving marks the days as Leave on Attendance. Days beyond the balance are unpaid."
            actions={
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={loading ? undefined : rows}
            rowKey={(r) => r.id}
            loading={loading}
            empty={
              <EmptyState
                icon={CalendarDays}
                title={filter === 'pending' ? 'No requests waiting' : 'No leave requests yet'}
              />
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {employees.data ? (
            <PayTable
              employees={employees.data}
              month={month}
              onMonth={setMonth}
              maxMonth={today.slice(0, 7)}
            />
          ) : (
            <EmptyState icon={Wallet} title="Loading…" />
          )}
        </CardContent>
      </Card>

      {deciding && target && branch.data && (
        <DecideDialog
          request={deciding}
          employee={target}
          shift={shifts.data?.find((s) => s.id === target.shiftId) ?? null}
          history={(leave.data ?? []).filter((r) => r.employeeId === target.id)}
          branch={branch.data}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  )
}
