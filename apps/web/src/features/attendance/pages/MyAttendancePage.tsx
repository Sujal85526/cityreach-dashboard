import { resolveAttendance, toDateKey } from '@dm/shared'
import { CalendarCheck, Clock, TimerOff } from 'lucide-react'
import { ErrorState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranch } from '@/features/settings/queries'
import { formatMinutes } from '@/lib/format'
import { AttendanceList } from '../components/AttendanceList'
import { useMyAttendance } from '../queries'

/** Employee's own attendance: this month's totals and the last 31 days. */
export function MyAttendancePage() {
  const history = useMyAttendance()
  const branch = useBranch()
  if (history.error) return <ErrorState error={history.error} />
  if (!history.data || !branch.data)
    return <Skeleton className="mx-auto h-72 max-w-md rounded-xl" />

  const { timeZone, attendance } = branch.data.rules
  const month = toDateKey(new Date(), timeZone).slice(0, 7)
  const thisMonth = history.data
    .filter((r) => r.dateKey.startsWith(month))
    .map((r) => resolveAttendance(r, attendance))
  const count = (s: string) => thisMonth.filter((r) => r.status === s).length
  const worked = thisMonth.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0)

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="On time"
          icon={CalendarCheck}
          value={count('on_time')}
          caption="This month"
        />
        <StatCard label="Late" icon={Clock} value={count('late')} caption="This month" />
        <StatCard label="Absent" icon={TimerOff} value={count('absent')} caption="This month" />
        <StatCard
          label="Hours"
          icon={Clock}
          value={formatMinutes(worked)}
          caption="Worked this month"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceList
            records={history.data}
            timeZone={timeZone}
            grace={attendance.graceMinutes}
          />
        </CardContent>
      </Card>
    </div>
  )
}
