import { z } from 'zod'
import { ROLES } from '../constants/collections'
import { idSchema, timeOfDaySchema, timestampsSchema } from './common'

export const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'inactive'] as const
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number]

const noteSchema = z.object({
  id: idSchema,
  text: z.string().min(1).max(500),
  by: z.string(),
  at: z.date(),
})
export type EmployeeNote = z.infer<typeof noteSchema>

export const userSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    role: z.enum(ROLES),
    status: z.enum(EMPLOYMENT_STATUSES),
    name: z.string().min(2).max(80),
    email: z.email(),
    phone: z.string().max(20),
    position: z.string().min(1).max(40),
    shiftId: idSchema.nullable(),
    hiredAt: z.date(),
    /** Denormalised by scheduled jobs so the employee list is a single query. */
    stats: z.object({
      attendancePct: z.number().min(0).max(100),
      performanceScore: z.number().min(0).max(100),
      updatedAt: z.date(),
    }),
    notes: z.array(noteSchema),
    warnings: z.array(noteSchema),
    achievements: z.array(noteSchema),
    /** Monthly salary in the shop's currency; set by the manager. The employee can read their own. */
    salary: z.number().min(0).nullable().optional(),
    /** Fixed monthly allowances (housing, transport…), added on the payslip. */
    allowances: z.number().min(0).optional(),
    /** Last day of probation (reminded 14 days before); null = no probation. */
    probationEndsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    /** The probation end date a reminder was already sent for. */
    probationRemindedFor: z.string().nullable().optional(),
    /** Yearly allowance per leave type id, overriding the type's default for this employee. */
    leaveAllowances: z.record(z.string(), z.number().int().min(0)).optional(),
  })
  .extend(timestampsSchema.shape)
export type User = z.infer<typeof userSchema>

/** Fields the manager edits in the add/edit employee dialog. */
export const employeeFormSchema = userSchema.pick({
  name: true,
  phone: true,
  position: true,
  role: true,
  status: true,
  shiftId: true,
  probationEndsOn: true,
})
export type EmployeeForm = z.infer<typeof employeeFormSchema>

/** Adding an employee also creates their login (email + first password, shared with them by the manager). */
export const newEmployeeSchema = employeeFormSchema.extend({
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})
export type NewEmployee = z.infer<typeof newEmployeeSchema>

export const NOTE_KINDS = ['notes', 'warnings', 'achievements'] as const
export type NoteKind = (typeof NOTE_KINDS)[number]
export const noteTextSchema = noteSchema.shape.text

export const shiftSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    name: z.string().min(1).max(40),
    start: timeOfDaySchema,
    end: timeOfDaySchema,
    /** Days of week the shift runs, 0 = Sunday. */
    days: z.array(z.number().int().min(0).max(6)).min(1),
  })
  .extend(timestampsSchema.shape)
export type Shift = z.infer<typeof shiftSchema>

export const shiftInputSchema = shiftSchema.pick({ name: true, start: true, end: true, days: true })
export type ShiftInput = z.infer<typeof shiftInputSchema>

/**
 * What a signed-in user may do: read from `users/{uid}` at sign-in by the web app,
 * and by `firestore.rules` on every request (no custom claims on the free plan).
 */
export const userAccessSchema = userSchema.pick({ role: true, branchId: true, status: true })
export type UserAccess = z.infer<typeof userAccessSchema>
