import { z } from 'zod'
import { NOTIFICATION_TYPES } from './branch'
import { entityRefSchema, idSchema } from './common'

export const NOTIFICATION_TONES = ['success', 'warning', 'danger', 'info'] as const
export type NotificationTone = (typeof NOTIFICATION_TONES)[number]

export const notificationSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  /** null = visible to every manager of the branch. */
  recipientId: idSchema.nullable(),
  /** User whose session wrote it. null only in seed data. */
  actorId: idSchema.nullable(),
  type: z.enum(NOTIFICATION_TYPES),
  tone: z.enum(NOTIFICATION_TONES),
  title: z.string(),
  body: z.string(),
  entity: entityRefSchema.nullable(),
  readAt: z.date().nullable(),
  createdAt: z.date(),
})
export type Notification = z.infer<typeof notificationSchema>

/** Append-only audit log; also the dashboard's "Recent activity" feed. */
export const activitySchema = z.object({
  id: idSchema,
  branchId: idSchema,
  actorId: idSchema.nullable(),
  actorName: z.string(),
  action: z.string(),
  summary: z.string(),
  entity: entityRefSchema.nullable(),
  createdAt: z.date(),
})
export type Activity = z.infer<typeof activitySchema>

const ratio = z.number().min(0).max(1)

export const performanceSnapshotSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  employeeId: idSchema,
  employeeName: z.string(),
  /** ISO week ("2026-W41"); one document per employee per week: `{uid}_{week}`. */
  period: z.string(),
  inputs: z.object({
    scheduledShifts: z.number().int().min(0),
    attendedShifts: z.number().int().min(0),
    onTimeShifts: z.number().int().min(0),
    lateArrivals: z.number().int().min(0),
    absences: z.number().int().min(0),
    tasksAssigned: z.number().int().min(0),
    tasksCompleted: z.number().int().min(0),
    tasksMissed: z.number().int().min(0),
    workedMinutes: z.number().int().min(0),
  }),
  /** Set by the manager (Reports → Rate); kept when the snapshot is recalculated. */
  managerRating: z.number().int().min(1).max(5).nullable(),
  managerComment: z.string().max(300).nullable(),
  breakdown: z.object({
    attendance: ratio.nullable(),
    punctuality: ratio.nullable(),
    tasks: ratio.nullable(),
    manager: ratio.nullable(),
  }),
  score: z.number().min(0).max(100),
  computedAt: z.date(),
})
export type PerformanceSnapshot = z.infer<typeof performanceSnapshotSchema>

export const REPORT_TYPES = ['weekly', 'monthly'] as const

export const reportSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  type: z.enum(REPORT_TYPES),
  period: z.string(),
  from: z.date(),
  to: z.date(),
  summary: z.object({
    attendancePct: z.number(),
    lateArrivals: z.number().int(),
    absences: z.number().int(),
    tasksCompleted: z.number().int(),
    tasksMissed: z.number().int(),
    averageScore: z.number(),
    inventoryAlerts: z.number().int(),
  }),
  employees: z.array(
    z.object({
      employeeId: idSchema,
      name: z.string(),
      position: z.string(),
      score: z.number(),
      attendancePct: z.number(),
      tasksDone: z.number().int(),
      tasksMissed: z.number().int(),
      lateArrivals: z.number().int(),
      managerComment: z.string().nullable(),
    }),
  ),
  createdAt: z.date(),
})
export type Report = z.infer<typeof reportSchema>
