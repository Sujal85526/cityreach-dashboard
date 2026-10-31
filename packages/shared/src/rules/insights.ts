import { monthProfit } from './business'
import { isOverdue, type TaskStatus } from './tasks'

/**
 * Business insights: labour against sales, best and worst days, waste, reorder suggestions and the
 * owner's per-branch summary. Everything is worked out from records the shop already keeps.
 */
const money = (n: number) => Math.round(n * 100) / 100
const oneDecimal = (n: number) => Math.round(n * 10) / 10

/** Last day of a month. Example: "2026-02" → "2026-02-28". */
export function monthEnd(month: string): string {
  const [year = 0, m = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10)
}

// ---- Labour cost vs sales ----

/** Common guideline for coffee shops: staff should cost about 30 % of sales or less. */
export const LABOUR_TARGET_PERCENT = 30
/** Above this the cost is clearly too high for the sales. */
export const LABOUR_HIGH_PERCENT = 40

export interface LabourStaff {
  id: string
  salary?: number | null
  allowances?: number
}

const monthlyPayOf = (s: LabourStaff) => (s.salary ?? 0) + (s.allowances ?? 0)

/** Labour as a percentage of sales; null without sales. Example: 3,000 on 10,000 → 30. */
export function labourPercent(cost: number, sales: number): number | null {
  return sales > 0 ? oneDecimal((cost / sales) * 100) : null
}

export const labourLevel = (percent: number | null) =>
  percent === null
    ? ('none' as const)
    : percent <= LABOUR_TARGET_PERCENT
      ? ('good' as const)
      : percent <= LABOUR_HIGH_PERCENT
        ? ('watch' as const)
        : ('high' as const)

/**
 * A month's staff cost: the net pay of each saved payslip (the same figure as Payroll on Sales &
 * finance), otherwise salary + allowances, scaled by `share` for a month still in progress.
 * Example: payslip 3,200 + a 4,000 salary without a payslip, half the month gone → 3,200 + 2,000.
 */
export function monthLabourCost(
  staff: LabourStaff[],
  payslips: { employeeId: string; net: number }[],
  share = 1,
) {
  const paid = new Set(payslips.map((p) => p.employeeId))
  const fromPayslips = payslips.reduce((sum, p) => sum + p.net, 0)
  const unpaid = staff.filter((s) => !paid.has(s.id))
  const estimated = unpaid.reduce((sum, s) => sum + monthlyPayOf(s), 0) * share
  return {
    cost: money(fromPayslips + estimated),
    estimatedStaff: unpaid.filter((s) => monthlyPayOf(s) > 0).length,
    /** Staff without a payslip or a salary: not in the figure, so it is too low until they're set. */
    staffWithoutPay: unpaid.filter((s) => monthlyPayOf(s) === 0).length,
  }
}

/**
 * Sales and staff cost per day. A day's cost is one 30th of the monthly pay of everyone who clocked
 * in that day. Example: two people on 3,000 → £200; sales of 1,000 → 20 %.
 */
export function labourByDay(
  sales: { date: string; total: number }[],
  attendance: { dateKey: string; employeeId: string; clockInAt: Date | null }[],
  staff: LabourStaff[],
) {
  const payById = new Map(staff.map((s) => [s.id, monthlyPayOf(s)]))
  const costByDay = new Map<string, number>()
  for (const r of attendance) {
    if (!r.clockInAt) continue
    const daily = (payById.get(r.employeeId) ?? 0) / 30
    costByDay.set(r.dateKey, (costByDay.get(r.dateKey) ?? 0) + daily)
  }
  const dates = new Set([...sales.map((s) => s.date), ...costByDay.keys()])
  const salesByDate = new Map(sales.map((s) => [s.date, s.total]))
  return [...dates].sort().map((date) => {
    const total = salesByDate.get(date) ?? 0
    const cost = money(costByDay.get(date) ?? 0)
    return { date, sales: total, labour: cost, percent: labourPercent(cost, total) }
  })
}

// ---- Best and worst days ----

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const weekdayOf = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`).getUTCDay()

/** Average sales per weekday, Monday first, counting only days that have sales entered. */
export function salesByWeekday(days: { date: string; total: number }[]) {
  const rows = WEEKDAYS.map((weekday) => ({ weekday, total: 0, days: 0, average: 0 }))
  for (const d of days) {
    const row = rows[weekdayOf(d.date)]
    if (!row) continue
    row.total += d.total
    row.days += 1
  }
  for (const row of rows) row.average = row.days ? money(row.total / row.days) : 0
  return [...rows.slice(1), ...rows.slice(0, 1)]
}

/** The weekdays with the highest and lowest average. Null until two weekdays have sales. */
export function bestAndWorstWeekday(rows: ReturnType<typeof salesByWeekday>) {
  const withSales = rows.filter((r) => r.days > 0).sort((a, b) => b.average - a.average)
  const best = withSales[0]
  const worst = withSales[withSales.length - 1]
  return best && worst && withSales.length > 1 ? { best, worst } : null
}

/** The highest and lowest single days. */
export function bestAndWorstDates(days: { date: string; total: number }[], count = 3) {
  const sorted = [...days].sort((a, b) => b.total - a.total)
  return { best: sorted.slice(0, count), worst: sorted.slice(-count).reverse() }
}

/** Sales per month, oldest first, with the change from the month before. */
export function salesByMonth(days: { date: string; total: number }[]) {
  const totals = new Map<string, { total: number; days: number }>()
  for (const d of days) {
    const month = d.date.slice(0, 7)
    const row = totals.get(month) ?? { total: 0, days: 0 }
    totals.set(month, { total: row.total + d.total, days: row.days + 1 })
  }
  const months = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))
  return months.map(([month, row], i) => {
    const previous = months[i - 1]?.[1].total
    return {
      month,
      total: money(row.total),
      days: row.days,
      average: money(row.total / row.days),
      changePercent: previous ? oneDecimal(((row.total - previous) / previous) * 100) : null,
    }
  })
}

// ---- Waste ----

export interface StockUse {
  itemId: string
  itemName: string
  delta: number
  reason: string
  createdAt: Date
}

/** The latest price paid per item, from orders that have arrived. */
export function lastUnitPrices(
  orders: {
    status: string
    receivedOn: string | null
    lines: { itemId: string; unitPrice: number }[]
  }[],
) {
  const prices = new Map<string, number>()
  const received = orders
    .filter((o) => o.status === 'received' && o.receivedOn)
    .sort((a, b) => (a.receivedOn ?? '').localeCompare(b.receivedOn ?? ''))
  for (const order of received)
    for (const line of order.lines) if (line.unitPrice > 0) prices.set(line.itemId, line.unitPrice)
  return prices
}

/**
 * What was thrown away, per item and most expensive first. Cost = quantity × the last price paid;
 * null when the item was never bought through a purchase order.
 * Example: 4 L of milk wasted, last bought at £6 → £24.
 */
export function wasteReport(movements: StockUse[], prices: Map<string, number>) {
  const rows = new Map<
    string,
    { itemId: string; itemName: string; quantity: number; times: number }
  >()
  for (const m of movements) {
    if (m.reason !== 'waste' || m.delta >= 0) continue
    const row = rows.get(m.itemId) ?? {
      itemId: m.itemId,
      itemName: m.itemName,
      quantity: 0,
      times: 0,
    }
    row.quantity = Math.round((row.quantity - m.delta) * 1000) / 1000
    row.times += 1
    rows.set(m.itemId, row)
  }
  const items = [...rows.values()]
    .map((row) => {
      const price = prices.get(row.itemId)
      return { ...row, cost: price === undefined ? null : money(row.quantity * price) }
    })
    .sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.quantity - a.quantity)
  return {
    items,
    totalCost: money(items.reduce((sum, i) => sum + (i.cost ?? 0), 0)),
    unpriced: items.filter((i) => i.cost === null).length,
  }
}

// ---- Reorder suggestions ----

/** How far back usage is averaged. */
export const REORDER_WINDOW_DAYS = 30
/** Suggest ordering when stock lasts this many days or fewer. */
export const REORDER_WARN_DAYS = 7
/** An order should cover this many days of use on top of the minimum. */
export const REORDER_COVER_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

export interface ReorderItem {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
  supplierId: string | null
  supplierName: string | null
}

/**
 * Items to buy now, soonest to run out first. Daily use = everything that left the stock (used,
 * wasted, or lost at a stock count) averaged over up to 30 days. Suggested when stock is below the
 * minimum or lasts 7 days or fewer; the amount brings it to the minimum plus 14 days of use.
 * Example: 6 L of milk, min 20 L, 60 L used in 30 days → 2 L a day, 3 days left, order 42 L.
 */
export function reorderSuggestions(items: ReorderItem[], movements: StockUse[], now: Date) {
  const used = new Map<string, { quantity: number; since: number }>()
  for (const m of movements) {
    if (m.delta >= 0 || m.reason === 'delivery') continue
    const row = used.get(m.itemId) ?? { quantity: 0, since: m.createdAt.getTime() }
    row.quantity -= m.delta
    row.since = Math.min(row.since, m.createdAt.getTime())
    used.set(m.itemId, row)
  }
  const suggestions = items.flatMap((item) => {
    const use = used.get(item.id)
    // A new item has only a few days of history: at least a week, so one busy day isn't "per day".
    const days = use
      ? Math.min(REORDER_WINDOW_DAYS, Math.max(7, Math.ceil((now.getTime() - use.since) / DAY_MS)))
      : REORDER_WINDOW_DAYS
    const dailyUse = use ? use.quantity / days : 0
    const daysLeft = dailyUse > 0 ? Math.floor(item.quantity / dailyUse) : null
    const isLow = item.quantity < item.minQuantity
    if (!isLow && (daysLeft === null || daysLeft > REORDER_WARN_DAYS)) return []
    const quantity = Math.ceil(item.minQuantity + dailyUse * REORDER_COVER_DAYS - item.quantity)
    if (quantity <= 0) return []
    return [{ ...item, dailyUse: oneDecimal(dailyUse), daysLeft, orderQuantity: quantity }]
  })
  return suggestions.sort(
    (a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.name.localeCompare(b.name),
  )
}

// ---- All branches (owner) ----

export interface BranchFigures {
  now: Date
  sales: number
  expenses: number
  payroll: number
  /** Staff cost for the % of sales: saved payslips plus an estimate for the rest. Defaults to `payroll`. */
  labourCost?: number
  staff: { status: string }[]
  today: { clockInAt: Date | null; status: string }[]
  tasks: { status: TaskStatus; deadline: Date }[]
  stock: { status: string }[]
  leave: { status: string }[]
}

/** One branch's line on the owner's overview. */
export function branchSummary(f: BranchFigures) {
  const { profit, margin } = monthProfit({
    sales: f.sales,
    expenses: f.expenses,
    payroll: f.payroll,
  })
  return {
    sales: money(f.sales),
    profit: money(profit),
    margin,
    labourPercent: labourPercent(f.labourCost ?? f.payroll, f.sales),
    staff: f.staff.filter((s) => s.status !== 'inactive').length,
    present: f.today.filter((r) => r.clockInAt).length,
    absent: f.today.filter((r) => r.status === 'absent').length,
    late: f.today.filter((r) => r.status === 'late').length,
    openTasks: f.tasks.filter((t) => t.status !== 'completed').length,
    overdueTasks: f.tasks.filter(
      (t) => t.status === 'overdue' || isOverdue(t.status, t.deadline, f.now),
    ).length,
    lowStock: f.stock.filter((i) => i.status !== 'in_stock').length,
    pendingLeave: f.leave.filter((l) => l.status === 'pending').length,
  }
}
export type BranchSummary = ReturnType<typeof branchSummary>

/** Totals across branches for the top of the overview. */
export function branchTotals(rows: BranchSummary[]) {
  const sum = (pick: (r: BranchSummary) => number) => rows.reduce((total, r) => total + pick(r), 0)
  const sales = money(sum((r) => r.sales))
  const profit = money(sum((r) => r.profit))
  return {
    sales,
    profit,
    margin: sales > 0 ? Math.round((profit / sales) * 1000) / 10 : null,
    staff: sum((r) => r.staff),
    present: sum((r) => r.present),
    absent: sum((r) => r.absent),
    overdueTasks: sum((r) => r.overdueTasks),
    lowStock: sum((r) => r.lowStock),
    pendingLeave: sum((r) => r.pendingLeave),
  }
}
