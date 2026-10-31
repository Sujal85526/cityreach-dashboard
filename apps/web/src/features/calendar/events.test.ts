import { describe, expect, it } from 'vitest'
import { calendarEvents, type CalendarData } from './events'

const base: CalendarData = {
  month: '2026-10',
  branch: { vat: { periodEnd: '2026-09-30', months: 3 } } as unknown as CalendarData['branch'],
  leave: [],
  documents: [],
  orders: [],
  equipment: [],
  training: [],
  candidates: [],
  employees: [],
}
const on = (d: Partial<CalendarData>, day: string) =>
  (calendarEvents({ ...base, ...d }).get(day) ?? []).map((e) => `${e.kind}: ${e.text}`)

describe('calendar events', () => {
  it('puts salary day on the last day and the VAT return 28 days after the quarter', () => {
    expect(on({}, '2026-10-31')).toEqual(['salary: Salary day'])
    expect(on({}, '2026-10-28')).toEqual(['vat: VAT return due'])
    expect(on({ month: '2026-11' }, '2026-11-28')).toEqual([])
  })

  it('shows expected deliveries for open orders and payments for unpaid received ones', () => {
    const orders = [
      { status: 'ordered', supplierName: 'Beans Co', number: 'PO-1', expectedOn: '2026-10-22' },
      {
        status: 'received',
        supplierName: 'Milk Co',
        number: 'PO-2',
        paymentDueOn: '2026-10-22',
        paidOn: null,
      },
      {
        status: 'received',
        supplierName: 'Cups Co',
        number: 'PO-3',
        paymentDueOn: '2026-10-22',
        paidOn: '2026-10-20',
      },
    ] as unknown as CalendarData['orders']
    expect(on({ orders }, '2026-10-22')).toEqual([
      'delivery: Delivery from Beans Co (PO-1)',
      'payment: Pay Milk Co (PO-2)',
    ])
  })

  it('shows the next machine service, interviews and probation ends', () => {
    const equipment = [
      {
        name: 'Espresso machine',
        lastServiceOn: '2026-07-24',
        purchasedOn: null,
        serviceEveryDays: 90,
        warrantyUntil: null,
      },
    ] as unknown as CalendarData['equipment']
    const candidates = [
      { name: 'Sara', position: 'Barista', stage: 'interview', interviewOn: '2026-10-22' },
      { name: 'Omar', position: 'Barista', stage: 'rejected', interviewOn: '2026-10-22' },
    ] as unknown as CalendarData['candidates']
    const employees = [
      { id: 'a', name: 'Ahmed', status: 'active', probationEndsOn: '2026-10-22' },
    ] as unknown as CalendarData['employees']
    expect(on({ equipment, candidates, employees }, '2026-10-22')).toEqual([
      'service: Espresso machine service due',
      'people: Interview: Sara (Barista)',
      "people: Ahmed's probation ends",
    ])
  })
})
