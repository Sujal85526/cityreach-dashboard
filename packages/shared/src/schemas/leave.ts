import { z } from 'zod'
import { LEAVE_STATUSES } from '../rules/leave'
import { dateKeySchema, idSchema, timestampsSchema } from './common'

/** A leave type the manager offers (Settings → Leave types). */
export const leaveTypeSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(40),
  daysPerYear: z.number().int().min(0).max(366).nullable(),
  paid: z.boolean(),
})

/**
 * leaveRequests/{auto}: an employee asks, the manager approves or rejects. Approving marks the
 * working days in `dates` as Leave on Attendance; the first `paidDays` of them are paid.
 */
export const leaveRequestSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    employeeId: idSchema,
    employeeName: z.string(),
    typeId: idSchema,
    typeName: z.string(),
    from: dateKeySchema,
    to: dateKeySchema,
    /** Working days covered (the employee's shift days). */
    dates: z.array(dateKeySchema).min(1),
    reason: z.string().max(300),
    status: z.enum(LEAVE_STATUSES),
    /** Set on approval; null while pending. */
    paidDays: z.number().int().min(0).nullable(),
    decidedBy: idSchema.nullable(),
    decidedByName: z.string().nullable(),
    decidedAt: z.date().nullable(),
    managerComment: z.string().max(300).nullable(),
  })
  .extend(timestampsSchema.shape)
export type LeaveRequest = z.infer<typeof leaveRequestSchema>

/** What the employee fills in when asking for leave. */
export const leaveRequestInputSchema = z
  .object({
    typeId: idSchema,
    from: dateKeySchema,
    to: dateKeySchema,
    reason: z.string().trim().max(300),
  })
  .refine((r) => r.from <= r.to, { message: 'The end date is before the start date', path: ['to'] })
export type LeaveRequestInput = z.infer<typeof leaveRequestInputSchema>

/** Monthly salary and per-type yearly allowance overrides, set by the manager on the profile. */
export const payAndLeaveSchema = z.object({
  salary: z.number().min(0).max(1_000_000).nullable(),
  allowances: z.number().min(0).max(1_000_000),
  leaveAllowances: z.record(z.string(), z.number().int().min(0).max(366)),
})
export type PayAndLeave = z.infer<typeof payAndLeaveSchema>
