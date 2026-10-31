import {
  addDays,
  DEFAULT_REMIND_DAYS,
  expiryState,
  nextServiceOn,
  nextVatDue,
  type Branch,
  type Candidate,
  type Equipment,
  type Incident,
  type LeaveRequest,
  type Payslip,
  type PurchaseOrder,
  type StoredDocument,
  type SwapRequest,
  type TemperatureLog,
  type User,
} from '@cityreach/shared'
import { formatDay } from '@/lib/format'

export type AttentionKind =
  | 'leave'
  | 'swap'
  | 'document'
  | 'stock'
  | 'task'
  | 'absence'
  | 'temperature'
  | 'incident'
  | 'equipment'
  | 'invoice'
  | 'vat'
  | 'payslip'
  | 'probation'
  | 'interview'

export interface AttentionItem {
  kind: AttentionKind
  text: string
  to: string
  tone: 'danger' | 'warning' | 'info'
}

export interface AttentionData {
  today: string
  branch: Branch
  leave: LeaveRequest[]
  swaps: SwapRequest[]
  documents: StoredDocument[]
  employees: User[]
  payslips: Payslip[]
  incidents: Incident[]
  temperatures: TemperatureLog[]
  equipment: Equipment[]
  orders: PurchaseOrder[]
  candidates: Candidate[]
  absent: number
  overdueTasks: number
  lowStock: number
  criticalStock: number
}

/** From this day of the month, unprepared payslips show up. */
export const PAYSLIP_REMINDER_DAY = 25
const SOON = 7
const VAT_WARNING_DAYS = 14

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Everything the manager should deal with, most urgent first; each item links to where it's
 * handled. Pure, so it is unit-tested apart from the screens.
 */
export function attentionItems(d: AttentionData): AttentionItem[] {
  const soon = addDays(d.today, SOON)
  const count = <T>(xs: T[], keep: (x: T) => boolean) => xs.filter(keep).length
  const docState = (x: StoredDocument) =>
    x.expiresOn
      ? expiryState(x.expiresOn, d.today, x.remindDaysBefore ?? DEFAULT_REMIND_DAYS)
      : null
  const unpaid = d.orders.filter((o) => o.status === 'received' && !o.paidOn && o.paymentDueOn)
  const due = (o: PurchaseOrder) => o.paymentDueOn ?? ''
  const vatDue = d.branch.vat
    ? nextVatDue(d.today, d.branch.vat.periodEnd, d.branch.vat.months)
    : null
  const isPayday = Number(d.today.slice(8, 10)) >= PAYSLIP_REMINDER_DAY

  const n = {
    temperature: count(d.temperatures, (t) => t.date === d.today && !t.ok),
    expired: count(d.documents, (x) => docState(x) === 'expired'),
    expiring: count(d.documents, (x) => docState(x) === 'expiring_soon'),
    overdueInvoices: count(unpaid, (o) => due(o) < d.today),
    dueInvoices: count(unpaid, (o) => due(o) >= d.today && due(o) <= soon),
    broken: count(d.equipment, (e) => e.status !== 'working'),
    service: count(d.equipment, (e) => {
      const next = nextServiceOn(e.lastServiceOn, e.purchasedOn, e.serviceEveryDays)
      return next !== null && next <= soon
    }),
    incidents: count(d.incidents, (i) => i.status === 'open'),
    leave: count(d.leave, (r) => r.status === 'pending'),
    swaps: count(d.swaps, (s) => s.status === 'pending'),
    probation: count(
      d.employees,
      (e) =>
        !!e.probationEndsOn &&
        e.probationEndsOn >= d.today &&
        e.probationEndsOn <= addDays(d.today, 14),
    ),
    interviews: count(d.candidates, (c) => c.stage === 'interview' && c.interviewOn === d.today),
    payslips: isPayday
      ? count(
          d.employees,
          (e) =>
            e.status !== 'inactive' &&
            e.salary != null &&
            !d.payslips.some((p) => p.employeeId === e.id),
        )
      : 0,
  }

  // [kind, count, text, link, tone], most urgent first; zero counts are dropped.
  const rows: [AttentionKind, number, string, string, AttentionItem['tone']][] = [
    [
      'temperature',
      n.temperature,
      `${plural(n.temperature, 'temperature reading')} out of range today`,
      '/food-safety',
      'danger',
    ],
    ['document', n.expired, `${plural(n.expired, 'document')} expired`, '/documents', 'danger'],
    [
      'stock',
      d.lowStock,
      `${plural(d.lowStock, 'item')} low on stock${d.criticalStock ? ` (${d.criticalStock} critical)` : ''}: reorder`,
      '/inventory',
      d.criticalStock ? 'danger' : 'warning',
    ],
    ['task', d.overdueTasks, `${plural(d.overdueTasks, 'task')} overdue`, '/tasks', 'danger'],
    [
      'invoice',
      n.overdueInvoices,
      `${plural(n.overdueInvoices, 'supplier invoice')} overdue`,
      '/purchasing',
      'danger',
    ],
    ['equipment', n.broken, `${plural(n.broken, 'machine')} out of order`, '/equipment', 'danger'],
    [
      'incident',
      n.incidents,
      `${plural(n.incidents, 'incident')} still open`,
      '/operations',
      'warning',
    ],
    [
      'leave',
      n.leave,
      `${plural(n.leave, 'leave request')} waiting for your decision`,
      '/leave',
      'warning',
    ],
    [
      'swap',
      n.swaps,
      `${plural(n.swaps, 'shift swap')} waiting for your decision`,
      '/rota',
      'warning',
    ],
    ['absence', d.absent, `${plural(d.absent, 'employee')} absent today`, '/attendance', 'warning'],
    [
      'document',
      n.expiring,
      `${plural(n.expiring, 'document')} expiring soon: renew`,
      '/documents',
      'warning',
    ],
    [
      'equipment',
      n.service,
      `${plural(n.service, 'machine')} due for a service`,
      '/equipment',
      'warning',
    ],
    [
      'invoice',
      n.dueInvoices,
      `${plural(n.dueInvoices, 'supplier invoice')} due this week`,
      '/purchasing',
      'warning',
    ],
    [
      'vat',
      vatDue && vatDue <= addDays(d.today, VAT_WARNING_DAYS) ? 1 : 0,
      `VAT return due ${vatDue === d.today ? 'today' : `on ${formatDay(vatDue ?? d.today)}`}`,
      '/finance',
      'warning',
    ],
    [
      'probation',
      n.probation,
      `${plural(n.probation, 'probation')} ending in the next 2 weeks`,
      '/employees',
      'info',
    ],
    [
      'interview',
      n.interviews,
      `${plural(n.interviews, 'interview')} today`,
      '/recruitment',
      'info',
    ],
    [
      'payslip',
      n.payslips,
      `${plural(n.payslips, 'payslip')} to prepare for this month`,
      '/leave',
      'info',
    ],
  ]
  return rows
    .filter(([, count]) => count > 0)
    .map(([kind, , text, to, tone]) => ({ kind, text, to, tone }))
}
