import { minutesBetween } from './time'

export const ATTENDANCE_STATUSES = ['on_time', 'late', 'absent', 'leave', 'off'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export interface AttendancePolicy {
  /** Minutes after shift start that still count as on time. */
  graceMinutes: number
  /** Minutes after shift start with no clock-in before the day is marked absent. */
  absentAfterMinutes: number
  /** Clocking out up to this many minutes before the shift ends isn't "left early". Missing = default. */
  earlyLeaveGraceMinutes?: number
}

export const DEFAULT_EARLY_LEAVE_GRACE_MINUTES = 10

export interface ClockInResult {
  status: Extract<AttendanceStatus, 'on_time' | 'late'>
  /** Full minutes after shift start (not minus grace), 0 when on time. */
  lateMinutes: number
}

/**
 * Classifies a clock-in against the scheduled start.
 * Example: start 07:00, clock-in 07:18, grace 5 → { status: 'late', lateMinutes: 18 }.
 */
export function classifyClockIn(
  shiftStart: Date,
  clockIn: Date,
  policy: Pick<AttendancePolicy, 'graceMinutes'>,
): ClockInResult {
  const diff = minutesBetween(shiftStart, clockIn)
  return diff > policy.graceMinutes
    ? { status: 'late', lateMinutes: diff }
    : { status: 'on_time', lateMinutes: 0 }
}

/** True once the absence window has passed with no clock-in. */
export function isPastAbsenceWindow(
  shiftStart: Date,
  now: Date,
  policy: Pick<AttendancePolicy, 'absentAfterMinutes'>,
): boolean {
  return minutesBetween(shiftStart, now) >= policy.absentAfterMinutes
}

/**
 * Minutes left in the shift at clock-out, or 0 within the grace period (or after the shift ended).
 * Example: shift ends 15:00, clock-out 12:45, grace 10 → 135 (left 2h 15m early); 14:55 → 0.
 */
export function earlyLeaveMinutes(
  shiftEndAt: Date | null | undefined,
  clockOut: Date,
  policy: Pick<AttendancePolicy, 'earlyLeaveGraceMinutes'>,
): number {
  if (!shiftEndAt) return 0
  const left = minutesBetween(clockOut, shiftEndAt)
  return left > (policy.earlyLeaveGraceMinutes ?? DEFAULT_EARLY_LEAVE_GRACE_MINUTES) ? left : 0
}

/** Worked minutes between clock-in and clock-out, never negative. */
export function workedMinutes(clockIn: Date, clockOut: Date): number {
  return Math.max(0, minutesBetween(clockIn, clockOut))
}

/** A clock-in is saved as 'pending' first; the next write (same action) sets on_time / late. */
export const ATTENDANCE_RECORD_STATUSES = ['pending', ...ATTENDANCE_STATUSES] as const
export type AttendanceRecordStatus = (typeof ATTENDANCE_RECORD_STATUSES)[number]

/**
 * Status, minutes late and worked minutes for display. Uses the stored values, filling in
 * any that are still missing (a 'pending' clock-in, or a clock-out not yet totalled) from
 * the server timestamps, so every screen shows the same numbers.
 */
export function resolveAttendance(
  record: {
    status: AttendanceRecordStatus
    lateMinutes: number
    workedMinutes: number | null
    shiftStartAt: Date | null
    clockInAt: Date | null
    clockOutAt: Date | null
  },
  policy: Pick<AttendancePolicy, 'graceMinutes'>,
): { status: AttendanceStatus; lateMinutes: number; workedMinutes: number | null } {
  let { lateMinutes } = record
  let status: AttendanceStatus = record.status === 'pending' ? 'on_time' : record.status
  if (record.status === 'pending' && record.clockInAt && record.shiftStartAt)
    ({ status, lateMinutes } = classifyClockIn(record.shiftStartAt, record.clockInAt, policy))
  const worked =
    record.workedMinutes ??
    (record.clockInAt && record.clockOutAt
      ? workedMinutes(record.clockInAt, record.clockOutAt)
      : null)
  return { status, lateMinutes, workedMinutes: worked }
}
