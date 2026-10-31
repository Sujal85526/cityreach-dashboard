import {
  performanceScore,
  periodFacts,
  resolveAttendance,
  type Attendance,
  type Branch,
  type PeriodFacts,
  type PerformanceSnapshot,
  type Task,
  type User,
} from '@dm/shared'

export interface PeriodData {
  attendance: Attendance[]
  tasks: Task[]
}

/** Staff whose performance is measured: active or on-leave employees (not managers). */
export const measuredStaff = (employees: User[]) =>
  employees.filter((e) => e.role === 'employee' && e.status !== 'inactive')

/**
 * One employee's facts and score for records already filtered to the period. Attendance is
 * resolved first (a 'pending' clock-in counts as on time / late from its timestamps).
 */
export function scoreFor(
  employeeId: string,
  data: PeriodData,
  branch: Branch,
  rating: number | null,
  now: Date,
): { facts: PeriodFacts; score: number; breakdown: PerformanceSnapshot['breakdown'] } {
  const attendance = data.attendance
    .filter((a) => a.employeeId === employeeId)
    .map((a) => ({ ...a, ...resolveAttendance(a, branch.rules.attendance) }))
  const tasks = data.tasks.filter((t) => t.assigneeId === employeeId)
  const facts = periodFacts(attendance, tasks, rating, now)
  const { score, breakdown } = performanceScore(facts, branch.rules.performance)
  return { facts, score, breakdown }
}

/** Keeps the records whose local date (attendance) or deadline (tasks) is in [from, to]. */
export function slice(
  data: PeriodData,
  from: string,
  to: string,
  toDateKey: (d: Date) => string,
): PeriodData {
  return {
    attendance: data.attendance.filter((a) => a.dateKey >= from && a.dateKey <= to),
    tasks: data.tasks.filter((t) => {
      const k = toDateKey(t.deadline)
      return k >= from && k <= to
    }),
  }
}

export const attendancePct = (f: PeriodFacts) =>
  f.scheduledShifts ? Math.round((f.attendedShifts / f.scheduledShifts) * 100) : 100

/** Nothing to measure (no scheduled shifts, no tasks due): no score rather than a misleading 100. */
export const hasData = (f: { scheduledShifts: number; tasksAssigned: number }) =>
  f.scheduledShifts > 0 || f.tasksAssigned > 0
