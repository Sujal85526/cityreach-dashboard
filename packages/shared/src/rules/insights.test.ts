import { describe, expect, it } from 'vitest'
import {
  bestAndWorstDates,
  bestAndWorstWeekday,
  branchSummary,
  branchTotals,
  labourByDay,
  labourLevel,
  labourPercent,
  lastUnitPrices,
  monthLabourCost,
  reorderSuggestions,
  salesByMonth,
  salesByWeekday,
  wasteReport,
} from './insights'

const NOW = new Date('2026-10-31T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

describe('labour cost vs sales', () => {
  it('gives labour as a percentage of sales, and nothing without sales', () => {
    expect(labourPercent(3000, 10000)).toBe(30)
    expect(labourPercent(500, 0)).toBeNull()
  })

  it('rates 30 % or less as good and over 40 % as high', () => {
    expect(labourLevel(30)).toBe('good')
    expect(labourLevel(35)).toBe('watch')
    expect(labourLevel(41)).toBe('high')
    expect(labourLevel(null)).toBe('none')
  })

  it('uses saved payslips, and estimates the rest for the part of the month gone', () => {
    const staff = [
      { id: 'a', salary: 3000, allowances: 500 },
      { id: 'b', salary: 3500, allowances: 500 },
      { id: 'c', salary: null },
    ]
    const result = monthLabourCost(staff, [{ employeeId: 'a', net: 3200 }], 0.5)
    expect(result).toEqual({ cost: 5200, estimatedStaff: 1, staffWithoutPay: 1 })
  })

  it('still counts a payslip of someone who has since left the list', () => {
    expect(monthLabourCost([], [{ employeeId: 'gone', net: 1000 }]).cost).toBe(1000)
  })

  it('costs a day as one 30th of the monthly pay of everyone who clocked in', () => {
    const rows = labourByDay(
      [{ date: '2026-10-05', total: 1000 }],
      [
        { dateKey: '2026-10-05', employeeId: 'a', clockInAt: NOW },
        { dateKey: '2026-10-05', employeeId: 'b', clockInAt: NOW },
        { dateKey: '2026-10-05', employeeId: 'c', clockInAt: null },
      ],
      [
        { id: 'a', salary: 3000 },
        { id: 'b', salary: 3000 },
        { id: 'c', salary: 9000 },
      ],
    )
    expect(rows).toEqual([{ date: '2026-10-05', sales: 1000, labour: 200, percent: 20 }])
  })
})

describe('best and worst days', () => {
  const days = [
    { date: '2026-10-02', total: 900 }, // Friday
    { date: '2026-10-09', total: 1100 }, // Friday
    { date: '2026-10-05', total: 400 }, // Monday
    { date: '2026-10-06', total: 700 }, // Tuesday
  ]

  it('averages each weekday over the days entered, Monday first', () => {
    const rows = salesByWeekday(days)
    expect(rows[0]).toMatchObject({ weekday: 'Monday', average: 400, days: 1 })
    expect(rows[4]).toMatchObject({ weekday: 'Friday', average: 1000, days: 2 })
    expect(rows[6]).toMatchObject({ weekday: 'Sunday', average: 0, days: 0 })
  })

  it('names the best and worst weekday, only when there is something to compare', () => {
    const result = bestAndWorstWeekday(salesByWeekday(days))
    expect(result?.best.weekday).toBe('Friday')
    expect(result?.worst.weekday).toBe('Monday')
    expect(bestAndWorstWeekday(salesByWeekday([{ date: '2026-10-05', total: 400 }]))).toBeNull()
  })

  it('lists the highest and lowest single days', () => {
    const result = bestAndWorstDates(days, 2)
    expect(result.best.map((d) => d.total)).toEqual([1100, 900])
    expect(result.worst.map((d) => d.total)).toEqual([400, 700])
  })

  it('totals months and compares with the month before', () => {
    const rows = salesByMonth([
      { date: '2026-09-01', total: 1000 },
      { date: '2026-10-01', total: 800 },
      { date: '2026-10-02', total: 700 },
    ])
    expect(rows[0]).toMatchObject({ month: '2026-09', total: 1000, changePercent: null })
    expect(rows[1]).toMatchObject({
      month: '2026-10',
      total: 1500,
      days: 2,
      average: 750,
      changePercent: 50,
    })
  })
})

const use = (itemId: string, delta: number, reason: string, ago = 1) => ({
  itemId,
  itemName: itemId,
  delta,
  reason,
  createdAt: daysAgo(ago),
})

describe('waste', () => {
  it('uses the latest price from orders that arrived', () => {
    const prices = lastUnitPrices([
      { status: 'received', receivedOn: '2026-10-20', lines: [{ itemId: 'milk', unitPrice: 6 }] },
      { status: 'received', receivedOn: '2026-09-20', lines: [{ itemId: 'milk', unitPrice: 5 }] },
      { status: 'ordered', receivedOn: null, lines: [{ itemId: 'milk', unitPrice: 99 }] },
    ])
    expect(prices.get('milk')).toBe(6)
  })

  it('counts only wasted stock, most expensive first', () => {
    const report = wasteReport(
      [
        use('milk', -4, 'waste'),
        use('milk', -1, 'waste'),
        use('milk', -9, 'usage'),
        use('cups', -50, 'waste'),
        use('oat', -2, 'waste'),
      ],
      new Map([
        ['milk', 6],
        ['cups', 1],
      ]),
    )
    expect(report.items.map((i) => [i.itemId, i.quantity, i.cost])).toEqual([
      ['cups', 50, 50],
      ['milk', 5, 30],
      ['oat', 2, null],
    ])
    expect(report.totalCost).toBe(80)
    expect(report.unpriced).toBe(1)
  })
})

describe('reorder suggestions', () => {
  const item = (over = {}) => ({
    id: 'milk',
    name: 'Milk',
    unit: 'L',
    quantity: 6,
    minQuantity: 20,
    supplierId: 's1',
    supplierName: 'Green Valley',
    ...over,
  })

  it('works out days left and how much to order', () => {
    const [row] = reorderSuggestions([item()], [use('milk', -60, 'usage', 30)], NOW)
    expect(row).toMatchObject({ dailyUse: 2, daysLeft: 3, orderQuantity: 42 })
  })

  it('counts waste and stock-count losses as use, but not deliveries', () => {
    const [row] = reorderSuggestions(
      [item({ quantity: 10 })],
      [
        use('milk', -30, 'waste', 30),
        use('milk', -30, 'correction', 15),
        use('milk', 500, 'delivery', 2),
      ],
      NOW,
    )
    expect(row?.dailyUse).toBe(2)
  })

  it('warns before the minimum when stock will not last a week', () => {
    const [row] = reorderSuggestions(
      [item({ quantity: 12, minQuantity: 5 })],
      [use('milk', -60, 'usage', 30)],
      NOW,
    )
    expect(row?.daysLeft).toBe(6)
  })

  it('leaves out items that are fine', () => {
    expect(
      reorderSuggestions(
        [item({ quantity: 100, minQuantity: 5 })],
        [use('milk', -60, 'usage', 30)],
        NOW,
      ),
    ).toEqual([])
  })

  it('suggests topping up to the minimum when there is no usage history', () => {
    const [row] = reorderSuggestions([item()], [], NOW)
    expect(row).toMatchObject({ daysLeft: null, orderQuantity: 14 })
  })

  it('averages a new item over at least a week, so one busy day is not "per day"', () => {
    const [row] = reorderSuggestions([item({ quantity: 10 })], [use('milk', -14, 'usage', 1)], NOW)
    expect(row?.dailyUse).toBe(2)
  })

  it('puts what runs out soonest first', () => {
    const rows = reorderSuggestions(
      [item(), item({ id: 'oat', name: 'Oat', quantity: 1 }), item({ id: 'cups', name: 'Cups' })],
      [use('oat', -60, 'usage', 30), use('milk', -30, 'usage', 30)],
      NOW,
    )
    expect(rows.map((r) => r.id)).toEqual(['oat', 'milk', 'cups'])
  })
})

describe('all branches', () => {
  const summary = branchSummary({
    now: NOW,
    sales: 10000,
    expenses: 2000,
    payroll: 3000,
    staff: [{ status: 'active' }, { status: 'on_leave' }, { status: 'inactive' }],
    today: [
      { clockInAt: NOW, status: 'late' },
      { clockInAt: null, status: 'absent' },
    ],
    tasks: [
      { status: 'pending', deadline: daysAgo(1) },
      { status: 'overdue', deadline: daysAgo(3) },
      { status: 'in_progress', deadline: daysAgo(-2) },
    ],
    stock: [{ status: 'low' }, { status: 'critical' }, { status: 'in_stock' }],
    leave: [{ status: 'pending' }, { status: 'approved' }],
  })

  it('summarises one branch, counting an open task past its deadline as overdue', () => {
    expect(summary).toMatchObject({
      sales: 10000,
      profit: 5000,
      labourPercent: 30,
      staff: 2,
      present: 1,
      absent: 1,
      late: 1,
      openTasks: 3,
      overdueTasks: 2,
      lowStock: 2,
      pendingLeave: 1,
    })
  })

  it('uses the estimated staff cost for the percentage when payslips are not all saved yet', () => {
    const early = branchSummary({
      now: NOW,
      sales: 10000,
      expenses: 0,
      payroll: 0,
      labourCost: 3500,
      staff: [],
      today: [],
      tasks: [],
      stock: [],
      leave: [],
    })
    expect(early.labourPercent).toBe(35)
    expect(early.profit).toBe(10000)
  })

  it('adds branches up', () => {
    const totals = branchTotals([summary, { ...summary, sales: 0, profit: -500 }])
    expect(totals).toMatchObject({ sales: 10000, profit: 4500, margin: 45, staff: 4, lowStock: 4 })
  })
})
