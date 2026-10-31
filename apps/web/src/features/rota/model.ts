import { addDays, plannedShiftOn, type RotaEntry, type Shift } from '@dm/shared'

/** Monday of the week containing `dateKey`. */
export function weekStartOf(dateKey: string): string {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay()
  return addDays(dateKey, -((day + 6) % 7))
}

export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i))

export const dayHeading = (dateKey: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`))

/** Who works what on a date: the rota entry, else the usual shift on its days. */
export function plannedShiftId(
  usualShiftId: string | null,
  rota: RotaEntry[],
  employeeId: string,
  date: string,
  shifts: Shift[],
  timeZone: string,
): string | null {
  const entry = rota.find((r) => r.employeeId === employeeId && r.date === date)
  return plannedShiftOn(usualShiftId, entry, shifts, date, timeZone)?.shift.id ?? null
}
