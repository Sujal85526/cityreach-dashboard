import { z } from 'zod'
import { idSchema, timestampsSchema } from './common'

export const PAYSLIP_STATUSES = ['draft', 'paid'] as const
/** WPS = paid through the UAE Wage Protection System (bank / exchange house). */
export const SALARY_PAYMENT_METHODS = ['WPS', 'Bank transfer', 'Cash'] as const

/**
 * payslips/{uid}_{YYYY-MM}: the month's pay for one employee, saved by the manager. The figures are
 * frozen when saved (later attendance changes don't alter a saved payslip; "Recalculate" does).
 */
export const payslipSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    employeeId: idSchema,
    employeeName: z.string(),
    position: z.string(),
    /** "2026-10" */
    month: z.string().regex(/^\d{4}-\d{2}$/),
    salary: z.number().min(0),
    allowances: z.number().min(0),
    overtimeMinutes: z.number().int().min(0),
    overtimePay: z.number().min(0),
    bonus: z.number().min(0),
    unpaidLeaveDays: z.number().int().min(0),
    absentDays: z.number().int().min(0),
    leaveDeduction: z.number().min(0),
    otherDeductions: z.number().min(0),
    deductionNote: z.string().max(200),
    gross: z.number().min(0),
    net: z.number().min(0),
    status: z.enum(PAYSLIP_STATUSES),
    paidAt: z.date().nullable(),
    /** How it was paid and the WPS / bank reference (record only; no government submission). */
    paymentMethod: z.enum(SALARY_PAYMENT_METHODS).nullable().optional(),
    paymentRef: z.string().max(60).nullable().optional(),
    preparedBy: idSchema,
  })
  .extend(timestampsSchema.shape)
export type Payslip = z.infer<typeof payslipSchema>

/** What the manager adds by hand when preparing a payslip. */
export const payslipExtrasSchema = z.object({
  bonus: z.number().min(0).max(1_000_000),
  otherDeductions: z.number().min(0).max(1_000_000),
  deductionNote: z.string().trim().max(200),
  paymentMethod: z.enum(SALARY_PAYMENT_METHODS),
  paymentRef: z.string().trim().max(60),
})
export type PayslipExtras = z.infer<typeof payslipExtrasSchema>
