/**
 * Report periods on local calendar dates ("YYYY-MM-DD" in the branch timezone).
 * Weeks are ISO weeks (Monday–Sunday, e.g. "2026-W41"); months are "2026-10".
 */

const DAY_MS = 86_400_000
const toUtc = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`)
const toKey = (d: Date) => d.toISOString().slice(0, 10)
export const shiftDate = (dateKey: string, days: number) =>
  toKey(new Date(toUtc(dateKey).getTime() + days * DAY_MS))

export type PeriodType = 'weekly' | 'monthly'

export interface PeriodRange {
  /** First local date (inclusive). */
  from: string
  /** Last local date (inclusive). */
  to: string
}

/** ISO week key of a local date. Example: 2026-10-07 (a Wednesday) → "2026-W41". */
export function weekKeyOf(dateKey: string): string {
  const d = toUtc(dateKey)
  const weekday = d.getUTCDay() || 7 // Monday = 1 … Sunday = 7
  const thursday = new Date(d.getTime() + (4 - weekday) * DAY_MS) // the week's Thursday decides the year
  const year = thursday.getUTCFullYear()
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Monday–Sunday of an ISO week key. */
export function weekRange(weekKey: string): PeriodRange {
  const [y = '0', w = '1'] = weekKey.split('-W')
  const jan4 = new Date(Date.UTC(Number(y), 0, 4))
  const monday = new Date(
    jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY_MS + (Number(w) - 1) * 7 * DAY_MS,
  )
  const from = toKey(monday)
  return { from, to: shiftDate(from, 6) }
}

export function monthRange(monthKey: string): PeriodRange {
  const [y = 0, m = 1] = monthKey.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(last).padStart(2, '0')}` }
}

export const periodRange = (type: PeriodType, key: string) =>
  type === 'weekly' ? weekRange(key) : monthRange(key)
export const periodKeyOf = (type: PeriodType, dateKey: string) =>
  type === 'weekly' ? weekKeyOf(dateKey) : dateKey.slice(0, 7)

/** The period before `key` (previous week / month). */
export function previousPeriod(type: PeriodType, key: string): string {
  return periodKeyOf(type, shiftDate(periodRange(type, key).from, -1))
}

/** The last `count` week keys ending with the week containing `dateKey`, oldest first. */
export function lastWeeks(dateKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    weekKeyOf(shiftDate(dateKey, -7 * (count - 1 - i))),
  )
}

/** "6 – 12 Oct 2026" / "October 2026". */
export function periodLabel(type: PeriodType, key: string): string {
  const { from, to } = periodRange(type, key)
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' }).format(toUtc(k))
  if (type === 'monthly') return fmt(from, { month: 'long', year: 'numeric' })
  return `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`
}
