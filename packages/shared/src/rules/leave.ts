/**
 * Leave and pay rules. Leave types and their yearly allowances are set by the manager
 * (Settings → Leave types, per-employee overrides on the profile). The leave year is the
 * calendar year. Pay is a monthly estimate: salary − (unpaid leave days + absent days) × salary ÷ 30.
 */

export interface LeaveType {
  id: string
  name: string
  /** Days per calendar year; null = no limit (e.g. unpaid leave). */
  daysPerYear: number | null
  /** Paid types use the balance first; days beyond it are unpaid. */
  paid: boolean
}

export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: 'annual', name: 'Annual leave', daysPerYear: 28, paid: true },
  { id: 'sick', name: 'Sick leave', daysPerYear: 10, paid: true },
  { id: 'emergency', name: 'Emergency leave', daysPerYear: 5, paid: true },
  { id: 'maternity', name: 'Maternity leave', daysPerYear: 60, paid: true },
  { id: 'paternity', name: 'Paternity leave', daysPerYear: 10, paid: true },
  { id: 'bereavement', name: 'Bereavement leave', daysPerYear: 5, paid: true },
  { id: 'unpaid', name: 'Unpaid leave', daysPerYear: null, paid: false },
]

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

/** A request can't cover more than this many working days (keeps one approval in one batch). */
export const MAX_LEAVE_DAYS = 90

const DAY_MS = 86_400_000
const weekday = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay()
const nextDay = (dateKey: string) =>
  new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10)

/**
 * The working days a leave covers: dates from `from` to `to` (inclusive) on which the employee
 * works (their shift's days; 0 = Sunday). Days off aren't counted against the balance.
 * Example: Mon 5 Oct – Sun 11 Oct with a Mon–Sat shift → 6 days.
 */
export function leaveDates(from: string, to: string, workDays: number[]): string[] {
  const dates: string[] = []
  for (let d = from; d <= to && dates.length <= MAX_LEAVE_DAYS; d = nextDay(d))
    if (workDays.includes(weekday(d))) dates.push(d)
  return dates
}

/** The employee's yearly allowance for a type: their override, else the type's default. */
export function allowanceFor(
  type: LeaveType,
  overrides: Record<string, number> | null | undefined,
): number | null {
  if (type.daysPerYear === null) return null
  return overrides?.[type.id] ?? type.daysPerYear
}

/** What a balance needs from a request. Approved paid days are the first `paidDays` dates. */
export interface LeaveUsage {
  typeId: string
  status: LeaveStatus
  dates: string[]
  paidDays: number | null
}

export interface LeaveBalance {
  /** null = no limit */
  allowed: number | null
  used: number
  pending: number
  remaining: number | null
}

/**
 * Balance for one type in a calendar year. Used = approved paid days in that year; pending =
 * days still waiting for a decision. Example: 30 allowed, 4 approved, 3 pending → 23 remaining.
 */
export function leaveBalance(
  type: LeaveType,
  allowed: number | null,
  requests: LeaveUsage[],
  year: number,
): LeaveBalance {
  const inYear = (d: string) => d.startsWith(`${year}-`)
  let used = 0
  let pending = 0
  for (const r of requests) {
    if (r.typeId !== type.id) continue
    if (r.status === 'approved')
      used += r.dates.slice(0, r.paidDays ?? r.dates.length).filter(inYear).length
    if (r.status === 'pending') pending += r.dates.filter(inYear).length
  }
  return {
    allowed,
    used,
    pending,
    remaining: allowed === null ? null : Math.max(0, allowed - used - pending),
  }
}

/**
 * How many requested days are paid: unpaid types pay none; paid types pay up to the remaining
 * balance (excluding this request) and the rest is unpaid.
 * Example: 5 days of annual leave with 3 days left → 3 paid, 2 unpaid.
 */
export function splitPaidDays(
  days: number,
  type: Pick<LeaveType, 'paid'>,
  remaining: number | null,
): { paidDays: number; unpaidDays: number } {
  const paidDays = !type.paid ? 0 : remaining === null ? days : Math.min(days, remaining)
  return { paidDays, unpaidDays: days - paidDays }
}

/** Days that cost pay in a month: unpaid leave (approved beyond balance or unpaid type) and absences. */
export function payFacts(records: { status: string; leavePaid?: boolean }[]): {
  unpaidLeaveDays: number
  absentDays: number
} {
  return {
    unpaidLeaveDays: records.filter((r) => r.status === 'leave' && r.leavePaid === false).length,
    absentDays: records.filter((r) => r.status === 'absent').length,
  }
}

const money = (n: number) => Math.round(n * 100) / 100

/**
 * Monthly pay estimate (a day's pay is the monthly salary ÷ 30).
 * Example: £3,000, 2 unpaid leave days + 1 absence → £100/day, £300 deducted, £2,700.
 */
export function monthlyPay(salary: number, unpaidLeaveDays: number, absentDays: number) {
  const dailyRate = money(salary / 30)
  const deduction = money(Math.min(salary, (salary / 30) * (unpaidLeaveDays + absentDays)))
  return { dailyRate, deduction, net: money(salary - deduction) }
}
