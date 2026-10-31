import {
  addDays,
  displayTaskStatus,
  type Attendance,
  type Goal,
  type LeaveRequest,
  type Payslip,
  type Shift,
  type Task,
  type Training,
} from '@cityreach/shared'
import type { Tone } from '@/components/common/StatusPill'
import type { TypeBalance } from '@/features/leave/model'
import {
  formatClock,
  formatDay,
  formatDue,
  formatMinutes,
  formatMoney,
  shiftLabel,
} from '@/lib/format'
import type { When } from './intents'

export interface AnswerLine {
  text: string
  note?: string
  tone?: Tone
}

export interface Answer {
  text: string
  lines?: AnswerLine[]
  link?: { to: string; label: string }
}

const MAX_LINES = 6
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Long lists show the first few and say how many more there are. */
export function capped(lines: AnswerLine[]): AnswerLine[] {
  if (lines.length <= MAX_LINES) return lines
  return [...lines.slice(0, MAX_LINES), { text: `and ${lines.length - MAX_LINES} more` }]
}

export const dateOf = (when: When | null, today: string) =>
  when === 'tomorrow' ? addDays(today, 1) : when === 'yesterday' ? addDays(today, -1) : today

export const dayWord = (when: When | null) =>
  when === 'tomorrow' ? 'tomorrow' : when === 'yesterday' ? 'yesterday' : 'today'

const dateInZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)

/** Tasks due on that day (today also lists what's overdue), or everything open when no day is asked. */
export function myTasksAnswer(
  tasks: Task[],
  when: When | null,
  today: string,
  timeZone: string,
  to: string,
  now = new Date(),
): Answer {
  const open = tasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
  const isOverdue = (t: Task) => displayTaskStatus(t.status, t.deadline, now) === 'overdue'
  const date = dateOf(when, today)
  const picked =
    when === 'today' || when === 'tomorrow' || when === 'yesterday'
      ? open.filter(
          (t) => dateInZone(t.deadline, timeZone) === date || (when === 'today' && isOverdue(t)),
        )
      : when === 'week'
        ? open.filter((t) => dateInZone(t.deadline, timeZone) <= addDays(today, 7))
        : open
  const link = { to, label: 'Open tasks' }
  const scope = when === 'week' ? 'this week' : when ? dayWord(when) : ''
  if (picked.length === 0)
    return {
      text: scope
        ? `You have no tasks ${scope}. 🎉`
        : "You have no open tasks. You're all caught up.",
      link,
    }
  return {
    text: `You have ${plural(picked.length, 'task')}${scope ? ` ${scope}` : ' open'}:`,
    lines: capped(
      picked.map((t) => ({
        text: t.title,
        note: `Due ${formatDue(t.deadline, timeZone, now)}`,
        tone: isOverdue(t) ? 'danger' : t.priority === 'high' ? 'warning' : undefined,
      })),
    ),
    link,
  }
}

export interface PlannedDay {
  date: string
  shift: Pick<Shift, 'name' | 'start' | 'end'> | null
  onLeave: boolean
}

const dayPlan = (d: PlannedDay) =>
  d.onLeave ? 'On leave' : d.shift ? shiftLabel(d.shift) : 'Day off'

export function myShiftAnswer(
  days: PlannedDay[],
  when: When | null,
  today: string,
  to: string,
): Answer {
  const link = { to, label: 'Open rota' }
  if (when === 'week' || when === 'month' || !when) {
    return {
      text: 'Your next 7 days:',
      lines: days.map((d) => ({
        text: d.date === today ? `${formatDay(d.date)} (today)` : formatDay(d.date),
        note: dayPlan(d),
      })),
      link,
    }
  }
  const day = days.find((d) => d.date === dateOf(when, today))
  const word = dayWord(when)
  if (!day || (!day.shift && !day.onLeave)) return { text: `You're off ${word}.`, link }
  if (day.onLeave) return { text: `You're on approved leave ${word}.`, link }
  return {
    text: `${word[0]?.toUpperCase()}${word.slice(1)} you work ${shiftLabel(day.shift as Shift)}.`,
    link,
  }
}

export function myAttendanceAnswer(
  todayRecord: Attendance | null,
  records: Attendance[],
  today: string,
  timeZone: string,
  to: string,
): Answer {
  const inMonth = records.filter((r) => r.dateKey.startsWith(today.slice(0, 7)))
  const count = (status: string) => inMonth.filter((r) => r.status === status).length
  const worked = inMonth.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0)
  const late = inMonth.reduce((sum, r) => sum + r.lateMinutes, 0)
  const status = !todayRecord?.clockInAt
    ? "You haven't clocked in today."
    : todayRecord.clockOutAt
      ? `Today you clocked in at ${formatClock(todayRecord.clockInAt, timeZone)} and out at ${formatClock(todayRecord.clockOutAt, timeZone)}.`
      : `You clocked in today at ${formatClock(todayRecord.clockInAt, timeZone)} and haven't clocked out yet.`
  return {
    text: status,
    lines: [
      { text: 'On time this month', note: String(count('on_time')) },
      {
        text: 'Late this month',
        note: late ? `${count('late')} (${formatMinutes(late)} in total)` : String(count('late')),
        tone: count('late') ? 'warning' : undefined,
      },
      {
        text: 'Absent this month',
        note: String(count('absent')),
        tone: count('absent') ? 'danger' : undefined,
      },
      { text: 'Hours worked this month', note: formatMinutes(worked) },
    ],
    link: { to, label: 'Open attendance' },
  }
}

export function myLeaveAnswer(
  balances: TypeBalance[],
  requests: LeaveRequest[],
  to: string,
): Answer {
  const pending = requests.filter((r) => r.status === 'pending')
  return {
    text: pending.length
      ? `You have ${plural(pending.length, 'leave request')} waiting for a decision. Your balance this year:`
      : 'Your leave balance this year:',
    lines: balances.map((b) => ({
      text: b.type.name,
      note: b.remaining === null ? 'No limit' : `${b.remaining} of ${b.allowed} days left`,
    })),
    link: { to, label: 'Open leave' },
  }
}

export function myPayAnswer(
  payslips: Payslip[],
  salary: number | null | undefined,
  to: string,
): Answer {
  const link = { to, label: 'Open leave & pay' }
  const latest = [...payslips].sort((a, b) => b.month.localeCompare(a.month))[0]
  if (!latest)
    return {
      text: salary
        ? `You have no payslips yet. Your monthly salary is ${formatMoney(salary)}.`
        : 'You have no payslips yet. Ask your manager if you were expecting one.',
      link,
    }
  return {
    text: `Your latest payslip is for ${latest.month}: ${formatMoney(latest.net)} net (${latest.status === 'paid' ? 'paid' : 'not paid yet'}).`,
    lines: [
      { text: 'Basic salary', note: formatMoney(latest.salary) },
      { text: 'Allowances', note: formatMoney(latest.allowances) },
      { text: 'Overtime', note: formatMoney(latest.overtimePay) },
      { text: 'Deductions', note: formatMoney(latest.leaveDeduction + latest.otherDeductions) },
    ],
    link,
  }
}

export function myGrowthAnswer(
  goals: Goal[],
  training: Training[],
  today: string,
  to: string,
): Answer {
  const link = { to, label: 'Open training & goals' }
  const openGoals = goals.filter((g) => g.status === 'not_started' || g.status === 'in_progress')
  const lines: AnswerLine[] = [
    ...openGoals.map((g) => ({
      text: g.title,
      note: `${g.progress} % done${g.dueOn ? `, due ${formatDay(g.dueOn)}` : ''}`,
    })),
    ...training
      .filter((t) => t.expiresOn)
      .map((t) => ({
        text: t.title,
        note: `Certificate ${(t.expiresOn ?? '') < today ? 'expired' : 'expires'} ${formatDay(t.expiresOn)}`,
        tone: (t.expiresOn ?? '') < today ? ('danger' as const) : undefined,
      })),
  ]
  if (lines.length === 0) return { text: 'You have no open goals or expiring certificates.', link }
  return { text: 'Your open goals and certificates:', lines: capped(lines), link }
}
