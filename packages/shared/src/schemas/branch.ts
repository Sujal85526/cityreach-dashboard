import { z } from 'zod'
import { idSchema, timeOfDaySchema, timestampsSchema } from './common'
import { leaveTypeSchema } from './leave'

export const NOTIFICATION_TYPES = [
  'late_arrival',
  'absence',
  'early_leave',
  'clock_in_away',
  'leave_requested',
  'leave_decided',
  'document_expiry',
  'temperature_alert',
  'equipment_service',
  'incident_reported',
  'swap_requested',
  'probation_ending',
  'task_assigned',
  'task_completed',
  'task_overdue',
  'stock_low',
  'stock_critical',
  'report_ready',
  'top_performer',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const branchRulesSchema = z.object({
  timeZone: z.string().min(1),
  attendance: z.object({
    graceMinutes: z.number().int().min(0).max(120),
    absentAfterMinutes: z.number().int().min(5).max(480),
    earlyLeaveGraceMinutes: z.number().int().min(0).max(120).optional(),
  }),
  inventory: z.object({ criticalRatio: z.number().min(0).max(1) }),
  performance: z
    .object({
      attendance: z.number().min(0).max(1),
      punctuality: z.number().min(0).max(1),
      tasks: z.number().min(0).max(1),
      manager: z.number().min(0).max(1),
    })
    .refine((w) => Math.abs(w.attendance + w.punctuality + w.tasks + w.manager - 1) < 0.001, {
      message: 'Weights must add up to 100%',
    }),
})

export const businessHoursSchema = z.array(
  z.object({
    day: z.number().int().min(0).max(6),
    open: timeOfDaySchema,
    close: timeOfDaySchema,
    closed: z.boolean(),
  }),
)

export const branchSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    address: z.string(),
    phone: z.string(),
    rules: branchRulesSchema,
    businessHours: businessHoursSchema,
    taskCategories: z.array(z.string().min(1)),
    /** Notification types the manager wants to receive. */
    notificationPrefs: z.record(z.enum(NOTIFICATION_TYPES), z.boolean()),
    /** The owner who can switch into this branch (multi-branch); null until claimed. */
    ownerId: idSchema.nullable().optional(),
    /** VAT returns: one period end ("2026-03") and the period length; null = not VAT registered. */
    vat: z
      .object({
        periodEnd: z.string().regex(/^\d{4}-\d{2}$/),
        months: z.union([z.literal(1), z.literal(3)]),
      })
      .nullable()
      .optional(),
    /** Leave types staff can request; missing = DEFAULT_LEAVE_TYPES. */
    leaveTypes: z.array(leaveTypeSchema).optional(),
    /** Where the shop is, for the clock-in location check. Not set until the manager saves it. */
    location: z
      .object({
        lat: z.number(),
        lng: z.number(),
        radiusMeters: z.number().int().min(20).max(5000),
      })
      .nullable()
      .optional(),
    /** When the in-browser automation last ran its daily / weekly jobs (local date / ISO week). */
    automation: z
      .object({ performanceDate: z.string().optional(), weeklyReport: z.string().optional() })
      .optional(),
  })
  .extend(timestampsSchema.shape)
export type Branch = z.infer<typeof branchSchema>

/** Shop information form (Settings → Business information). */
export const branchInfoSchema = branchSchema
  .pick({ name: true, address: true, phone: true })
  .extend({
    timeZone: branchRulesSchema.shape.timeZone,
  })
export type BranchInfo = z.infer<typeof branchInfoSchema>
