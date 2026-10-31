import type { Shift } from '@dm/shared'
import { format } from 'date-fns'

/** "07:00" → "7am", "15:30" → "3:30pm" (prototype style). */
export function formatTimeOfDay(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`
}

/** "Morning · 7am–3pm" */
export const shiftLabel = (shift: Pick<Shift, 'name' | 'start' | 'end'>) =>
  `${shift.name} · ${formatTimeOfDay(shift.start)}–${formatTimeOfDay(shift.end)}`

export const formatDate = (date: Date) => format(date, 'd MMM yyyy')

/** Instants are shown in the shop's timezone (branch setting), not the viewer's device timezone. */
export const formatDateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

export const formatClock = (date: Date | null, timeZone: string) =>
  date
    ? new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(date)
    : '—'

/** 485 → "8h 5m" */
export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

/** "Today · 2:00 PM", "Tomorrow · 9:00 AM", "Yesterday · …" or "9 Oct · 2:00 PM", in the shop's timezone. */
export function formatDue(date: Date, timeZone: string, now = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(d) // YYYY-MM-DD
  const diff = Math.round(
    (Date.parse(`${day(date)}T00:00:00Z`) - Date.parse(`${day(now)}T00:00:00Z`)) / 86_400_000,
  )
  const label =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : diff === -1
          ? 'Yesterday'
          : new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(date)
  return `${label} · ${formatClock(date, timeZone)}`
}

/** "just now", "5m ago", "2h ago", "3d ago" (prototype "Updated 2h ago"). */
export function formatAgo(date: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** 14 → "14", 0.5 → "0.5" (no trailing zeros), with the unit: "14 L". */
export const formatQty = (quantity: number, unit: string) =>
  `${Number(quantity.toFixed(3))} ${unit}`

/** "AED 2,700" (the shop's currency is AED; up to 2 decimals, none when whole). */
/** Whole amounts without decimals ("AED 3,000"), otherwise always two ("AED 3,446.30"). */
export const formatMoney = (n: number) => {
  const digits = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

/** Local date key "2026-10-20" → "20 Oct 2026" (no timezone shift). */
export const formatDay = (dateKey: string | null | undefined) =>
  dateKey
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${dateKey}T12:00:00Z`))
    : '—'
