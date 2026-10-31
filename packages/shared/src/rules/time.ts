/**
 * Timezone helpers. Shift times are stored as local "HH:mm" strings per branch
 * timezone; all instants are stored as UTC. These helpers convert between them
 * without a date library.
 */

const MINUTE_MS = 60_000

function parts(date: Date, timeZone: string): Record<string, number> {
  const out: Record<string, number> = {}
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return out
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. +330 for Asia/Kolkata). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = parts(date, timeZone)
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!)
  return Math.round((asUtc - date.getTime()) / MINUTE_MS)
}

/** Local calendar date of `date` in `timeZone`, as "YYYY-MM-DD". */
export function toDateKey(date: Date, timeZone: string): string {
  const p = parts(date, timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month!)}-${pad(p.day!)}`
}

/** The UTC instant for local `dateKey` + `time` ("HH:mm") in `timeZone`. */
export function zonedDateTime(dateKey: string, time: string, timeZone: string): Date {
  const [y = 0, m = 1, d = 1] = dateKey.split('-').map(Number)
  const [hh = 0, mm = 0] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const offset = tzOffsetMinutes(new Date(guess), timeZone)
  return new Date(guess - offset * MINUTE_MS)
}

/** Whole minutes from `from` to `to` (negative if `to` is earlier). */
export function minutesBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MINUTE_MS)
}
