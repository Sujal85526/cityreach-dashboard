import { earlyLeaveMinutes, resolveAttendance, type Attendance } from '@cityreach/shared'
import { CalendarClock, Clock, Loader2, LogIn, LogOut } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { ErrorState } from '@/components/common/EmptyState'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/features/auth/session'
import { useEmployee } from '@/features/employees/queries'
import { useBranch, useShifts } from '@/features/settings/queries'
import { useNow } from '@/hooks/use-now'
import { formatClock, formatMinutes, shiftLabel } from '@/lib/format'
import { clockInTarget, type ClockInCapture } from '../api'
import { isFix, readLocation } from '../capture'
import { AttendanceList } from '../components/AttendanceList'
import { isStillClockedIn } from '../model'
import { ClockInDialog } from '../components/ClockInDialog'
import { EarlyClockOutDialog } from '../components/EarlyClockOutDialog'
import { LiveClock, ShiftTimer } from '../components/ShiftTimer'
import { useMyRotaAroundToday } from '@/features/rota/queries'
import { useClockIn, useClockOut, useMyAttendance } from '../queries'

/** Employee home (phone-first): today's shift and one big Clock in / Clock out button. */
export function ClockPage() {
  const { uid } = useCurrentUser()
  const me = useEmployee(uid)
  const branch = useBranch()
  const shifts = useShifts()
  const rota = useMyRotaAroundToday()
  const history = useMyAttendance()
  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const now = useNow()
  const [clockInOpen, setClockInOpen] = useState(false)
  const [earlyOpen, setEarlyOpen] = useState(false)
  const [locating, setLocating] = useState(false)

  const error = me.error ?? branch.error ?? shifts.error ?? history.error ?? rota.error
  if (error) return <ErrorState error={error} />
  if (!me.data || !branch.data || !shifts.data || !history.data || !rota.data)
    return <Skeleton className="mx-auto h-72 w-full max-w-md rounded-xl" />

  const b = branch.data
  const tz = b.rules.timeZone
  const ctx = { me: me.data, shifts: shifts.data, rota: rota.data, branch: b }
  const target = clockInTarget(ctx, now)
  const shift = target.shift
  // An open record may be yesterday's night shift, so look at the latest records, not just today's.
  const open = history.data.find((r) => isStillClockedIn(r, now))
  const todays = history.data.find((r) => r.dateKey === target.dateKey)
  const canClockIn =
    !open && (!todays || (todays.source === 'system' && todays.status === 'absent'))
  const outsideWindow = target.scheduled && !target.instance

  const early = open?.shiftEndAt ? earlyLeaveMinutes(open.shiftEndAt, now, b.rules.attendance) : 0

  const doClockIn = (capture: ClockInCapture) =>
    me.data &&
    clockIn.mutate(
      { ctx, capture },
      {
        onSuccess: (r) => {
          setClockInOpen(false)
          toast.success(
            r.status === 'late'
              ? `Clocked in · Late – ${r.lateMinutes} min`
              : 'Clocked in · On time',
          )
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  // Clock-out records the location too (no photo); a quick reading, never blocking.
  const doClockOut = async (reason: string | null) => {
    if (!open) return
    setLocating(true)
    const location = await readLocation(8_000)
    setLocating(false)
    clockOut.mutate(
      { record: open, branch: b, capture: { location: isFix(location) ? location : null, reason } },
      {
        onSuccess: (r) => {
          setEarlyOpen(false)
          toast.success(
            r.earlyLeaveMinutes
              ? `Clocked out · ${formatMinutes(r.earlyLeaveMinutes)} before your shift ended`
              : 'Clocked out. Have a good rest!',
          )
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  }
  const clockingOut = locating || clockOut.isPending

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardContent className="space-y-5 text-center">
          <div>
            <LiveClock tz={tz} />
            <div className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat('en-GB', {
                timeZone: tz,
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(now)}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <CalendarClock className="size-4 text-muted-foreground" />
            {shift ? shiftLabel(shift) : 'No fixed shift'}
          </div>

          {open?.clockInAt && (
            <ShiftTimer
              clockInAt={open.clockInAt}
              shiftStartAt={open.shiftStartAt}
              shiftEndAt={open.shiftEndAt ?? null}
              tz={tz}
            />
          )}

          {open ? (
            <BigButton
              onClick={() => (early > 0 ? setEarlyOpen(true) : void doClockOut(null))}
              pending={clockingOut && !earlyOpen}
              icon={LogOut}
              variant="secondary"
            >
              Clock out
            </BigButton>
          ) : canClockIn ? (
            <BigButton
              onClick={() => setClockInOpen(true)}
              pending={false}
              icon={LogIn}
              disabled={outsideWindow}
            >
              Clock in
            </BigButton>
          ) : (
            <p className="rounded-lg bg-muted p-4 text-sm">You're done for this shift. 👋</p>
          )}

          {canClockIn && 'dayOff' in target && target.dayOff && (
            <p className="text-xs text-muted-foreground">You're off today on the rota.</p>
          )}
          {canClockIn && outsideWindow && shift && !('dayOff' in target && target.dayOff) && (
            <p className="text-xs text-muted-foreground">
              Clock-in opens 3 hours before your shift starts and closes when it ends.
            </p>
          )}
          {(open ?? todays) && (
            <TodaySummary
              record={(open ?? todays) as Attendance}
              tz={tz}
              grace={b.rules.attendance.graceMinutes}
            />
          )}
        </CardContent>
      </Card>

      <ClockInDialog
        open={clockInOpen}
        onOpenChange={setClockInOpen}
        branch={b}
        pending={clockIn.isPending}
        onConfirm={doClockIn}
      />
      {open?.shiftEndAt && (
        <EarlyClockOutDialog
          open={earlyOpen}
          onOpenChange={setEarlyOpen}
          shiftEndAt={open.shiftEndAt}
          minutesLeft={early}
          tz={tz}
          pending={clockingOut}
          onConfirm={(reason) => void doClockOut(reason)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4" /> My week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceList
            records={history.data.slice(0, 7)}
            timeZone={tz}
            grace={b.rules.attendance.graceMinutes}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function TodaySummary({ record, tz, grace }: { record: Attendance; tz: string; grace: number }) {
  const r = useMemo(() => resolveAttendance(record, { graceMinutes: grace }), [record, grace])
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-sm">
      <div>
        <div className="text-xs text-muted-foreground">In</div>
        <div className="font-medium">{formatClock(record.clockInAt, tz)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Out</div>
        <div className="font-medium">{formatClock(record.clockOutAt, tz)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Status</div>
        <StatusPill status={r.status} />
        {r.lateMinutes > 0 && (
          <div className="text-xs text-muted-foreground">{r.lateMinutes} min</div>
        )}
        {r.workedMinutes != null && (
          <div className="text-xs text-muted-foreground">{formatMinutes(r.workedMinutes)}</div>
        )}
        {!!record.earlyLeaveMinutes && (
          <div className="text-xs text-warning">
            Left {formatMinutes(record.earlyLeaveMinutes)} early
          </div>
        )}
      </div>
    </div>
  )
}

function BigButton({
  children,
  onClick,
  pending,
  disabled,
  icon: Icon,
  variant,
}: {
  children: string
  onClick: () => void
  pending: boolean
  disabled?: boolean
  icon: typeof LogIn
  variant?: 'secondary'
}) {
  return (
    <Button
      size="lg"
      variant={variant}
      className="h-16 w-full text-lg"
      onClick={onClick}
      disabled={pending || disabled}
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
      {children}
    </Button>
  )
}
