import {
  addDays,
  nextServiceOn,
  nextVatDue,
  type Branch,
  type Candidate,
  type Equipment,
  type LeaveRequest,
  type PurchaseOrder,
  type StoredDocument,
  type Training,
  type User,
} from '@cityreach/shared'

export const EVENT_KINDS = [
  'leave',
  'pending',
  'expiry',
  'salary',
  'delivery',
  'payment',
  'service',
  'vat',
  'people',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export interface CalendarEvent {
  kind: EventKind
  text: string
  to: string
}

export interface CalendarData {
  month: string
  branch: Branch
  leave: LeaveRequest[]
  documents: StoredDocument[]
  orders: PurchaseOrder[]
  equipment: Equipment[]
  training: Training[]
  candidates: Candidate[]
  employees: User[]
}

export const shiftMonth = (month: string, by: number) => addDays(`${month}-15`, by * 30).slice(0, 7)
export const lastDayOf = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1)

/**
 * Every dated thing in the shop, by day: leave, document and certificate expiries, salary day,
 * supplier deliveries and payments, machine services, the VAT return, probation ends and
 * interviews. Pure, so it is unit-tested apart from the screen.
 */
export function calendarEvents(d: CalendarData): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>()
  const add = (day: string | null | undefined, e: CalendarEvent) => {
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), e])
  }
  const owner = (name?: string | null) => (name ? `${name}'s ` : '')

  for (const r of d.leave) {
    if (r.status !== 'approved' && r.status !== 'pending') continue
    const isPending = r.status === 'pending'
    for (const day of r.dates)
      add(day, {
        kind: isPending ? 'pending' : 'leave',
        text: `${r.employeeName} · ${r.typeName}${isPending ? ' (waiting)' : ''}`,
        to: '/leave',
      })
  }
  for (const x of d.documents)
    add(x.expiresOn, {
      kind: 'expiry',
      text: `${owner(x.employeeName)}${x.name} expires`,
      to: '/documents',
    })
  for (const t of d.training)
    add(t.expiresOn, {
      kind: 'expiry',
      text: `${owner(t.employeeName)}${t.title} certificate expires`,
      to: `/employees/${t.employeeId}`,
    })
  for (const o of d.orders) {
    if (o.status === 'ordered')
      add(o.expectedOn, {
        kind: 'delivery',
        text: `Delivery from ${o.supplierName} (${o.number})`,
        to: '/purchasing',
      })
    if (o.status === 'received' && !o.paidOn)
      add(o.paymentDueOn, {
        kind: 'payment',
        text: `Pay ${o.supplierName} (${o.number})`,
        to: '/purchasing',
      })
  }
  for (const e of d.equipment) {
    add(nextServiceOn(e.lastServiceOn, e.purchasedOn, e.serviceEveryDays), {
      kind: 'service',
      text: `${e.name} service due`,
      to: '/equipment',
    })
    add(e.warrantyUntil, { kind: 'service', text: `${e.name} warranty ends`, to: '/equipment' })
  }
  for (const c of d.candidates)
    if (c.stage === 'interview')
      add(c.interviewOn, {
        kind: 'people',
        text: `Interview: ${c.name} (${c.position})`,
        to: '/recruitment',
      })
  for (const e of d.employees)
    if (e.status !== 'inactive')
      add(e.probationEndsOn, {
        kind: 'people',
        text: `${e.name}'s probation ends`,
        to: `/employees/${e.id}`,
      })

  if (d.branch.vat) {
    const due = nextVatDue(`${d.month}-01`, d.branch.vat.periodEnd, d.branch.vat.months)
    if (due.startsWith(d.month)) add(due, { kind: 'vat', text: 'VAT return due', to: '/finance' })
  }
  add(lastDayOf(d.month), { kind: 'salary', text: 'Salary day', to: '/leave' })
  return byDay
}
