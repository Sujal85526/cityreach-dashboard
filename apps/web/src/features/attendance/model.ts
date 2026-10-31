import {
  isPastAbsenceWindow,
  resolveAttendance,
  plannedShiftOn,
  type Attendance,
  type AttendanceStatus,
  type Branch,
  type RotaEntry,
  type Shift,
  type User,
} from '@dm/shared'

/** What a day looks like for one employee: a saved record, or what the rules say about the gap. */
export type DayStatus = AttendanceStatus | 'upcoming' | 'not_in_yet'

export interface DayRow {
  employee: User
  shift: Shift | null
  record: Attendance | null
  shiftStartAt: Date | null
  status: DayStatus
  lateMinutes: number
  workedMinutes: number | null
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
/** A clock-in still open this long after its shift ended is a forgotten clock-out. */
const FORGOTTEN_AFTER_MS = 6 * HOUR_MS

/**
 * True while the employee is on this clock-in. A forgotten clock-out (still open 6 h after the
 * shift ended; without a shift end, 16 h after clock-in like the rules' window) no longer counts,
 * so it can't block the next shift's clock-in. The manager corrects it on the Attendance page.
 * Example: Evening 15:00–23:00 never clocked out → stops counting at 05:00 the next day.
 */
export function isStillClockedIn(record: Attendance, now: Date): boolean {
  if (!record.clockInAt || record.clockOutAt) return false
  const end = record.shiftEndAt ?? new Date(record.clockInAt.getTime() + 16 * HOUR_MS)
  return now.getTime() < end.getTime() + FORGOTTEN_AFTER_MS
}
export const addDays = (dateKey: string, days: number) =>
  new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)

/**
 * One row per active employee for `dateKey`. Missing records are derived with the same rules
 * the automatic check uses, so the table is right even before the check has saved them:
 * past the absence window → Absent, before it → Not in yet / Upcoming, no shift that day → Off.
 */
export function buildDayRows(
  dateKey: string,
  {
    employees,
    shifts,
    records,
    branch,
    now,
    rota = [],
  }: {
    employees: User[]
    shifts: Shift[]
    records: Attendance[]
    branch: Branch
    now: Date
    /** Rota entries for the date (they override usual shifts). */
    rota?: RotaEntry[]
  },
): DayRow[] {
  const tz = branch.rules.timeZone
  const recordByEmployee = new Map(
    records.filter((r) => r.dateKey === dateKey).map((r) => [r.employeeId, r]),
  )

  return employees
    .filter((e) => e.status !== 'inactive' || recordByEmployee.has(e.id))
    .map((employee) => {
      const entry = rota.find((r) => r.employeeId === employee.id && r.date === dateKey)
      const plan = plannedShiftOn(employee.shiftId, entry, shifts, dateKey, tz)
      const shift = plan?.shift ?? shifts.find((s) => s.id === employee.shiftId) ?? null
      const record = recordByEmployee.get(employee.id) ?? null
      const instance = plan?.instance ?? null
      const shiftStartAt = record?.shiftStartAt ?? instance?.startAt ?? null
      if (record) {
        const r = resolveAttendance(record, branch.rules.attendance)
        return { employee, shift, record, shiftStartAt, ...r }
      }
      const status: DayStatus =
        !instance || instance.startAt < employee.hiredAt
          ? 'off'
          : employee.status === 'on_leave'
            ? 'leave'
            : isPastAbsenceWindow(instance.startAt, now, branch.rules.attendance)
              ? 'absent'
              : instance.startAt > now
                ? 'upcoming'
                : 'not_in_yet'
      return { employee, shift, record, shiftStartAt, status, lateMinutes: 0, workedMinutes: null }
    })
    .sort(
      (a, b) =>
        (a.shiftStartAt?.getTime() ?? Infinity) - (b.shiftStartAt?.getTime() ?? Infinity) ||
        a.employee.name.localeCompare(b.employee.name),
    )
}

export interface DaySummary {
  scheduled: number
  present: number
  late: number
  avgLate: number
  absent: number
  onLeave: number
  avgWorkedMinutes: number | null
}

export function summarize(rows: DayRow[]): DaySummary {
  const scheduled = rows.filter((r) => r.status !== 'off')
  const present = rows.filter((r) => r.status === 'on_time' || r.status === 'late')
  const late = rows.filter((r) => r.status === 'late')
  const worked = rows.flatMap((r) => (r.workedMinutes != null ? [r.workedMinutes] : []))
  return {
    scheduled: scheduled.length,
    present: present.length,
    late: late.length,
    avgLate: late.length
      ? Math.round(late.reduce((s, r) => s + r.lateMinutes, 0) / late.length)
      : 0,
    absent: rows.filter((r) => r.status === 'absent').length,
    onLeave: rows.filter((r) => r.status === 'leave').length,
    avgWorkedMinutes: worked.length
      ? Math.round(worked.reduce((s, m) => s + m, 0) / worked.length)
      : null,
  }
}
