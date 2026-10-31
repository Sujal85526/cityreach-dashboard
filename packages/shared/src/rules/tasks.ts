export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** Open statuses that can still become overdue. */
export const OPEN_TASK_STATUSES = [
  'pending',
  'in_progress',
] as const satisfies readonly TaskStatus[]

/** True when an open task's deadline has passed. */
export function isOverdue(status: TaskStatus, deadline: Date, now: Date): boolean {
  return (OPEN_TASK_STATUSES as readonly TaskStatus[]).includes(status) && deadline < now
}

/** Status to show: an open task past its deadline is Overdue even before the automatic check saves it. */
export function displayTaskStatus(status: TaskStatus, deadline: Date, now: Date): TaskStatus {
  return isOverdue(status, deadline, now) ? 'overdue' : status
}

/**
 * Status moves an employee may make on their own task (the task board follows the same list):
 * start, put back, or complete — including an overdue task. Only managers reopen completed work.
 */
export const EMPLOYEE_TASK_MOVES: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['in_progress', 'completed'],
  in_progress: ['pending', 'completed'],
  overdue: ['completed'],
  completed: [],
}

export function canEmployeeMoveTask(from: TaskStatus, to: TaskStatus): boolean {
  return EMPLOYEE_TASK_MOVES[from].includes(to)
}

/** Completed after its deadline: counts as a missed deadline in performance and reports. */
export function completedLate(deadline: Date, completedAt: Date | null): boolean {
  return completedAt !== null && completedAt > deadline
}
