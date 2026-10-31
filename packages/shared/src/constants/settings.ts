import type { AttendancePolicy } from '../rules/attendance'
import type { NotificationType } from '../schemas/branch'
import { DEFAULT_PERFORMANCE_WEIGHTS, type PerformanceWeights } from '../rules/performance'

/** Rules the manager can change in Settings. Stored on the branch document. */
export interface BranchRules {
  timeZone: string
  attendance: AttendancePolicy
  inventory: { criticalRatio: number }
  performance: PerformanceWeights
}

export const DEFAULT_BRANCH_RULES: BranchRules = {
  timeZone: 'Europe/London',
  attendance: { graceMinutes: 5, absentAfterMinutes: 60, earlyLeaveGraceMinutes: 10 },
  inventory: { criticalRatio: 0.5 },
  performance: DEFAULT_PERFORMANCE_WEIGHTS,
}

export const DEFAULT_TASK_CATEGORIES = [
  'Cleaning',
  'Service',
  'Finance',
  'Marketing',
  'Training',
  'Inventory',
]

/** Open 07:00–23:00, seven days a week. */
export const DEFAULT_BUSINESS_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: '07:00',
  close: '23:00',
  closed: false,
}))

export const DEFAULT_NOTIFICATION_PREFS: Record<NotificationType, boolean> = {
  late_arrival: true,
  absence: true,
  early_leave: true,
  clock_in_away: true,
  leave_requested: true,
  leave_decided: true,
  document_expiry: true,
  temperature_alert: true,
  equipment_service: true,
  incident_reported: true,
  swap_requested: true,
  probation_ending: true,
  task_assigned: true,
  task_completed: true,
  task_overdue: true,
  stock_low: true,
  stock_critical: true,
  report_ready: true,
  top_performer: true,
}
