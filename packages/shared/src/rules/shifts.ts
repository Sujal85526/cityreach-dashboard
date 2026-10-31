import { rotaShiftId } from './business'
import { toDateKey, zonedDateTime } from './time'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
/** How early an employee may clock in before their shift starts. */
export const EARLY_CLOCK_IN_HOURS = 3

export interface ShiftTimes {
  start: string
  end: string
  /** 0 = Sunday … 6 = Saturday */
  days: number[]
}

export interface ShiftInstance {
  /** Local date the shift starts on; also the attendance record's date. */
  dateKey: string
  startAt: Date
  endAt: Date
}

/** Minutes of day for "HH:mm". */
const minutesOfDay = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/**
 * Length of a shift in minutes; a shift that ends at or before its start runs past midnight.
 * Example: 07:00–15:00 → 480; Night 23:00–07:00 → 480; 09:00–09:00 → 1440.
 */
export function shiftLengthMinutes(start: string, end: string): number {
  return (minutesOfDay(end) - minutesOfDay(start) + 1440) % 1440 || 1440
}

/**
 * When a shift instance ends: its start plus the shift length. the clock-in code checks the
 * stored `shiftEndAt` with the same arithmetic, so it can't be moved earlier on the phone.
 */
export function shiftEndFrom(startAt: Date, start: string, end: string): Date {
  return new Date(startAt.getTime() + shiftLengthMinutes(start, end) * 60_000)
}

const weekday = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay()

/** The shift as it runs on `dateKey`, or null when it doesn't run that day. A night shift ends the next day. */
export function shiftOn(
  shift: ShiftTimes,
  dateKey: string,
  timeZone: string,
): ShiftInstance | null {
  if (!shift.days.includes(weekday(dateKey))) return null
  const startAt = zonedDateTime(dateKey, shift.start, timeZone)
  const endDay =
    shift.end <= shift.start ? toDateKey(new Date(startAt.getTime() + DAY_MS), timeZone) : dateKey
  return { dateKey, startAt, endAt: zonedDateTime(endDay, shift.end, timeZone) }
}

/**
 * The shift instance an employee is clocking in for at `now`: the one that started
 * (or starts within EARLY_CLOCK_IN_HOURS) and has not ended yet. Handles night shifts
 * across midnight by also checking yesterday's instance.
 * Example: Night 23:00–07:00, now 00:30 → yesterday's instance.
 */
export function currentShiftInstance(
  shift: ShiftTimes,
  now: Date,
  timeZone: string,
): ShiftInstance | null {
  const dateKeys = [-1, 0, 1].map((d) => toDateKey(new Date(now.getTime() + d * DAY_MS), timeZone))
  return (
    dateKeys
      .map((dk) => shiftOn(shift, dk, timeZone))
      .find(
        (i): i is ShiftInstance =>
          i !== null &&
          now.getTime() >= i.startAt.getTime() - EARLY_CLOCK_IN_HOURS * HOUR_MS &&
          now.getTime() < i.endAt.getTime(),
      ) ?? null
  )
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/**
 * The shift someone works on a date and when it runs. A rota entry overrides their usual shift
 * (and applies whatever the weekday; null = day off); without one, the usual shift on its days.
 * Example: usual Morning (Mon–Sat), rota says Evening on Sunday → Evening, Sunday 15:00–23:00.
 */
export function plannedShiftOn<S extends ShiftTimes & { id: string }>(
  usualShiftId: string | null,
  rotaEntry: { shiftId: string | null } | undefined,
  shifts: readonly S[],
  dateKey: string,
  timeZone: string,
): { shift: S; instance: ShiftInstance } | null {
  const id = rotaShiftId(usualShiftId, rotaEntry)
  const shift = id ? shifts.find((s) => s.id === id) : undefined
  if (!shift) return null
  const instance = shiftOn(rotaEntry ? { ...shift, days: EVERY_DAY } : shift, dateKey, timeZone)
  return instance ? { shift, instance } : null
}

/**
 * The planned shift being clocked into at `now` (from 3 h before it starts until it ends), looking
 * at yesterday's, today's and tomorrow's plan so night shifts work. Null outside every window.
 */
export function currentPlannedShift<S extends ShiftTimes & { id: string }>(
  planFor: (dateKey: string) => { shift: S; instance: ShiftInstance } | null,
  now: Date,
  timeZone: string,
): { shift: S; instance: ShiftInstance } | null {
  for (const d of [-1, 0, 1]) {
    const plan = planFor(toDateKey(new Date(now.getTime() + d * DAY_MS), timeZone))
    if (
      plan &&
      now.getTime() >= plan.instance.startAt.getTime() - EARLY_CLOCK_IN_HOURS * HOUR_MS &&
      now.getTime() < plan.instance.endAt.getTime()
    )
      return plan
  }
  return null
}
