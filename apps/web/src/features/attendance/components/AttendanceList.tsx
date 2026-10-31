import { resolveAttendance, type Attendance } from '@dm/shared'
import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusPill, TonePill } from '@/components/common/StatusPill'
import { formatClock, formatMinutes } from '@/lib/format'
import { isStillClockedIn } from '../model'

const dayLabel = (dateKey: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`))

/** Phone-friendly attendance list (one row per day) for the employee screens. */
export function AttendanceList({
  records,
  timeZone,
  grace,
}: {
  records: Attendance[]
  timeZone: string
  grace: number
}) {
  if (records.length === 0) return <EmptyState icon={CalendarCheck} title="No attendance yet" />
  return (
    <ul className="divide-y">
      {records.map((record) => {
        const r = resolveAttendance(record, { graceMinutes: grace })
        return (
          <li key={record.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div>
              <div className="font-medium">{dayLabel(record.dateKey)}</div>
              <div className="text-xs text-muted-foreground">
                {!record.clockInAt
                  ? 'No clock-in'
                  : record.clockOutAt
                    ? `${formatClock(record.clockInAt, timeZone)} – ${formatClock(record.clockOutAt, timeZone)} · ${formatMinutes(r.workedMinutes)}`
                    : isStillClockedIn(record, new Date())
                      ? `In since ${formatClock(record.clockInAt, timeZone)}`
                      : `In ${formatClock(record.clockInAt, timeZone)} · no clock-out`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {r.lateMinutes > 0 && (
                <span className="text-xs text-muted-foreground">{r.lateMinutes} min</span>
              )}
              {record.status === 'leave' && record.leavePaid === false && (
                <TonePill tone="warning">Unpaid</TonePill>
              )}
              {!!record.earlyLeaveMinutes && (
                <TonePill tone="warning">
                  Left {formatMinutes(record.earlyLeaveMinutes)} early
                </TonePill>
              )}
              <StatusPill status={r.status} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
