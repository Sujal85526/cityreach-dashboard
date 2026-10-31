import {
  addDays,
  bestAndWorstWeekday,
  branchTotals,
  displayTaskStatus,
  LABOUR_TARGET_PERCENT,
  labourLevel,
  labourPercent,
  lastUnitPrices,
  monthLabourCost,
  monthProfit,
  monthEnd,
  reorderSuggestions,
  salesByWeekday,
  wasteReport,
  type Attendance,
  type BranchSummary,
  type InventoryItem,
  type LeaveRequest,
  type Payslip,
  type PurchaseOrder,
  type StockMovement,
  type Task,
  type User,
} from '@cityreach/shared'
import { formatDay, formatDue, formatMoney, formatQty } from '@/lib/format'
import { capped, dayWord, type Answer, type AnswerLine } from './answers'
import type { When } from './intents'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const names = (list: { employeeName: string }[]) => list.map((r) => r.employeeName).join(', ')

export function teamTodayAnswer(records: Attendance[], staff: number, when: When | null): Answer {
  const word = dayWord(when)
  const link = { to: '/attendance', label: 'Open attendance' }
  if (when === 'tomorrow')
    return {
      text: "Attendance is known on the day. The rota shows who's planned for tomorrow.",
      link: { to: '/rota', label: 'Open rota' },
    }
  const present = records.filter((r) => r.clockInAt)
  const late = records.filter((r) => r.status === 'late')
  const absent = records.filter((r) => r.status === 'absent')
  const leave = records.filter((r) => r.status === 'leave')
  const lines: AnswerLine[] = []
  if (absent.length) lines.push({ text: 'Absent', note: names(absent), tone: 'danger' })
  if (late.length) lines.push({ text: 'Late', note: names(late), tone: 'warning' })
  if (leave.length) lines.push({ text: 'On leave', note: names(leave) })
  if (present.length) lines.push({ text: 'Clocked in', note: names(present), tone: 'success' })
  return {
    text:
      records.length === 0
        ? `Nothing recorded ${word} yet.`
        : `${present.length} of ${staff} staff clocked in ${word}, ${absent.length} absent, ${late.length} late.`,
    lines,
    link,
  }
}

export function teamTasksAnswer(
  tasks: Task[],
  today: string,
  timeZone: string,
  now = new Date(),
): Answer {
  const link = { to: '/tasks', label: 'Open tasks' }
  const overdue = tasks.filter((t) => displayTaskStatus(t.status, t.deadline, now) === 'overdue')
  if (tasks.length === 0) return { text: 'There are no open tasks.', link }
  const dueToday = tasks.filter(
    (t) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(t.deadline) === today,
  )
  const lines: AnswerLine[] = [...overdue, ...dueToday.filter((t) => !overdue.includes(t))].map(
    (t) => ({
      text: `${t.title} (${t.assigneeName})`,
      note: `Due ${formatDue(t.deadline, timeZone, now)}`,
      tone: overdue.includes(t) ? 'danger' : undefined,
    }),
  )
  return {
    text: `${plural(tasks.length, 'open task')}: ${overdue.length} overdue, ${dueToday.length} due today.`,
    lines: capped(lines),
    link,
  }
}

export function lowStockAnswer(items: InventoryItem[]): Answer {
  const link = { to: '/inventory', label: 'Open inventory' }
  const low = items
    .filter((i) => i.status !== 'in_stock')
    .sort((a, b) => Number(b.status === 'critical') - Number(a.status === 'critical'))
  if (low.length === 0) return { text: 'Everything is above its minimum.', link }
  return {
    text: `${plural(low.length, 'item')} below the minimum:`,
    lines: capped(
      low.map((i) => ({
        text: i.name,
        note: `${formatQty(i.quantity, i.unit)} left, minimum ${formatQty(i.minQuantity, i.unit)}`,
        tone: i.status === 'critical' ? 'danger' : 'warning',
      })),
    ),
    link,
  }
}

export function reorderAnswer(
  items: InventoryItem[],
  movements: StockMovement[],
  now = new Date(),
): Answer {
  const link = { to: '/insights?tab=reorder', label: 'Open reorder suggestions' }
  const rows = reorderSuggestions(items, movements, now)
  if (rows.length === 0) return { text: 'Nothing needs ordering right now.', link }
  return {
    text: `I'd order ${plural(rows.length, 'item')}:`,
    lines: capped(
      rows.map((r) => ({
        text: `${r.name}: order ${formatQty(r.orderQuantity, r.unit)}`,
        note: r.daysLeft === null ? 'Below its minimum' : `About ${r.daysLeft} days left`,
        tone: r.daysLeft !== null && r.daysLeft <= 3 ? 'danger' : undefined,
      })),
    ),
    link,
  }
}

export function leaveToReviewAnswer(requests: LeaveRequest[]): Answer {
  const link = { to: '/leave', label: 'Open leave & pay' }
  const pending = requests.filter((r) => r.status === 'pending')
  if (pending.length === 0) return { text: 'No leave requests are waiting for you.', link }
  return {
    text: `${plural(pending.length, 'leave request')} waiting for your decision:`,
    lines: capped(
      pending.map((r) => ({
        text: r.employeeName,
        note: r.from === r.to ? formatDay(r.from) : `${formatDay(r.from)} – ${formatDay(r.to)}`,
      })),
    ),
    link,
  }
}

/** The dates a sales question covers. */
export function salesRange(when: When | null, today: string) {
  if (when === 'today') return { from: today, to: today, label: 'today' }
  if (when === 'yesterday') {
    const day = addDays(today, -1)
    return { from: day, to: day, label: 'yesterday' }
  }
  if (when === 'week') return { from: addDays(today, -6), to: today, label: 'in the last 7 days' }
  return { from: `${today.slice(0, 7)}-01`, to: today, label: 'this month' }
}

export function salesAnswer(days: { date: string; total: number }[], label: string): Answer {
  const link = { to: '/finance', label: 'Open sales & finance' }
  if (days.length === 0) return { text: `No takings have been entered ${label} yet.`, link }
  const total = days.reduce((sum, d) => sum + d.total, 0)
  return {
    text: `Sales ${label}: ${formatMoney(total)}.`,
    lines:
      days.length > 1
        ? [
            { text: 'Days entered', note: String(days.length) },
            { text: 'Average per day', note: formatMoney(total / days.length) },
          ]
        : undefined,
    link,
  }
}

export function profitAnswer(sales: number, expenses: number, payroll: number): Answer {
  const { profit, margin } = monthProfit({ sales, expenses, payroll })
  return {
    text:
      sales === 0
        ? 'No sales entered this month yet.'
        : `Profit this month: ${formatMoney(profit)}${margin === null ? '' : ` (${margin} % of sales)`}.`,
    lines: [
      { text: 'Sales', note: formatMoney(sales) },
      { text: 'Expenses', note: formatMoney(expenses) },
      { text: 'Payroll', note: formatMoney(payroll) },
    ],
    link: { to: '/finance', label: 'Open sales & finance' },
  }
}

export function labourAnswer(
  staff: User[],
  payslips: Payslip[],
  sales: number,
  today: string,
): Answer {
  const end = monthEnd(today.slice(0, 7))
  const labour = monthLabourCost(staff, payslips, Number(today.slice(8)) / Number(end.slice(8)))
  const percent = labourPercent(labour.cost, sales)
  const link = { to: '/insights?tab=labour', label: 'Open labour vs sales' }
  if (percent === null)
    return { text: 'No sales entered this month yet, so there is nothing to compare.', link }
  const verdict = { good: 'on target', watch: 'worth watching', high: 'too high', none: '' }[
    labourLevel(percent)
  ]
  return {
    text: `Staff cost is ${percent} % of sales this month, ${verdict} (target ${LABOUR_TARGET_PERCENT} % or less).`,
    lines: [
      { text: 'Staff cost so far', note: formatMoney(labour.cost) },
      { text: 'Sales so far', note: formatMoney(sales) },
      ...(labour.staffWithoutPay
        ? [
            {
              text: `${labour.staffWithoutPay} ${labour.staffWithoutPay === 1 ? 'person' : 'people'} with no salary set`,
              note: 'Real cost is higher',
              tone: 'warning' as const,
            },
          ]
        : []),
    ],
    link,
  }
}

export function wasteAnswer(
  movements: StockMovement[],
  orders: PurchaseOrder[],
  items: Pick<InventoryItem, 'id' | 'unit'>[] = [],
): Answer {
  const unit = (id: string) => items.find((i) => i.id === id)?.unit ?? ''
  const report = wasteReport(movements, lastUnitPrices(orders))
  const link = { to: '/insights?tab=waste', label: 'Open waste report' }
  if (report.items.length === 0) return { text: 'No waste recorded this month.', link }
  return {
    text: `Waste this month cost ${formatMoney(report.totalCost)}${report.unpriced ? ` (${report.unpriced} items have no price yet)` : ''}:`,
    lines: capped(
      report.items.map((i) => ({
        text: i.itemName,
        note: `${formatQty(i.quantity, unit(i.itemId))} wasted${i.cost === null ? '' : `, ${formatMoney(i.cost)}`}`,
      })),
    ),
    link,
  }
}

export function bestDayAnswer(days: { date: string; total: number }[]): Answer {
  const link = { to: '/insights?tab=days', label: 'Open best & worst days' }
  const extremes = bestAndWorstWeekday(salesByWeekday(days))
  if (!extremes) return { text: 'I need more days of sales to compare.', link }
  return {
    text: `Over the last 3 months, your best day is ${extremes.best.weekday} and your quietest is ${extremes.worst.weekday}.`,
    lines: [
      { text: extremes.best.weekday, note: `${formatMoney(extremes.best.average)} on average` },
      { text: extremes.worst.weekday, note: `${formatMoney(extremes.worst.average)} on average` },
    ],
    link,
  }
}

export function attentionAnswer(f: {
  absent: number
  overdueTasks: number
  lowStock: number
  pendingLeave: number
}): Answer {
  const lines: AnswerLine[] = []
  if (f.absent) lines.push({ text: `${plural(f.absent, 'person')} absent today`, tone: 'danger' })
  if (f.overdueTasks)
    lines.push({ text: `${plural(f.overdueTasks, 'task')} overdue`, tone: 'danger' })
  if (f.lowStock)
    lines.push({ text: `${plural(f.lowStock, 'item')} low on stock`, tone: 'warning' })
  if (f.pendingLeave)
    lines.push({ text: `${plural(f.pendingLeave, 'leave request')} to review`, tone: 'info' })
  const link = { to: '/', label: 'Open dashboard' }
  return lines.length
    ? { text: 'These need you today:', lines, link }
    : { text: 'Nothing urgent right now. 👍', link }
}

export function branchesAnswer(rows: { name: string; summary: BranchSummary }[]): Answer {
  const totals = branchTotals(rows.map((r) => r.summary))
  return {
    text: `Across ${plural(rows.length, 'branch').replace('branchs', 'branches')}: ${formatMoney(totals.sales)} sales and ${formatMoney(totals.profit)} profit this month.`,
    lines: capped(
      rows.map((r) => ({
        text: r.name,
        note: `${formatMoney(r.summary.sales)} sales, ${r.summary.present} of ${r.summary.staff} in today`,
      })),
    ),
    link: { to: '/branches/all', label: 'Open all branches' },
  }
}
