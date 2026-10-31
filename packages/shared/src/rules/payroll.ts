import { monthlyPay } from './leave'
import { shiftLengthMinutes } from './shifts'

/**
 * Payslip maths (monthly). UAE practice: a day's pay is basic salary ÷ 30, an hour's pay is a
 * day's pay ÷ 8, and overtime is paid at 125 % of the hourly basic pay.
 */
export const OVERTIME_MULTIPLIER = 1.25
/** Staying less than this past the shift on a day isn't counted as overtime. */
export const OVERTIME_MIN_MINUTES = 30
const HOURS_PER_DAY = 8

const money = (n: number) => Math.round(n * 100) / 100

/**
 * Overtime in a month: for each worked day, minutes worked beyond the shift's length, counted when
 * at least 30. Example: shift 07:00–15:00 (480 min), worked 9 h 10 m (550) → 70 min overtime.
 */
export function overtimeMinutes(
  records: { workedMinutes: number | null; shiftStart: string | null; shiftEnd: string | null }[],
): number {
  let total = 0
  for (const r of records) {
    if (r.workedMinutes == null || !r.shiftStart || !r.shiftEnd) continue
    const extra = r.workedMinutes - shiftLengthMinutes(r.shiftStart, r.shiftEnd)
    if (extra >= OVERTIME_MIN_MINUTES) total += extra
  }
  return total
}

export interface PayslipInput {
  /** Monthly basic salary. */
  salary: number
  /** Fixed monthly allowances (housing, transport…). */
  allowances: number
  overtimeMinutes: number
  bonus: number
  unpaidLeaveDays: number
  absentDays: number
  /** Other approved deductions (advance, damages…). */
  otherDeductions: number
}

/**
 * Example: basic 3,000 + allowances 500, 2 h overtime, bonus 200, 1 unpaid day, 1 absence,
 * no other deductions → overtime 3,000 ÷ 30 ÷ 8 × 1.25 × 2 = 31.25; leave/absence 200;
 * gross 3,731.25; net 3,531.25.
 */
export function payslipTotals(p: PayslipInput) {
  const hourlyRate = money(p.salary / 30 / HOURS_PER_DAY)
  const overtimePay = money(
    (p.salary / 30 / HOURS_PER_DAY) * OVERTIME_MULTIPLIER * (p.overtimeMinutes / 60),
  )
  const leaveDeduction = monthlyPay(p.salary, p.unpaidLeaveDays, p.absentDays).deduction
  const gross = money(p.salary + p.allowances + overtimePay + p.bonus)
  const deductions = money(leaveDeduction + p.otherDeductions)
  return {
    hourlyRate,
    overtimePay,
    leaveDeduction,
    gross,
    deductions,
    net: money(Math.max(0, gross - deductions)),
  }
}
