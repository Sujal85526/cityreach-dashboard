import { toDateKey } from '@dm/shared'
import { CalendarCheck, Clock, Pencil, Smartphone, TimerOff, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusPill, TonePill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useEmployees } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { formatClock, formatMinutes, formatTimeOfDay } from '@/lib/format'
import { CheckInBadges } from '../components/CheckInBadges'
import { CorrectionDialog } from '../components/CorrectionDialog'
import { MonthCalendar } from '../components/MonthCalendar'
import { WeekChart } from '../components/WeekChart'
import { addDays, buildDayRows, summarize, type DayRow } from '../model'
import { useRota } from '@/features/rota/queries'
import { useAttendanceRange } from '../queries'

export function AttendancePage() {
  const branch = useBranch()
  const tz = branch.data?.rules.timeZone ?? 'UTC'
  const now = useMemo(() => new Date(), [])
  const today = toDateKey(now, tz)
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked ?? today
  const [editing, setEditing] = useState<DayRow | null>(null)

  // One query covers the table, the 7-day chart and the month calendar.
  const month = date.slice(0, 7)
  const monthEnd = addDays(`${addDays(`${month}-28`, 4).slice(0, 7)}-01`, -1)
  const from = [`${month}-01`, addDays(date, -6)].sort()[0] ?? date
  const to = monthEnd < today ? monthEnd : today
  const records = useAttendanceRange(from, to)
  const rota = useRota(from, to)
  const employees = useEmployees()
  const shifts = useShifts()

  const data = useMemo(() => {
    if (!branch.data || !records.data || !employees.data || !shifts.data) return null
    const inputs = {
      employees: employees.data,
      shifts: shifts.data,
      records: records.data,
      branch: branch.data,
      now,
      rota: rota.data ?? [],
    }
    const summaries = new Map<string, ReturnType<typeof summarize>>()
    for (let d = from; d <= to; d = addDays(d, 1))
      summaries.set(d, summarize(buildDayRows(d, inputs)))
    const rows = buildDayRows(date, inputs)
    const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)).map((d) => {
      const s = summaries.get(d)
      return {
        day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
          new Date(`${d}T12:00:00Z`),
        ),
        onTime: (s?.present ?? 0) - (s?.late ?? 0),
        late: s?.late ?? 0,
        absent: s?.absent ?? 0,
      }
    })
    return { rows, summary: summarize(rows), summaries, week }
  }, [branch.data, records.data, employees.data, shifts.data, rota.data, now, from, to, date])

  const error = branch.error ?? records.error ?? employees.error ?? shifts.error
  if (error) return <ErrorState error={error} onRetry={() => void records.refetch()} />
  const s = data?.summary
  const loading = !data

  const columns: Column<DayRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      className: 'whitespace-normal',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={r.employee.name} id={r.employee.id} className="hidden sm:flex" />
          <div>
            <div className="font-medium">{r.employee.name}</div>
            <div className="text-xs text-muted-foreground">
              {r.shift ? `${r.shift.name} · ${formatTimeOfDay(r.shift.start)}` : 'No shift'}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'in', header: 'Clock in', cell: (r) => formatClock(r.record?.clockInAt ?? null, tz) },
    {
      key: 'out',
      header: 'Clock out',
      className: 'hidden sm:table-cell',
      cell: (r) => formatClock(r.record?.clockOutAt ?? null, tz),
    },
    {
      key: 'hours',
      header: 'Hours',
      className: 'hidden md:table-cell',
      cell: (r) => formatMinutes(r.workedMinutes),
    },
    {
      key: 'late',
      header: 'Late (min)',
      className: 'hidden md:table-cell',
      cell: (r) => (r.lateMinutes > 0 ? r.lateMinutes : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <StatusPill status={r.status} />
          {r.record?.source === 'manager' && (
            <span className="hidden text-xs text-muted-foreground sm:inline">edited</span>
          )}
        </span>
      ),
    },
    {
      key: 'checks',
      header: 'Check-in',
      className: 'hidden sm:table-cell whitespace-normal',
      cell: (r) => (r.record ? <CheckInBadges record={r.record} tz={tz} /> : null),
    },
    {
      key: 'edit',
      header: '',
      className: 'w-10 text-right',
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${r.employee.name}'s attendance`}
          onClick={() => setEditing(r)}
        >
          <Pencil />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Present"
          icon={UserCheck}
          loading={loading}
          value={s ? `${s.present} / ${s.scheduled}` : ''}
          caption={
            s?.scheduled
              ? `${Math.round((s.present / s.scheduled) * 100)}% of scheduled staff`
              : 'No one scheduled'
          }
        />
        <StatCard
          label="Late arrivals"
          icon={Clock}
          loading={loading}
          value={s?.late ?? 0}
          caption={s?.late ? `Avg ${s.avgLate} min late` : 'Everyone on time'}
          badge={s?.late ? { text: `${s.late} flagged`, tone: 'warning' } : undefined}
        />
        <StatCard
          label="Absent"
          icon={TimerOff}
          loading={loading}
          value={s?.absent ?? 0}
          caption={s?.onLeave ? `${s.onLeave} on leave` : 'No-shows after the absence window'}
          badge={s?.absent ? { text: 'Requires follow-up', tone: 'danger' } : undefined}
        />
        <StatCard
          label="Avg. hours"
          icon={CalendarCheck}
          loading={loading}
          value={s?.avgWorkedMinutes != null ? `${(s.avgWorkedMinutes / 60).toFixed(1)}h` : '—'}
          caption="Completed shifts this day"
        />
      </div>

      <Card className="flex-row items-center gap-4 p-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-success">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <div className="font-medium">Digital check-in</div>
          <div className="text-sm text-muted-foreground">
            Staff clock in from their phone with their location and a live photo; times come from
            the server.
          </div>
        </div>
        <TonePill tone="success">Live</TonePill>
      </Card>

      <Card>
        <CardHeader>
          <PageHeader
            title="Daily attendance"
            description="Click the pencil to record leave or correct times."
            actions={
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setPicked(e.target.value)}
                className="w-auto"
                aria-label="Date"
              />
            }
          />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={data?.rows}
            rowKey={(r) => r.employee.id}
            loading={loading}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Past 7 days</CardTitle>
          </CardHeader>
          <CardContent>{data && <WeekChart data={data.week} />}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Month</CardTitle>
          </CardHeader>
          <CardContent>
            {data && (
              <MonthCalendar
                month={month}
                selected={date}
                today={today}
                summaries={data.summaries}
                onSelect={(d) => setPicked(d > today ? today : d)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {branch.data && editing && (
        <CorrectionDialog
          row={editing}
          dateKey={date}
          branch={branch.data}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
