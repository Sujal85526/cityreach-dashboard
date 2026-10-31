import { z } from 'zod'
import { ATTENDANCE_RECORD_STATUSES } from '../rules/attendance'
import { STOCK_STATUSES } from '../rules/inventory'
import { TASK_PRIORITIES, TASK_STATUSES } from '../rules/tasks'
import { dateKeySchema, idSchema, timeOfDaySchema, timestampsSchema } from './common'

export const ATTENDANCE_SOURCES = ['web', 'fingerprint', 'manager', 'system'] as const

/** Phone location at clock-in / clock-out, with the verdict against the shop at that moment. */
export const clockLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  /** Reading accuracy in metres. */
  accuracy: z.number(),
  /** Metres from the shop; null while the shop location isn't set. */
  distance: z.number().nullable(),
  inside: z.boolean().nullable(),
})

export const attendanceSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    employeeId: idSchema,
    employeeName: z.string(),
    dateKey: dateKeySchema,
    shiftId: idSchema.nullable(),
    shiftStart: timeOfDaySchema.nullable(),
    shiftEnd: timeOfDaySchema.nullable(),
    /** The shift start as an instant (null when the employee had no scheduled shift). Lateness is measured from it. */
    shiftStartAt: z.date().nullable(),
    clockInAt: z.date().nullable(),
    clockOutAt: z.date().nullable(),
    workedMinutes: z.number().int().min(0).nullable(),
    lateMinutes: z.number().int().min(0),
    status: z.enum(ATTENDANCE_RECORD_STATUSES),
    source: z.enum(ATTENDANCE_SOURCES),
    correctedBy: idSchema.nullable(),
    /** Shift end as an instant (start + shift length). Early clock-out is measured against it. */
    shiftEndAt: z.date().nullable().optional(),
    // Clock-in checks (absent on records from before these existed, or entered by a manager):
    /** null = the phone didn't share its location (denied or unavailable). */
    clockInLocation: clockLocationSchema.nullable().optional(),
    clockOutLocation: clockLocationSchema.nullable().optional(),
    /** true = a live photo is in attendancePhotos/{same id}; false = no camera was available. */
    photo: z.boolean().optional(),
    /** Minutes left in the shift at clock-out (0 = not early); see earlyLeaveMinutes(). */
    earlyLeaveMinutes: z.number().int().min(0).optional(),
    earlyLeaveReason: z.string().max(200).nullable().optional(),
    // Approved leave (status 'leave'): which type, and whether the day is paid.
    leaveTypeId: z.string().optional(),
    /** false = unpaid leave day, deducted from pay. Missing (manager-entered leave) = paid. */
    leavePaid: z.boolean().optional(),
    leaveRequestId: z.string().optional(),
  })
  .extend(timestampsSchema.shape)
export type Attendance = z.infer<typeof attendanceSchema>

/** The live photo taken at clock-in, kept apart so attendance lists stay small. Id = attendance id. */
export const attendancePhotoSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  employeeId: idSchema,
  dateKey: dateKeySchema,
  /** Small JPEG as a data URL (≈ 20–40 kB). */
  image: z.string(),
  takenAt: z.date(),
})
export type AttendancePhoto = z.infer<typeof attendancePhotoSchema>

export const taskSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    title: z.string().min(2).max(120),
    description: z.string().max(1000),
    category: z.string().min(1),
    assigneeId: idSchema,
    assigneeName: z.string(),
    priority: z.enum(TASK_PRIORITIES),
    deadline: z.date(),
    status: z.enum(TASK_STATUSES),
    completedAt: z.date().nullable(),
    createdBy: idSchema,
  })
  .extend(timestampsSchema.shape)
export type Task = z.infer<typeof taskSchema>

/** Fields the manager fills in the create / edit task dialog. */
export const taskInputSchema = taskSchema.pick({
  title: true,
  description: true,
  category: true,
  assigneeId: true,
  priority: true,
  deadline: true,
})
export type TaskInput = z.infer<typeof taskInputSchema>

export const supplierSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    name: z.string().min(1).max(80),
    contactName: z.string().max(80),
    phone: z.string().max(20),
    email: z.email().or(z.literal('')),
    categories: z.array(z.string()),
  })
  .extend(timestampsSchema.shape)
export type Supplier = z.infer<typeof supplierSchema>

export const supplierInputSchema = supplierSchema.pick({
  name: true,
  contactName: true,
  phone: true,
  email: true,
  categories: true,
})
export type SupplierInput = z.infer<typeof supplierInputSchema>

export const inventoryItemSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    name: z.string().min(1).max(80),
    category: z.string().min(1),
    unit: z.string().min(1).max(10),
    quantity: z.number().min(0),
    minQuantity: z.number().min(0),
    supplierId: idSchema.nullable(),
    supplierName: z.string().nullable(),
    status: z.enum(STOCK_STATUSES),
  })
  .extend(timestampsSchema.shape)
export type InventoryItem = z.infer<typeof inventoryItemSchema>

/** Add / edit item form. Quantity is set only when adding; later changes go through a stock adjustment. */
export const inventoryItemInputSchema = inventoryItemSchema
  .pick({ name: true, category: true, unit: true, minQuantity: true, supplierId: true })
  .extend({ quantity: z.number().min(0) })
export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>

export const STOCK_MOVEMENT_REASONS = ['delivery', 'usage', 'waste', 'correction'] as const

export const stockMovementSchema = z.object({
  id: idSchema,
  branchId: idSchema,
  itemId: idSchema,
  itemName: z.string(),
  delta: z.number(),
  quantityAfter: z.number().min(0),
  reason: z.enum(STOCK_MOVEMENT_REASONS),
  by: idSchema,
  byName: z.string().optional(),
  createdAt: z.date(),
})
export type StockMovement = z.infer<typeof stockMovementSchema>
