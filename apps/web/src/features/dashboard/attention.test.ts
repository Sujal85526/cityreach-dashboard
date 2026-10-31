import type { AttentionData } from './attention'
import { describe, expect, it } from 'vitest'
import { attentionItems } from './attention'

const today = '2026-10-21'
const empty: AttentionData = {
  today,
  branch: { vat: null } as unknown as AttentionData['branch'],
  leave: [],
  swaps: [],
  documents: [],
  employees: [],
  payslips: [],
  incidents: [],
  temperatures: [],
  equipment: [],
  orders: [],
  candidates: [],
  absent: 0,
  overdueTasks: 0,
  lowStock: 0,
  criticalStock: 0,
}
const texts = (d: Partial<AttentionData>) => attentionItems({ ...empty, ...d }).map((i) => i.text)
const as = <T>(x: object) => x as T

describe('needs your attention', () => {
  it('is all clear when nothing is pending', () => {
    expect(attentionItems(empty)).toEqual([])
  })

  it('lists out-of-range temperatures from today only, first', () => {
    const temperatures = [
      { date: today, ok: false },
      { date: '2026-10-20', ok: false },
      { date: today, ok: true },
    ].map((t) => as<AttentionData['temperatures'][number]>(t))
    expect(texts({ temperatures, overdueTasks: 2 })).toEqual([
      '1 temperature reading out of range today',
      '2 tasks overdue',
    ])
  })

  it('splits unpaid supplier invoices into overdue and due this week', () => {
    const orders = [
      { status: 'received', paidOn: null, paymentDueOn: '2026-10-19' },
      { status: 'received', paidOn: null, paymentDueOn: '2026-10-25' },
      { status: 'received', paidOn: '2026-10-01', paymentDueOn: '2026-10-19' },
      { status: 'ordered', paidOn: null, paymentDueOn: '2026-10-19' },
    ].map((o) => as<AttentionData['orders'][number]>(o))
    expect(texts({ orders })).toEqual([
      '1 supplier invoice overdue',
      '1 supplier invoice due this week',
    ])
  })

  it('warns about the VAT return 14 days ahead', () => {
    // Quarterly periods ending 30 Sep → return due 28 Oct.
    const branch = as<AttentionData['branch']>({ vat: { periodEnd: '2026-09-30', months: 3 } })
    expect(texts({ branch })).toEqual(['VAT return due on 28 Oct 2026'])
  })

  it('flags machines due for a service within a week and broken ones', () => {
    const equipment = [
      { status: 'working', lastServiceOn: '2026-07-25', purchasedOn: null, serviceEveryDays: 90 },
      { status: 'working', lastServiceOn: '2026-10-01', purchasedOn: null, serviceEveryDays: 90 },
      { status: 'broken', lastServiceOn: null, purchasedOn: null, serviceEveryDays: null },
    ].map((e) => as<AttentionData['equipment'][number]>(e))
    expect(texts({ equipment })).toEqual(['1 machine out of order', '1 machine due for a service'])
  })

  it('shows payslips to prepare only from the 25th', () => {
    const employees = [
      as<AttentionData['employees'][number]>({ id: 'a', status: 'active', salary: 3000 }),
    ]
    expect(texts({ employees })).toEqual([])
    expect(texts({ employees, today: '2026-10-25' })).toEqual([
      '1 payslip to prepare for this month',
    ])
  })
})
