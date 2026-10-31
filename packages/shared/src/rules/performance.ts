/**
 * Rule-based performance score (0–100). No AI: every part is a ratio the
 * manager can explain, weighted by settings the manager can change.
 */

export interface PerformanceInputs {
  scheduledShifts: number
  attendedShifts: number
  onTimeShifts: number
  tasksAssigned: number
  tasksCompleted: number
  /** Manager rating 1–5 for the period, or null if not rated. */
  managerRating: number | null
}

export interface PerformanceWeights {
  attendance: number
  punctuality: number
  tasks: number
  manager: number
}

export const DEFAULT_PERFORMANCE_WEIGHTS: PerformanceWeights = {
  attendance: 0.3,
  punctuality: 0.25,
  tasks: 0.3,
  manager: 0.15,
}

export interface PerformanceResult {
  score: number
  /** Each component as 0–1, before weighting. */
  breakdown: Record<keyof PerformanceWeights, number | null>
}

/** Ratio with a neutral 1 when there is nothing to measure yet. */
const ratio = (part: number, whole: number) => (whole > 0 ? Math.min(1, part / whole) : 1)

export function performanceScore(
  input: PerformanceInputs,
  weights: PerformanceWeights = DEFAULT_PERFORMANCE_WEIGHTS,
): PerformanceResult {
  const breakdown: PerformanceResult['breakdown'] = {
    attendance: ratio(input.attendedShifts, input.scheduledShifts),
    punctuality: ratio(input.onTimeShifts, input.attendedShifts),
    tasks: ratio(input.tasksCompleted, input.tasksAssigned),
    manager: input.managerRating === null ? null : input.managerRating / 5,
  }

  // Unrated components drop out and the remaining weights are rescaled.
  let weighted = 0
  let totalWeight = 0
  for (const key of Object.keys(weights) as (keyof PerformanceWeights)[]) {
    const value = breakdown[key]
    if (value === null) continue
    weighted += value * weights[key]
    totalWeight += weights[key]
  }

  return { score: totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0, breakdown }
}

/** What a period's records say about one employee (the inputs, plus counts shown in reports). */
export interface PeriodFacts extends PerformanceInputs {
  lateArrivals: number
  absences: number
  /** Tasks whose deadline passed without being completed on time (overdue, or completed late). */
  tasksMissed: number
  workedMinutes: number
}

/**
 * Turns a period's attendance and tasks into score inputs (docs/PRODUCT.md §6).
 * - scheduled = on time + late + absent (leave and off don't count against anyone)
 * - attended = on time + late; punctuality = on time ÷ attended
 * - tasks = due in the period; completed = done by the deadline; a late completion is missed
 * - tasks due later than `now` are not counted yet
 * Example: 5 shifts (4 on time, 1 late), 4 tasks due (3 done on time, 1 overdue) →
 * attendance 5/5, punctuality 4/5, tasks 3/4.
 */
export function periodFacts(
  attendance: { status: string; lateMinutes: number; workedMinutes: number | null }[],
  tasks: { status: string; deadline: Date; completedAt: Date | null }[],
  managerRating: number | null,
  now: Date,
): PeriodFacts {
  const count = (s: string) => attendance.filter((a) => a.status === s).length
  const onTime = count('on_time')
  const late = count('late')
  const absent = count('absent')
  const due = tasks.filter((t) => t.deadline <= now)
  const doneOnTime = due.filter(
    (t) => t.status === 'completed' && t.completedAt && t.completedAt <= t.deadline,
  ).length
  return {
    scheduledShifts: onTime + late + absent,
    attendedShifts: onTime + late,
    onTimeShifts: onTime,
    lateArrivals: late,
    absences: absent,
    tasksAssigned: due.length,
    tasksCompleted: doneOnTime,
    tasksMissed: due.length - doneOnTime,
    managerRating,
    workedMinutes: attendance.reduce((sum, a) => sum + (a.workedMinutes ?? 0), 0),
  }
}
