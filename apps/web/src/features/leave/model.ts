import {
  allowanceFor,
  DEFAULT_LEAVE_TYPES,
  leaveBalance,
  type Branch,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Shift,
  type User,
} from '@cityreach/shared'

/** The leave types the shop offers (Settings → Leave types), or the defaults until saved. */
export const leaveTypesOf = (branch: Pick<Branch, 'leaveTypes'>): LeaveType[] =>
  branch.leaveTypes ?? DEFAULT_LEAVE_TYPES

/** A type that was removed from Settings after it was used still shows by its saved name. */
export const typeOf = (branch: Branch, typeId: string, typeName = typeId): LeaveType =>
  leaveTypesOf(branch).find((t) => t.id === typeId) ?? {
    id: typeId,
    name: typeName,
    daysPerYear: null,
    paid: true,
  }

/** Days the employee works: their shift's days, else the days the shop is open. */
export const workDaysOf = (shift: Shift | null, branch: Branch): number[] =>
  shift?.days ?? branch.businessHours.filter((h) => !h.closed).map((h) => h.day)

export interface TypeBalance extends LeaveBalance {
  type: LeaveType
}

/** One balance per leave type for an employee in a calendar year. */
export function balancesFor(
  employee: Pick<User, 'leaveAllowances'>,
  branch: Branch,
  requests: LeaveRequest[],
  year: number,
): TypeBalance[] {
  return leaveTypesOf(branch).map((type) => ({
    type,
    ...leaveBalance(type, allowanceFor(type, employee.leaveAllowances), requests, year),
  }))
}

const dayMonth = (dateKey: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${dateKey}T12:00:00Z`),
  )

/** "2 Nov" or "2 Nov – 4 Nov". */
export const formatRange = (from: string, to: string) =>
  from === to ? dayMonth(from) : `${dayMonth(from)} – ${dayMonth(to)}`

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export { formatMoney } from '@/lib/format'
