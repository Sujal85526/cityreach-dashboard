import type { Attendance, Task } from '@cityreach/shared'
import { CalendarCheck, ListChecks } from 'lucide-react'
import { useMemo } from 'react'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatMinutes,
  formatTimeOfDay,
} from '@/lib/format'
import { CheckInBadges } from '@/features/attendance/components/CheckInBadges'
import { useTimeZone } from '@/features/settings/queries'
import { useEmployeeAttendance, useEmployeeTasks } from '../queries'

const attendanceColumns = (tz: string): Column<Attendance>[] => [
  { key: 'date', header: 'Date', cell: (a) => formatDate(new Date(`${a.dateKey}T00:00:00`)) },
  {
    key: 'shift',
    header: 'Shift',
    className: 'hidden sm:table-cell',
    cell: (a) =>
      a.shiftStart && a.shiftEnd
        ? `${formatTimeOfDay(a.shiftStart)}–${formatTimeOfDay(a.shiftEnd)}`
        : '—',
  },
  { key: 'in', header: 'In', cell: (a) => formatClock(a.clockInAt, tz) },
  {
    key: 'out',
    header: 'Out',
    className: 'hidden sm:table-cell',
    cell: (a) => formatClock(a.clockOutAt, tz),
  },
  {
    key: 'worked',
    header: 'Worked',
    className: 'hidden md:table-cell',
    cell: (a) => formatMinutes(a.workedMinutes),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (a) => (
      <span className="flex items-center gap-2">
        <StatusPill status={a.status} />
        {a.lateMinutes > 0 && (
          <span className="text-xs text-muted-foreground">{a.lateMinutes} min</span>
        )}
      </span>
    ),
  },
  {
    key: 'checks',
    header: 'Check-in',
    className: 'hidden md:table-cell whitespace-normal',
    cell: (a) => <CheckInBadges record={a} tz={tz} />,
  },
]

const taskColumns = (tz: string): Column<Task>[] => [
  { key: 'title', header: 'Task', cell: (t) => <span className="font-medium">{t.title}</span> },
  {
    key: 'category',
    header: 'Category',
    className: 'hidden sm:table-cell',
    cell: (t) => t.category,
  },
  {
    key: 'priority',
    header: 'Priority',
    className: 'hidden md:table-cell',
    cell: (t) => <StatusPill status={t.priority} />,
  },
  { key: 'deadline', header: 'Deadline', cell: (t) => formatDateTime(t.deadline, tz) },
  { key: 'status', header: 'Status', cell: (t) => <StatusPill status={t.status} /> },
]

export function AttendanceHistory({ uid }: { uid: string }) {
  const timeZone = useTimeZone()
  const q = useEmployeeAttendance(uid)
  const columns = useMemo(() => attendanceColumns(timeZone), [timeZone])
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  return (
    <DataTable
      columns={columns}
      rows={q.data}
      rowKey={(a) => a.id}
      loading={q.isPending}
      empty={<EmptyState icon={CalendarCheck} title="No attendance records yet" />}
    />
  )
}

export function TaskHistory({ uid }: { uid: string }) {
  const timeZone = useTimeZone()
  const q = useEmployeeTasks(uid)
  const columns = useMemo(() => taskColumns(timeZone), [timeZone])
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  return (
    <DataTable
      columns={columns}
      rows={q.data}
      rowKey={(t) => t.id}
      loading={q.isPending}
      empty={<EmptyState icon={ListChecks} title="No tasks assigned yet" />}
    />
  )
}
