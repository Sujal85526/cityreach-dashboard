/**
 * Document expiry (licenses, contracts, insurance). Dates are local "YYYY-MM-DD" in the shop's
 * timezone; a document is valid through its expiry date and expired from the next day.
 */

export const REMIND_DAYS_OPTIONS = [7, 14, 30, 60, 90] as const
export const DEFAULT_REMIND_DAYS = 30

export type ExpiryState = 'expired' | 'expiring_soon' | 'valid'

const DAY_MS = 86_400_000
const dayNumber = (dateKey: string) =>
  Date.UTC(+dateKey.slice(0, 4), +dateKey.slice(5, 7) - 1, +dateKey.slice(8, 10)) / DAY_MS

/** Whole days from `today` until `expiresOn` (0 = expires today, negative = already expired). */
export const daysUntil = (expiresOn: string, today: string) =>
  dayNumber(expiresOn) - dayNumber(today)

/**
 * Example: expires 2027-01-15, remind 30 days before: on 2026-12-01 → valid (45 days left);
 * 2026-12-20 → expiring_soon (26); 2027-01-15 → expiring_soon (0, last day); 2027-01-16 → expired.
 */
export function expiryState(
  expiresOn: string,
  today: string,
  remindDaysBefore: number,
): ExpiryState {
  const left = daysUntil(expiresOn, today)
  return left < 0 ? 'expired' : left <= remindDaysBefore ? 'expiring_soon' : 'valid'
}

/** The date the reminder window opens: the furthest ahead a query needs to look (`today + 90`). */
export function addDays(dateKey: string, days: number): string {
  return new Date((dayNumber(dateKey) + days) * DAY_MS).toISOString().slice(0, 10)
}
