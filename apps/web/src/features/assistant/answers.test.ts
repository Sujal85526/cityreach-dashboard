import type { Attendance, InventoryItem, Task } from '@cityreach/shared'
import { describe, expect, it } from 'vitest'
import { capped, myAttendanceAnswer, myPayAnswer, myShiftAnswer, myTasksAnswer } from './answers'
import {
  attentionAnswer,
  lowStockAnswer,
  salesAnswer,
  salesRange,
  teamTodayAnswer,
} from './answers-manager'

const NOW = new Date('2026-10-31T10:00:00Z')
const TODAY = '2026-10-31'
const task = (title: string, deadline: string, over: Partial<Task> = {}) =>
  ({ title, deadline: new Date(deadline), status: 'pending', priority: 'medium', ...over }) as Task

describe('my tasks', () => {
  const tasks = [
    task('Done already', '2026-10-31T15:00:00Z', { status: 'completed' }),
    task('Later', '2026-11-20T15:00:00Z'),
    task('Today', '2026-10-31T15:00:00Z'),
    task('Late', '2026-10-30T15:00:00Z'),
    task('Tomorrow', '2026-11-01T15:00:00Z'),
  ]
  const titles = (when: Parameters<typeof myTasksAnswer>[1]) =>
    myTasksAnswer(tasks, when, TODAY, 'UTC', '/me/tasks', NOW).lines?.map((l) => l.text)

  it('today lists what is due today and what is overdue, not completed work', () => {
    expect(titles('today')).toEqual(['Late', 'Today'])
  })

  it('tomorrow lists only tomorrow', () => {
    expect(titles('tomorrow')).toEqual(['Tomorrow'])
  })

  it('without a day it lists everything open, soonest first', () => {
    expect(titles(null)).toEqual(['Late', 'Today', 'Tomorrow', 'Later'])
  })

  it('marks overdue work', () => {
    const answer = myTasksAnswer(tasks, 'today', TODAY, 'UTC', '/me/tasks', NOW)
    expect(answer.lines?.[0]?.tone).toBe('danger')
  })

  it('says so when there is nothing', () => {
    expect(myTasksAnswer([], 'today', TODAY, 'UTC', '/me/tasks', NOW).text).toContain(
      'no tasks today',
    )
  })
})

describe('my shift', () => {
  const morning = { name: 'Morning', start: '07:00', end: '15:00' }
  const days = [
    { date: TODAY, shift: morning, onLeave: false },
    { date: '2026-11-01', shift: null, onLeave: false },
    { date: '2026-11-02', shift: morning, onLeave: true },
  ]

  it('answers for a single day, a day off and leave', () => {
    expect(myShiftAnswer(days, 'today', TODAY, '/me/rota').text).toContain('Today you work Morning')
    expect(myShiftAnswer(days, 'tomorrow', TODAY, '/me/rota').text).toBe("You're off tomorrow.")
    expect(myShiftAnswer(days, null, TODAY, '/me/rota').lines?.[0]?.text).toContain('(today)')
  })

  it('lists the week when no day is asked, showing leave', () => {
    const lines = myShiftAnswer(days, null, TODAY, '/me/rota').lines
    expect(lines?.[1]?.note).toBe('Day off')
    expect(lines?.[2]?.note).toBe('On leave')
  })

  it('does not list yesterday in the next 7 days', () => {
    const withYesterday = [{ date: '2026-10-30', shift: morning, onLeave: false }, ...days]
    const lines = myShiftAnswer(withYesterday, null, TODAY, '/me/rota').lines
    expect(lines).toHaveLength(3)
  })

  it('says so for someone on flexible hours with nothing planned', () => {
    const empty = days.map((d) => ({ ...d, shift: null, onLeave: false }))
    const answer = myShiftAnswer(empty, null, TODAY, '/me/rota', true)
    expect(answer.text).toContain('flexible')
    expect(answer.lines).toBeUndefined()
  })
})

describe('my attendance and pay', () => {
  it('reports today and the month', () => {
    const record = {
      dateKey: TODAY,
      status: 'late',
      lateMinutes: 12,
      workedMinutes: 120,
      clockInAt: NOW,
      clockOutAt: null,
    } as Attendance
    const answer = myAttendanceAnswer(record, [record], TODAY, 'UTC', '/me/attendance')
    expect(answer.text).toContain('clocked in today')
    expect(answer.lines?.find((l) => l.text === 'Late this month')?.note).toContain('1 (')
    expect(myAttendanceAnswer(null, [], TODAY, 'UTC', '/x').text).toContain("haven't clocked in")
  })

  it('shows the latest payslip, or the salary when there is none', () => {
    const slip = {
      month: '2026-10',
      net: 3000,
      status: 'paid',
      salary: 3000,
      allowances: 0,
      overtimePay: 0,
      leaveDeduction: 0,
      otherDeductions: 0,
    }
    const older = { ...slip, month: '2026-09', net: 1 }
    expect(myPayAnswer([older, slip] as never, 3000, '/x').text).toContain('2026-10')
    expect(myPayAnswer([], 3000, '/x').text).toContain('no payslips yet')
  })
})

describe('manager answers', () => {
  it('counts the team and names who is absent', () => {
    const records = [
      { employeeName: 'Omar', status: 'absent', clockInAt: null },
      { employeeName: 'Sara', status: 'late', clockInAt: NOW },
    ] as Attendance[]
    const answer = teamTodayAnswer(records, 5, 'today')
    expect(answer.text).toContain('1 of 5 staff clocked in today, 1 absent, 1 late')
    expect(answer.lines?.[0]).toMatchObject({ text: 'Absent', note: 'Omar', tone: 'danger' })
  })

  it('lists low stock, critical first', () => {
    const items = [
      { name: 'Oat', status: 'low', quantity: 1, minQuantity: 2, unit: 'L' },
      { name: 'Milk', status: 'critical', quantity: 1, minQuantity: 9, unit: 'L' },
      { name: 'Cups', status: 'in_stock', quantity: 9, minQuantity: 1, unit: 'pcs' },
    ] as InventoryItem[]
    expect(lowStockAnswer(items).lines?.map((l) => l.text)).toEqual(['Milk', 'Oat'])
  })

  it('picks the sales period and totals it', () => {
    expect(salesRange('week', TODAY)).toMatchObject({ from: '2026-10-25', to: TODAY })
    expect(salesRange(null, TODAY)).toMatchObject({ from: '2026-10-01', label: 'this month' })
    expect(salesAnswer([], 'today').text).toContain('No takings')
    expect(salesAnswer([{ date: TODAY, total: 1000 }], 'today').text).toContain('1,000')
  })

  it('says when nothing is urgent', () => {
    expect(
      attentionAnswer({ absent: 0, overdueTasks: 0, lowStock: 0, pendingLeave: 0 }).text,
    ).toContain('Nothing urgent')
    expect(
      attentionAnswer({ absent: 1, overdueTasks: 2, lowStock: 0, pendingLeave: 0 }).lines,
    ).toHaveLength(2)
  })
})

it('long lists show a few and say how many more', () => {
  const lines = capped(Array.from({ length: 9 }, (_, i) => ({ text: String(i) })))
  expect(lines).toHaveLength(7)
  expect(lines[6]?.text).toBe('and 3 more')
})
