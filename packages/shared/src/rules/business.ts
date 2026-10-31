/**
 * Rules for the operations, finance and HR modules: end-of-service pay, final settlement,
 * temperature checks, equipment servicing, purchase orders, monthly profit, VAT dates, rota.
 * All dates are local "YYYY-MM-DD"; amounts are in the shop's currency.
 */
import { addDays, daysUntil } from './expiry'

const money = (n: number) => Math.round(n * 100) / 100

// ---- End of service (contractual long-service payment) ----

const plusYears = (dateKey: string, years: number) =>
  `${Number(dateKey.slice(0, 4)) + years}${dateKey.slice(4)}`

/**
 * Years of service: whole years by anniversary, plus the days after the last anniversary ÷ 365.
 * The last day counts as worked. Example: joined 21 Oct 2023, last day 20 Oct 2026 → exactly 3.
 */
export function serviceYears(joinedOn: string, lastDay: string): number {
  const end = addDays(lastDay, 1)
  if (end <= joinedOn) return 0
  let whole = Number(end.slice(0, 4)) - Number(joinedOn.slice(0, 4))
  if (plusYears(joinedOn, whole) > end) whole--
  return whole + daysUntil(end, plusYears(joinedOn, whole)) / 365
}

/**
 * End-of-service pay on basic salary: nothing under one year; 21 days' basic pay a year for the first five
 * years and 30 days a year after that (part years pro rata); never more than two years' pay.
 * Example: basic 3,000 (100 a day), 6.5 years → 5 × 21 + 1.5 × 30 = 150 days → 15,000.
 */
export function gratuity(basicSalary: number, years: number): number {
  if (years < 1) return 0
  const daily = basicSalary / 30
  const days = 21 * Math.min(years, 5) + 30 * Math.max(0, years - 5)
  return money(Math.min(days * daily, basicSalary * 24))
}

export interface SettlementInput {
  basicSalary: number
  allowances: number
  joinedOn: string
  lastDay: string
  /** Annual leave left (days), paid out at the basic daily rate. */
  unusedLeaveDays: number
  otherDeductions: number
}

/**
 * Final settlement: gratuity + unused annual leave (basic ÷ 30 a day) + this month's salary up to
 * the last day (full pay ÷ 30 a day) − other deductions.
 */
export function finalSettlement(i: SettlementInput) {
  const years = serviceYears(i.joinedOn, i.lastDay)
  const daysThisMonth = Number(i.lastDay.slice(8, 10))
  const gratuityPay = gratuity(i.basicSalary, years)
  const leavePay = money((i.basicSalary / 30) * i.unusedLeaveDays)
  const salaryDue = money(((i.basicSalary + i.allowances) / 30) * Math.min(30, daysThisMonth))
  const total = money(gratuityPay + leavePay + salaryDue - i.otherDeductions)
  return {
    years: Math.round(years * 100) / 100,
    gratuity: gratuityPay,
    leavePay,
    salaryDue,
    daysThisMonth,
    total: Math.max(0, total),
  }
}

// ---- Food safety ----

/** A cold-unit reading within its allowed range (inclusive). Example: fridge 1–5 °C, 7 °C → false. */
export const temperatureOk = (reading: number, min: number, max: number) =>
  reading >= min && reading <= max

// ---- Equipment ----

/** Next service date: last service (or purchase) + interval. Null when no interval is set. */
export function nextServiceOn(
  lastServiceOn: string | null,
  purchasedOn: string | null,
  everyDays: number | null,
): string | null {
  const from = lastServiceOn ?? purchasedOn
  return from && everyDays ? addDays(from, everyDays) : null
}

// ---- Purchasing ----

export interface OrderLine {
  quantity: number
  unitPrice: number
}

/** Order total. Example: 10 × 12.5 + 4 × 30 = 245. */
export const orderTotal = (lines: OrderLine[]) =>
  money(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))

// ---- Finance ----

export interface MonthFigures {
  sales: number
  expenses: number
  /** Salaries from the month's payslips (net pay). */
  payroll: number
}

/** Profit = sales − expenses − payroll; margin as a whole percent of sales. */
export function monthProfit({ sales, expenses, payroll }: MonthFigures) {
  const profit = money(sales - expenses - payroll)
  return { profit, margin: sales > 0 ? Math.round((profit / sales) * 100) : null }
}

/**
 * VAT returns are due 28 days after each tax period ends. Given one period end ("2026-03") and the
 * period length (1 or 3 months), the next due date on or after today.
 * Example: quarters ending Mar / Jun / Sep / Dec → period ending 30 Sep is due 28 Oct.
 */
export function nextVatDue(today: string, anyPeriodEnd: string, months: 1 | 3): string {
  const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1
  const ym = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
  const lastDay = (i: number) => addDays(`${ym(i + 1)}-01`, -1)
  let i = monthIndex(today.slice(0, 7)) - 1
  while ((((i - monthIndex(anyPeriodEnd)) % months) + months) % months !== 0) i--
  for (;;) {
    const due = addDays(lastDay(i), 28)
    if (due >= today) return due
    i += months
  }
}

// ---- Rota ----

/**
 * The shift someone works on a date: the rota entry for that day when there is one (a shift, or
 * null for a day off), otherwise their usual shift.
 */
export function rotaShiftId(
  usualShiftId: string | null,
  entry: { shiftId: string | null } | undefined,
): string | null {
  return entry ? entry.shiftId : usualShiftId
}
