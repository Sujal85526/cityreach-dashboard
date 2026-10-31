import { describe, expect, it } from 'vitest'
import {
  classifyClockIn,
  earlyLeaveMinutes,
  isPastAbsenceWindow,
  resolveAttendance,
  workedMinutes,
} from './attendance'
import {
  finalSettlement,
  gratuity,
  monthProfit,
  nextServiceOn,
  nextVatDue,
  orderTotal,
  rotaShiftId,
  serviceYears,
  temperatureOk,
} from './business'
import { addDays, daysUntil, expiryState } from './expiry'
import { applyStockChange, shouldAlertStockChange, stockStatus } from './inventory'
import {
  allowanceFor,
  DEFAULT_LEAVE_TYPES,
  leaveBalance,
  leaveDates,
  monthlyPay,
  payFacts,
  splitPaidDays,
} from './leave'
import { distanceMeters, isAtShop, toClockLocation } from './location'
import { overtimeMinutes, payslipTotals } from './payroll'
import { performanceScore, periodFacts } from './performance'
import { lastWeeks, monthRange, periodLabel, previousPeriod, weekKeyOf, weekRange } from './periods'
import {
  currentPlannedShift,
  currentShiftInstance,
  plannedShiftOn,
  shiftEndFrom,
  shiftLengthMinutes,
  shiftOn,
} from './shifts'
import { canEmployeeMoveTask, completedLate, displayTaskStatus, isOverdue } from './tasks'
import { toDateKey, zonedDateTime } from './time'

const at = (iso: string) => new Date(iso)

describe('attendance', () => {
  const start = at('2026-09-25T07:00:00Z')

  it('flags the requirements example: 07:18 on a 07:00 shift is 18 minutes late', () => {
    expect(classifyClockIn(start, at('2026-09-25T07:18:00Z'), { graceMinutes: 5 })).toEqual({
      status: 'late',
      lateMinutes: 18,
    })
  })

  it('treats clock-ins inside the grace period as on time', () => {
    expect(classifyClockIn(start, at('2026-09-25T07:05:00Z'), { graceMinutes: 5 }).status).toBe(
      'on_time',
    )
    expect(
      classifyClockIn(start, at('2026-09-25T06:52:00Z'), { graceMinutes: 5 }).lateMinutes,
    ).toBe(0)
  })

  it('marks absence only after the window', () => {
    const policy = { absentAfterMinutes: 60 }
    expect(isPastAbsenceWindow(start, at('2026-09-25T07:59:00Z'), policy)).toBe(false)
    expect(isPastAbsenceWindow(start, at('2026-09-25T08:00:00Z'), policy)).toBe(true)
  })

  it('never returns negative worked minutes', () => {
    expect(workedMinutes(at('2026-09-25T07:00:00Z'), at('2026-09-25T15:04:00Z'))).toBe(484)
    expect(workedMinutes(at('2026-09-25T15:00:00Z'), at('2026-09-25T07:00:00Z'))).toBe(0)
  })
})

describe('inventory', () => {
  it('matches the requirements example: oat milk 14 L vs min 15 L is low', () => {
    expect(stockStatus(14, 15, 0.5)).toBe('low')
  })

  it('classifies critical and in-stock levels', () => {
    expect(stockStatus(6, 20, 0.5)).toBe('critical')
    expect(stockStatus(15, 15, 0.5)).toBe('in_stock')
  })

  it('alerts only when stock gets worse', () => {
    expect(shouldAlertStockChange('in_stock', 'low')).toBe(true)
    expect(shouldAlertStockChange('low', 'critical')).toBe(true)
    expect(shouldAlertStockChange('critical', 'low')).toBe(false)
    expect(shouldAlertStockChange('low', 'low')).toBe(false)
  })
})

describe('tasks', () => {
  const now = at('2026-09-25T12:00:00Z')
  it('marks open tasks past their deadline as overdue', () => {
    expect(isOverdue('pending', at('2026-09-25T11:00:00Z'), now)).toBe(true)
    expect(isOverdue('in_progress', at('2026-09-25T13:00:00Z'), now)).toBe(false)
    expect(isOverdue('completed', at('2026-09-25T11:00:00Z'), now)).toBe(false)
  })
})

describe('performance', () => {
  it('weights attendance, punctuality, tasks and manager rating', () => {
    const result = performanceScore({
      scheduledShifts: 20,
      attendedShifts: 19,
      onTimeShifts: 17,
      tasksAssigned: 10,
      tasksCompleted: 9,
      managerRating: 4,
    })
    // 0.3×0.95 + 0.25×(17/19) + 0.3×0.9 + 0.15×0.8 = 0.8987
    expect(result.score).toBe(90)
  })

  it('rescales weights when the manager has not rated', () => {
    const perfect = {
      scheduledShifts: 5,
      attendedShifts: 5,
      onTimeShifts: 5,
      tasksAssigned: 2,
      tasksCompleted: 2,
      managerRating: null,
    }
    expect(performanceScore(perfect).score).toBe(100)
  })
})

describe('time', () => {
  it('converts local shift times to UTC instants', () => {
    // 07:00 in Kolkata (UTC+5:30) is 01:30 UTC.
    expect(zonedDateTime('2026-09-25', '07:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-09-25T01:30:00.000Z',
    )
  })

  it('gives the local date key', () => {
    expect(toDateKey(at('2026-09-24T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-09-25')
  })
})

describe('shifts', () => {
  const dubai = 'Asia/Dubai' // UTC+4, no daylight saving
  const morning = { start: '07:00', end: '15:00', days: [1, 2, 3, 4, 5, 6] }
  const night = { start: '23:00', end: '07:00', days: [0, 1, 2, 3, 4, 5, 6] }

  it('places a morning shift on its local date', () => {
    // Friday 2026-09-25, 07:00 Dubai = 03:00 UTC
    expect(shiftOn(morning, '2026-09-25', dubai)?.startAt.toISOString()).toBe(
      '2026-09-25T03:00:00.000Z',
    )
    expect(shiftOn(morning, '2026-09-27', dubai)).toBeNull() // Sunday is not a work day
  })

  it('finds the shift being clocked into, including early arrivals', () => {
    const at0645 = at('2026-09-25T02:45:00Z') // 06:45 Dubai
    expect(currentShiftInstance(morning, at0645, dubai)?.dateKey).toBe('2026-09-25')
    const at1600 = at('2026-09-25T12:00:00Z') // 16:00 Dubai, after the shift ended
    expect(currentShiftInstance(morning, at1600, dubai)).toBeNull()
  })

  it("assigns a night shift clock-in after midnight to yesterday's shift", () => {
    const at0030 = at('2026-09-25T20:30:00Z') // 00:30 Dubai on the 26th
    const instance = currentShiftInstance(night, at0030, dubai)
    expect(instance?.dateKey).toBe('2026-09-25')
    expect(instance?.endAt.toISOString()).toBe('2026-09-26T03:00:00.000Z')
  })
})

describe('resolveAttendance', () => {
  const base = { lateMinutes: 0, workedMinutes: null, clockOutAt: null }
  const shiftStartAt = at('2026-09-25T07:00:00Z')

  it('classifies a pending clock-in from the server timestamps', () => {
    const r = resolveAttendance(
      { ...base, status: 'pending', shiftStartAt, clockInAt: at('2026-09-25T07:18:00Z') },
      { graceMinutes: 5 },
    )
    expect(r).toMatchObject({ status: 'late', lateMinutes: 18 })
  })

  it('keeps stored statuses and totals worked time when missing', () => {
    const r = resolveAttendance(
      {
        ...base,
        status: 'on_time',
        shiftStartAt,
        clockInAt: at('2026-09-25T06:58:00Z'),
        clockOutAt: at('2026-09-25T15:04:00Z'),
      },
      { graceMinutes: 5 },
    )
    expect(r).toEqual({ status: 'on_time', lateMinutes: 0, workedMinutes: 486 })
  })
})

describe('task moves and display', () => {
  const now = at('2026-09-25T12:00:00Z')
  const past = at('2026-09-25T11:00:00Z')

  it('shows an open task past its deadline as overdue before it is saved', () => {
    expect(displayTaskStatus('pending', past, now)).toBe('overdue')
    expect(displayTaskStatus('completed', past, now)).toBe('completed')
  })

  it('lets employees start, put back and complete (even overdue), never reopen', () => {
    expect(canEmployeeMoveTask('pending', 'in_progress')).toBe(true)
    expect(canEmployeeMoveTask('overdue', 'completed')).toBe(true)
    expect(canEmployeeMoveTask('overdue', 'in_progress')).toBe(false)
    expect(canEmployeeMoveTask('completed', 'pending')).toBe(false)
  })

  it('flags completion after the deadline', () => {
    expect(completedLate(past, now)).toBe(true)
    expect(completedLate(now, past)).toBe(false)
    expect(completedLate(now, null)).toBe(false)
  })
})

describe('stock changes', () => {
  it('adds deliveries, removes usage and sets counted stock', () => {
    expect(applyStockChange(14, { mode: 'remove', amount: 4 })).toEqual({ quantity: 10, delta: -4 })
    expect(applyStockChange(14, { mode: 'add', amount: 6 })).toEqual({ quantity: 20, delta: 6 })
    expect(applyStockChange(14, { mode: 'count', amount: 20 })).toEqual({ quantity: 20, delta: 6 })
  })

  it('never goes below zero and avoids floating-point noise', () => {
    expect(applyStockChange(2, { mode: 'remove', amount: 5 })).toEqual({ quantity: 0, delta: -2 })
    expect(applyStockChange(0.3, { mode: 'add', amount: 0.1 }).quantity).toBe(0.4)
  })
})

describe('report periods', () => {
  it('uses ISO weeks (Monday–Sunday)', () => {
    expect(weekKeyOf('2026-10-07')).toBe('2026-W41') // Wednesday
    expect(weekRange('2026-W41')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    expect(weekKeyOf('2026-01-01')).toBe('2026-W01')
    expect(weekKeyOf('2027-01-01')).toBe('2026-W53') // Friday belongs to the last week of 2026
  })

  it('handles months, previous periods and labels', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(previousPeriod('weekly', '2026-W01')).toBe('2025-W52') // week 1 of 2026 starts Mon 29 Dec 2025
    expect(previousPeriod('monthly', '2026-01')).toBe('2025-12')
    expect(lastWeeks('2026-10-07', 3)).toEqual(['2026-W39', '2026-W40', '2026-W41'])
    expect(periodLabel('weekly', '2026-W41')).toBe('5 Oct – 11 Oct 2026')
  })
})

describe('periodFacts', () => {
  const now = at('2026-10-10T12:00:00Z')
  const d = (iso: string) => at(iso)

  it('matches the documented example', () => {
    const attendance = [
      ...Array.from({ length: 4 }, () => ({
        status: 'on_time',
        lateMinutes: 0,
        workedMinutes: 480,
      })),
      { status: 'late', lateMinutes: 18, workedMinutes: 462 },
      { status: 'leave', lateMinutes: 0, workedMinutes: null },
    ]
    const tasks = [
      ...Array.from({ length: 3 }, () => ({
        status: 'completed',
        deadline: d('2026-10-08T12:00:00Z'),
        completedAt: d('2026-10-08T10:00:00Z'),
      })),
      { status: 'overdue', deadline: d('2026-10-09T12:00:00Z'), completedAt: null },
      { status: 'pending', deadline: d('2026-10-11T12:00:00Z'), completedAt: null }, // not due yet
    ]
    const f = periodFacts(attendance, tasks, null, now)
    expect(f).toMatchObject({
      scheduledShifts: 5,
      attendedShifts: 5,
      onTimeShifts: 4,
      lateArrivals: 1,
      tasksAssigned: 4,
      tasksCompleted: 3,
      tasksMissed: 1,
    })
    // 0.3×1 + 0.25×0.8 + 0.3×0.75 = 0.725 of 0.85 → 85
    expect(performanceScore(f).score).toBe(85)
  })

  it('counts a late completion as missed', () => {
    const f = periodFacts(
      [],
      [
        {
          status: 'completed',
          deadline: d('2026-10-08T12:00:00Z'),
          completedAt: d('2026-10-08T15:00:00Z'),
        },
      ],
      4,
      now,
    )
    expect(f).toMatchObject({
      tasksAssigned: 1,
      tasksCompleted: 0,
      tasksMissed: 1,
      managerRating: 4,
    })
  })
})

describe('early clock-out', () => {
  const end = at('2026-09-25T15:00:00Z')

  it('counts the minutes left when leaving before the shift ends: 12:45 on a 15:00 end is 135', () => {
    expect(earlyLeaveMinutes(end, at('2026-09-25T12:45:00Z'), { earlyLeaveGraceMinutes: 10 })).toBe(
      135,
    )
  })

  it('ignores leaving inside the grace period, after the end, or without a shift', () => {
    expect(earlyLeaveMinutes(end, at('2026-09-25T14:55:00Z'), { earlyLeaveGraceMinutes: 10 })).toBe(
      0,
    )
    expect(earlyLeaveMinutes(end, at('2026-09-25T15:20:00Z'), {})).toBe(0)
    expect(earlyLeaveMinutes(null, at('2026-09-25T12:00:00Z'), {})).toBe(0)
  })

  it('works out shift length and end, including night shifts past midnight', () => {
    expect(shiftLengthMinutes('07:00', '15:00')).toBe(480)
    expect(shiftLengthMinutes('23:00', '07:00')).toBe(480)
    expect(shiftLengthMinutes('09:00', '09:00')).toBe(1440)
    expect(shiftEndFrom(at('2026-09-25T19:00:00Z'), '23:00', '07:00')).toEqual(
      at('2026-09-26T03:00:00Z'),
    )
  })
})

describe('clock-in location', () => {
  const shop = { lat: 25.2048, lng: 55.2708, radiusMeters: 100 }

  it('measures distance in metres', () => {
    // 0.001° of latitude ≈ 111 m
    expect(distanceMeters(shop, { lat: 25.2058, lng: 55.2708 })).toBe(111)
  })

  it('gives the accuracy circle credit, capped at the radius', () => {
    const near = { lat: 25.20615, lng: 55.2708 } // ≈ 150 m away
    expect(isAtShop({ ...near, accuracy: 60 }, shop)).toBe(true)
    expect(isAtShop({ ...near, accuracy: 10 }, shop)).toBe(false)
    expect(isAtShop({ lat: 25.2228, lng: 55.2708, accuracy: 5000 }, shop)).toBe(false) // 2 km, vague
  })

  it('stores no verdict while the shop location is not set', () => {
    expect(toClockLocation({ lat: 25.2, lng: 55.27, accuracy: 20.4 }, null)).toEqual({
      lat: 25.2,
      lng: 55.27,
      accuracy: 20,
      distance: null,
      inside: null,
    })
  })
})

describe('leave and pay', () => {
  const annual = DEFAULT_LEAVE_TYPES.find((t) => t.id === 'annual')!
  const unpaid = DEFAULT_LEAVE_TYPES.find((t) => t.id === 'unpaid')!
  const MON_SAT = [1, 2, 3, 4, 5, 6]

  it('counts only the working days of the shift', () => {
    expect(leaveDates('2026-10-05', '2026-10-11', MON_SAT)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ])
    expect(leaveDates('2026-10-11', '2026-10-11', MON_SAT)).toEqual([]) // Sunday off
  })

  it('uses the employee override, else the type default; unpaid has no limit', () => {
    expect(allowanceFor(annual, { annual: 25 })).toBe(25)
    expect(allowanceFor(annual, undefined)).toBe(30)
    expect(allowanceFor(unpaid, { unpaid: 5 })).toBeNull()
  })

  it('works out the balance from approved paid days and pending days in the year', () => {
    const requests = [
      {
        typeId: 'annual',
        status: 'approved' as const,
        dates: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'],
        paidDays: 4,
      },
      {
        typeId: 'annual',
        status: 'pending' as const,
        dates: ['2026-11-01', '2026-11-02', '2026-11-03'],
        paidDays: null,
      },
      { typeId: 'annual', status: 'rejected' as const, dates: ['2026-06-01'], paidDays: null },
      { typeId: 'annual', status: 'approved' as const, dates: ['2025-12-30'], paidDays: 1 },
      { typeId: 'sick', status: 'approved' as const, dates: ['2026-02-02'], paidDays: 1 },
    ]
    expect(leaveBalance(annual, 30, requests, 2026)).toEqual({
      allowed: 30,
      used: 4,
      pending: 3,
      remaining: 23,
    })
  })

  it('pays leave up to the balance and makes the rest unpaid', () => {
    expect(splitPaidDays(5, annual, 3)).toEqual({ paidDays: 3, unpaidDays: 2 })
    expect(splitPaidDays(5, annual, 10)).toEqual({ paidDays: 5, unpaidDays: 0 })
    expect(splitPaidDays(2, unpaid, null)).toEqual({ paidDays: 0, unpaidDays: 2 })
  })

  it('deducts unpaid leave and absences at salary ÷ 30 per day', () => {
    const facts = payFacts([
      { status: 'leave', leavePaid: false },
      { status: 'leave', leavePaid: false },
      { status: 'leave', leavePaid: true },
      { status: 'leave' },
      { status: 'absent' },
      { status: 'on_time' },
    ])
    expect(facts).toEqual({ unpaidLeaveDays: 2, absentDays: 1 })
    expect(monthlyPay(3000, facts.unpaidLeaveDays, facts.absentDays)).toEqual({
      dailyRate: 100,
      deduction: 300,
      net: 2700,
    })
    expect(monthlyPay(3000, 40, 0).net).toBe(0) // never below zero
  })
})

describe('document expiry', () => {
  it('is valid until the reminder window, expiring soon inside it (incl. the last day), then expired', () => {
    expect(expiryState('2027-01-15', '2026-12-01', 30)).toBe('valid')
    expect(expiryState('2027-01-15', '2026-12-20', 30)).toBe('expiring_soon')
    expect(expiryState('2027-01-15', '2027-01-15', 30)).toBe('expiring_soon')
    expect(expiryState('2027-01-15', '2027-01-16', 30)).toBe('expired')
  })

  it('counts calendar days across months and years', () => {
    expect(daysUntil('2027-01-15', '2026-12-20')).toBe(26)
    expect(daysUntil('2026-03-01', '2026-02-28')).toBe(1)
    expect(addDays('2026-12-20', 26)).toBe('2027-01-15')
  })
})

describe('payslip', () => {
  it('counts overtime beyond the shift length, ignoring under 30 minutes a day', () => {
    expect(
      overtimeMinutes([
        { workedMinutes: 550, shiftStart: '07:00', shiftEnd: '15:00' }, // 70 min
        { workedMinutes: 500, shiftStart: '07:00', shiftEnd: '15:00' }, // 20 min: not counted
        { workedMinutes: 540, shiftStart: '23:00', shiftEnd: '07:00' }, // night, 60 min
        { workedMinutes: null, shiftStart: '07:00', shiftEnd: '15:00' },
      ]),
    ).toBe(130)
  })

  it('adds allowances, overtime at 125 % and bonus; deducts unpaid days, absences and others', () => {
    expect(
      payslipTotals({
        salary: 3000,
        allowances: 500,
        overtimeMinutes: 120,
        bonus: 200,
        unpaidLeaveDays: 1,
        absentDays: 1,
        otherDeductions: 0,
      }),
    ).toEqual({
      hourlyRate: 12.5,
      overtimePay: 31.25,
      leaveDeduction: 200,
      gross: 3731.25,
      deductions: 200,
      net: 3531.25,
    })
  })
})

describe('end of service', () => {
  it('pays no gratuity under a year, 21 days a year to five years, 30 after, capped at two years', () => {
    expect(gratuity(3000, 0.9)).toBe(0)
    expect(gratuity(3000, 1)).toBe(2100) // 21 days × 100
    expect(gratuity(3000, 6.5)).toBe(15000) // (5 × 21 + 1.5 × 30) × 100
    expect(gratuity(3000, 40)).toBe(72000) // capped at 24 months
  })

  it('works out the final settlement', () => {
    expect(serviceYears('2023-10-21', '2026-10-20')).toBe(3) // leap day doesn't add pay
    expect(serviceYears('2025-01-01', '2026-07-01')).toBeCloseTo(1.5, 1)
    expect(
      finalSettlement({
        basicSalary: 3000,
        allowances: 500,
        joinedOn: '2023-10-21',
        lastDay: '2026-10-20',
        unusedLeaveDays: 10,
        otherDeductions: 200,
      }),
    ).toMatchObject({ gratuity: 6300, leavePay: 1000, salaryDue: 2333.33, total: 9433.33 })
  })
})

describe('operations and finance', () => {
  it('flags temperatures outside the range', () => {
    expect(temperatureOk(4, 1, 5)).toBe(true)
    expect(temperatureOk(7, 1, 5)).toBe(false)
  })

  it('schedules the next service from the last one, else from purchase', () => {
    expect(nextServiceOn('2026-09-01', '2025-01-01', 90)).toBe('2026-11-30')
    expect(nextServiceOn(null, '2026-01-01', 180)).toBe('2026-06-30')
    expect(nextServiceOn(null, null, 90)).toBeNull()
  })

  it('totals orders and profit', () => {
    expect(
      orderTotal([
        { quantity: 10, unitPrice: 12.5 },
        { quantity: 4, unitPrice: 30 },
      ]),
    ).toBe(245)
    expect(monthProfit({ sales: 50000, expenses: 18000, payroll: 22000 })).toEqual({
      profit: 10000,
      margin: 20,
    })
    expect(monthProfit({ sales: 0, expenses: 100, payroll: 0 }).margin).toBeNull()
  })

  it('finds the next VAT return due date (28 days after the period ends)', () => {
    expect(nextVatDue('2026-10-20', '2026-03', 3)).toBe('2026-10-28') // Q3 ends 30 Sep
    expect(nextVatDue('2026-10-29', '2026-03', 3)).toBe('2027-01-28') // Q4 ends 31 Dec
    expect(nextVatDue('2026-10-20', '2026-01', 1)).toBe('2026-10-28') // September return
    expect(nextVatDue('2026-10-29', '2026-01', 1)).toBe('2026-11-28') // October return
  })

  it('uses the rota entry for the day, else the usual shift', () => {
    expect(rotaShiftId('morning', undefined)).toBe('morning')
    expect(rotaShiftId('morning', { shiftId: 'evening' })).toBe('evening')
    expect(rotaShiftId('morning', { shiftId: null })).toBeNull()
  })
})

describe('rota-planned shifts', () => {
  const shifts = [
    { id: 'morning', start: '07:00', end: '15:00', days: [1, 2, 3, 4, 5, 6] },
    { id: 'evening', start: '15:00', end: '23:00', days: [1, 2, 3, 4, 5, 6] },
  ]
  const SUNDAY = '2026-10-18'
  const MONDAY = '2026-10-19'

  it('uses the usual shift on its days, the rota entry on any day, and nothing on a day off', () => {
    expect(plannedShiftOn('morning', undefined, shifts, MONDAY, 'UTC')?.shift.id).toBe('morning')
    expect(plannedShiftOn('morning', undefined, shifts, SUNDAY, 'UTC')).toBeNull()
    expect(
      plannedShiftOn('morning', { shiftId: 'evening' }, shifts, SUNDAY, 'UTC')?.instance.startAt,
    ).toEqual(new Date('2026-10-18T15:00:00Z'))
    expect(plannedShiftOn('morning', { shiftId: null }, shifts, MONDAY, 'UTC')).toBeNull()
  })

  it('finds the planned shift whose window is open now', () => {
    const plan = (dk: string) =>
      plannedShiftOn(
        'morning',
        dk === SUNDAY ? { shiftId: 'evening' } : undefined,
        shifts,
        dk,
        'UTC',
      )
    expect(currentPlannedShift(plan, new Date('2026-10-18T14:00:00Z'), 'UTC')?.shift.id).toBe(
      'evening',
    )
    expect(currentPlannedShift(plan, new Date('2026-10-18T23:30:00Z'), 'UTC')).toBeNull()
    expect(currentPlannedShift(plan, new Date('2026-10-19T06:00:00Z'), 'UTC')?.shift.id).toBe(
      'morning',
    )
  })
})
