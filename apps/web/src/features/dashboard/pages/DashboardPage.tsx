import { stockStatus, toDateKey, type Activity } from '@dm/shared'
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  ListTodo,
  TimerOff,
  UserCheck,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmployeeAvatar } from '@/components/common/EmployeeAvatar'
import { ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { StatusPill } from '@/components/common/StatusPill'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useActivityLastHour, useRecentActivity } from '@/features/activity/queries'
import { WeekChart } from '@/features/attendance/components/WeekChart'
import { addDays, buildDayRows, summarize } from '@/features/attendance/model'
import { useAttendanceRange } from '@/features/attendance/queries'
import { useCurrentUser } from '@/features/auth/session'
import { useEmployees } from '@/features/employees/queries'
import { useInventory } from '@/features/inventory/queries'
import { linkFor } from '@/features/notifications/api'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'
import { useMarkRead, useNotifications } from '@/features/notifications/queries'
import { usePerformanceTrend } from '@/features/performance/queries'
import { TrendChart } from '@/features/reports/components/TrendChart'
import { useBranch, useShifts } from '@/features/settings/queries'
import { useRota } from '@/features/rota/queries'
import { useTaskBoard } from '@/features/tasks/queries'
import { formatAgo, formatDue, formatQty } from '@/lib/format'
import { NeedsAttention } from '../components/NeedsAttention'
import { TaskWeekChart } from '../components/TaskWeekChart'
import { averageScore, taskStats, taskWeek } from '../model'

/**
 * Manager overview. Every number comes from Firestore (docs/PRODUCT.md §1): attendance records,
 * the live task board, inventory, staff stats and the activity log, loaded in parallel.
 */
export function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const branch = useBranch().data
  const tz = branch?.rules.timeZone ?? 'UTC'
  const now = useMemo(() => new Date(), [])
  const today = toDateKey(now, tz)
  const attendance = useAttendanceRange(addDays(today, -6), today)
  const rota = useRota(addDays(today, -6), today)
  const employees = useEmployees()
  const shifts = useShifts()
  const tasks = useTaskBoard()
  const inventory = useInventory()
  const activity = useRecentActivity()
  const lastHour = useActivityLastHour()
  const notifications = useNotifications()
  const markRead = useMarkRead()
  const trend = usePerformanceTrend()

  const att = useMemo(() => {
    if (!branch || !attendance.data || !employees.data || !shifts.data) return null
    const inputs = {
      employees: employees.data,
      shifts: shifts.data,
      records: attendance.data,
      branch,
      now,
      rota: rota.data ?? [],
    }
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => {
      const s = summarize(buildDayRows(d, inputs))
      return {
        day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
          new Date(`${d}T12:00:00Z`),
        ),
        onTime: s.present - s.late,
        late: s.late,
        absent: s.absent,
      }
    })
    return { today: summarize(buildDayRows(today, inputs)), week }
  }, [branch, attendance.data, employees.data, shifts.data, rota.data, now, today])

  const t = useMemo(
    () =>
      tasks.data
        ? { ...taskStats(tasks.data, tz, now), week: taskWeek(tasks.data, tz, today) }
        : null,
    [tasks.data, tz, now, today],
  )

  const stock = useMemo(() => {
    if (!inventory.data || !branch) return null
    const rows = inventory.data
      .map((i) => ({
        ...i,
        current: stockStatus(i.quantity, i.minQuantity, branch.rules.inventory.criticalRatio),
      }))
      .filter((i) => i.current !== 'in_stock')
      .sort((a, b) => (a.current === b.current ? 0 : a.current === 'critical' ? -1 : 1))
    return { rows, critical: rows.filter((r) => r.current === 'critical').length }
  }, [inventory.data, branch])

  const score = employees.data ? averageScore(employees.data) : null
  const error = attendance.error ?? employees.error ?? tasks.error ?? inventory.error
  if (error) return <ErrorState error={error} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Good {partOfDay(now, tz)}, {user.name.split(' ')[0]}
        </h2>
        <p className="text-sm text-muted-foreground">Here's {branch?.name ?? 'the shop'} today.</p>
      </div>

      <NeedsAttention
        today={today}
        absent={att?.today.absent ?? null}
        overdueTasks={t?.overdue ?? null}
        lowStock={stock?.rows.length ?? null}
        criticalStock={stock?.critical ?? 0}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Employees present"
          icon={UserCheck}
          loading={!att}
          value={att ? `${att.today.present} / ${att.today.scheduled}` : ''}
          caption={att?.today.onLeave ? `${att.today.onLeave} on leave` : 'Scheduled today'}
        />
        <StatCard
          label="Late employees"
          icon={Clock}
          loading={!att}
          value={att?.today.late ?? 0}
          caption={att?.today.late ? `Avg ${att.today.avgLate} min late` : 'Everyone on time'}
          badge={
            att?.today.late ? { text: `${att.today.late} flagged`, tone: 'warning' } : undefined
          }
        />
        <StatCard
          label="Absent"
          icon={TimerOff}
          loading={!att}
          value={att?.today.absent ?? 0}
          caption="No clock-in after the absence window"
          badge={att?.today.absent ? { text: 'Follow up', tone: 'danger' } : undefined}
        />
        <StatCard
          label="Tasks completed"
          icon={CheckCircle2}
          loading={!t}
          value={t?.completedToday ?? 0}
          caption={t ? `of ${t.plannedToday} due or done today` : undefined}
        />
        <StatCard
          label="Pending tasks"
          icon={ListTodo}
          loading={!t}
          value={t?.open ?? 0}
          caption={t ? `${t.highPriority} high priority` : undefined}
          badge={t?.overdue ? { text: `${t.overdue} overdue`, tone: 'danger' } : undefined}
        />
        <StatCard
          label="Low stock items"
          icon={AlertTriangle}
          loading={!stock}
          value={stock?.rows.length ?? 0}
          caption={stock ? `${stock.critical} critical` : undefined}
          badge={stock?.critical ? { text: 'Reorder today', tone: 'danger' } : undefined}
        />
        <StatCard
          label="Staff performance"
          icon={Gauge}
          loading={!employees.data}
          value={score === null ? '—' : `${score} / 100`}
          caption="Average of latest scores"
        />
        <StatCard
          label="Live activity"
          icon={ActivityIcon}
          loading={lastHour.isPending}
          value={`${lastHour.data ?? 0} events`}
          caption="In the last hour"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Attendance summary</CardTitle>
            <CardAction>
              <Link to="/attendance" className="text-sm text-primary hover:underline">
                Details
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {att ? <WeekChart data={att.week} /> : <Skeleton className="h-64" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task completion</CardTitle>
            <CardAction>
              <Link to="/tasks" className="text-sm text-primary hover:underline">
                Board
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {t ? <TaskWeekChart data={t.week} /> : <Skeleton className="h-56" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory alerts</CardTitle>
            <CardAction>
              <Link to="/inventory" className="text-sm text-primary hover:underline">
                Inventory
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {!stock ? (
              <Skeleton className="h-32" />
            ) : stock.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All items are at or above their minimum.
              </p>
            ) : (
              stock.rows.slice(0, 6).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatQty(i.quantity, i.unit)} · min {formatQty(i.minQuantity, i.unit)}
                    </div>
                  </div>
                  <StatusPill status={i.current} kind="stock" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming tasks</CardTitle>
            <CardAction>
              <Link to="/tasks" className="text-sm text-primary hover:underline">
                All tasks
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {!t ? (
              <Skeleton className="h-32" />
            ) : t.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks coming up.</p>
            ) : (
              t.upcoming.map((task) => (
                <div key={task.id} className="flex items-center gap-3 text-sm">
                  <EmployeeAvatar name={task.assigneeName} id={task.assigneeId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.assigneeName} · {formatDue(task.deadline, tz)}
                    </div>
                  </div>
                  <StatusPill status={task.priority} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance trend</CardTitle>
            <CardAction>
              <Link to="/reports" className="text-sm text-primary hover:underline">
                Reports
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {trend.data ? <TrendChart data={trend.data} /> : <Skeleton className="h-56" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.isPending ? (
              <Skeleton className="h-40" />
            ) : (activity.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet today.</p>
            ) : (
              activity.data?.map((a) => <ActivityRow key={a.id} a={a} />)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardAction>
              <Link to="/notifications" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {notifications.isPending ? (
              <Skeleton className="h-40" />
            ) : (notifications.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notifications.</p>
            ) : (
              notifications.data?.slice(0, 5).map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  compact
                  onClick={() => {
                    if (n.readAt === null) markRead.mutate([n.id])
                    navigate(linkFor(n, user.access.role))
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ActivityRow({ a }: { a: Activity }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {a.actorId ? (
        <EmployeeAvatar name={a.actorName} id={a.actorId} size="sm" />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
          SYS
        </span>
      )}
      <div className="min-w-0">
        <p>{a.summary}</p>
        <p className="text-xs text-muted-foreground">{formatAgo(a.createdAt)}</p>
      </div>
    </div>
  )
}

/** Greeting by the shop's local time, not the viewer's device. */
function partOfDay(now: Date, tz: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(
      now,
    ),
  )
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}
