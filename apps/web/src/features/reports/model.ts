import {
  lastWeeks,
  periodRange,
  shiftDate,
  toDateKey,
  weekKeyOf,
  weekRange,
  type Branch,
  type PerformanceSnapshot,
  type PeriodType,
  type User,
} from '@dm/shared'
import {
  attendancePct,
  measuredStaff,
  hasData,
  scoreFor,
  slice,
  type PeriodData,
} from '@/features/performance/model'

export interface ReportRow {
  employee: User
  score: number
  previousScore: number | null
  attendancePct: number
  tasksDone: number
  tasksMissed: number
  lateArrivals: number
  absences: number
  rating: number | null
  comment: string | null
  weakest: string | null
}

export interface ReportView {
  rows: ReportRow[]
  summary: {
    averageScore: number | null
    attendancePct: number
    lateArrivals: number
    absences: number
    tasksCompleted: number
    tasksMissed: number
    inventoryAlerts: number
  }
  highlights: {
    top: ReportRow | null
    improved: (ReportRow & { delta: number }) | null
    attention: ReportRow | null
  }
  trend: { week: string; label: string; score: number | null }[]
  taskChart: { label: string; completed: number; missed: number }[]
}

const COMPONENT_LABEL = {
  attendance: 'attendance (missed shifts)',
  punctuality: 'punctuality (late arrivals)',
  tasks: 'task completion (missed deadlines)',
  manager: 'manager rating',
} as const

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null

/** Manager rating for the period: the week's rating, or the average of the month's weekly ratings. */
function ratingFor(employeeId: string, weeks: string[], snapshots: PerformanceSnapshot[]) {
  const ratings = snapshots
    .filter(
      (s) => s.employeeId === employeeId && weeks.includes(s.period) && s.managerRating != null,
    )
    .map((s) => s.managerRating as number)
  const comments = snapshots
    .filter((s) => s.employeeId === employeeId && weeks.includes(s.period) && s.managerComment)
    .map((s) => s.managerComment as string)
  return {
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    comment: comments.at(-1) ?? null,
  }
}

/** Weeks that overlap a period (for ratings). */
function weeksIn(from: string, to: string) {
  const weeks: string[] = []
  for (let d = from; d <= to; d = shiftDate(d, 7)) weeks.push(weekKeyOf(d))
  if (!weeks.includes(weekKeyOf(to))) weeks.push(weekKeyOf(to))
  return weeks
}

/**
 * The whole report for one period, computed from raw records with the same shared rules as the
 * snapshots: per-employee report card, totals, highlights, trend and task chart.
 */
export function buildReport(input: {
  type: PeriodType
  key: string
  branch: Branch
  employees: User[]
  data: PeriodData
  previous: PeriodData
  previousKey: string
  snapshots: PerformanceSnapshot[]
  inventoryAlerts: number
  now: Date
}): ReportView {
  const { type, key, branch, data, previous, snapshots, now } = input
  const tz = branch.rules.timeZone
  const dateKey = (d: Date) => toDateKey(d, tz)
  const { from, to } = periodRange(type, key)
  const prevRange = periodRange(type, input.previousKey)
  const weeks = weeksIn(from, to)
  const prevWeeks = weeksIn(prevRange.from, prevRange.to)
  const current = slice(data, from, to, dateKey)
  const before = slice(previous, prevRange.from, prevRange.to, dateKey)

  const rows: ReportRow[] = measuredStaff(input.employees)
    .filter((e) => dateKey(e.hiredAt) <= to)
    .flatMap((employee): ReportRow[] => {
      const { rating, comment } = ratingFor(employee.id, weeks, snapshots)
      const { facts, score, breakdown } = scoreFor(employee.id, current, branch, rating, now)
      // People with nothing to measure in the period are left out of the report card and averages.
      if (!hasData(facts)) return []
      const before_ = scoreFor(
        employee.id,
        before,
        branch,
        ratingFor(employee.id, prevWeeks, snapshots).rating,
        now,
      )
      const weakestKey = (
        Object.entries(breakdown) as [keyof typeof COMPONENT_LABEL, number | null][]
      )
        .filter(([, v]) => v !== null && v < 1)
        .sort((a, b) => (a[1] ?? 1) - (b[1] ?? 1))[0]?.[0]
      return [
        {
          employee,
          score,
          previousScore: hasData(before_.facts) ? before_.score : null,
          attendancePct: attendancePct(facts),
          tasksDone: facts.tasksCompleted,
          tasksMissed: facts.tasksMissed,
          lateArrivals: facts.lateArrivals,
          absences: facts.absences,
          rating,
          comment,
          weakest: weakestKey ? COMPONENT_LABEL[weakestKey] : null,
        },
      ]
    })
    .sort((a, b) => b.score - a.score)

  const totals = rows.reduce(
    (t, r) => ({
      late: t.late + r.lateArrivals,
      absent: t.absent + r.absences,
      done: t.done + r.tasksDone,
      missed: t.missed + r.tasksMissed,
    }),
    { late: 0, absent: 0, done: 0, missed: 0 },
  )
  const improved = rows
    .filter((r) => r.previousScore !== null)
    .map((r) => ({ ...r, delta: r.score - (r.previousScore ?? r.score) }))
    .sort((a, b) => b.delta - a.delta)[0]

  // Attendance % across the team = attended ÷ scheduled shifts, summed over everyone.
  const teamFacts = rows.map((r) => scoreFor(r.employee.id, current, branch, null, now).facts)
  const sched = teamFacts.reduce((s, f) => s + f.scheduledShifts, 0)
  const attended = teamFacts.reduce((s, f) => s + f.attendedShifts, 0)

  const trendWeeks = lastWeeks(to, 8)
  const trend = trendWeeks.map((week) => ({
    week,
    label: new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${weekRange(week).from}T12:00:00Z`)),
    score: mean(
      snapshots
        .filter((s) => s.period === week && typeof s.score === 'number' && s.inputs)
        .map((s) => s.score),
    ),
  }))

  const buckets =
    type === 'weekly'
      ? Array.from({ length: 7 }, (_, i) => ({ from: shiftDate(from, i), to: shiftDate(from, i) }))
      : weeks.map((w) => ({
          from: weekRange(w).from < from ? from : weekRange(w).from,
          to: weekRange(w).to > to ? to : weekRange(w).to,
        }))
  const taskChart = buckets.map((b) => {
    const due = current.tasks.filter(
      (t) => t.deadline <= now && dateKey(t.deadline) >= b.from && dateKey(t.deadline) <= b.to,
    )
    const completed = due.filter(
      (t) => t.status === 'completed' && t.completedAt && t.completedAt <= t.deadline,
    ).length
    const label =
      type === 'weekly'
        ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
            new Date(`${b.from}T12:00:00Z`),
          )
        : `${Number(b.from.slice(8))}–${Number(b.to.slice(8))}`
    return { label, completed, missed: due.length - completed }
  })

  return {
    rows,
    summary: {
      averageScore: mean(rows.map((r) => r.score)),
      attendancePct: sched ? Math.round((attended / sched) * 100) : 100,
      lateArrivals: totals.late,
      absences: totals.absent,
      tasksCompleted: totals.done,
      tasksMissed: totals.missed,
      inventoryAlerts: input.inventoryAlerts,
    },
    highlights: {
      top: rows[0] ?? null,
      improved: improved && improved.delta > 0 ? improved : null,
      attention: rows.length > 1 ? (rows.at(-1) ?? null) : null,
    },
    trend,
    taskChart,
  }
}
