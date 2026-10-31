import { z } from 'zod'
import { dateKeySchema, idSchema, timestampsSchema } from './common'

/**
 * Operations, finance and HR records. Every record belongs to a branch and remembers who created
 * it; collections are listed in RECORD_COLLECTIONS so firestore.rules can guard them in one place.
 */
const recordBase = z
  .object({
    id: idSchema,
    branchId: idSchema,
    createdBy: idSchema,
    createdByName: z.string(),
  })
  .extend(timestampsSchema.shape)

const money = z.number().min(0).max(10_000_000)
const text = (max: number) => z.string().trim().max(max)

// ---- Finance ----

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Licences & fees',
  'Other',
] as const
export const PAYMENT_METHODS = ['Cash', 'Card', 'Bank transfer', 'Cheque'] as const

export const expenseSchema = recordBase.extend({
  date: dateKeySchema,
  category: z.enum(EXPENSE_CATEGORIES),
  description: text(200),
  amount: money,
  /** VAT included in the amount (for the VAT return). */
  vat: money,
  paymentMethod: z.enum(PAYMENT_METHODS),
})
export type Expense = z.infer<typeof expenseSchema>

/** One day's takings ({branchId}_{date}), entered at closing (no POS integration). */
export const salesDaySchema = recordBase.extend({
  date: dateKeySchema,
  cash: money,
  card: money,
  /** Delivery apps and online orders. */
  online: money,
  note: text(200),
})
export type SalesDay = z.infer<typeof salesDaySchema>
export const salesTotal = (d: Pick<SalesDay, 'cash' | 'card' | 'online'>) =>
  Math.round((d.cash + d.card + d.online) * 100) / 100

// ---- Purchasing ----

export const PO_STATUSES = ['draft', 'ordered', 'received', 'cancelled'] as const
export const orderLineSchema = z.object({
  itemId: idSchema,
  itemName: z.string(),
  unit: z.string(),
  quantity: z.number().positive().max(100_000),
  unitPrice: money,
})
export const purchaseOrderSchema = recordBase.extend({
  number: z.string(),
  supplierId: idSchema,
  supplierName: z.string(),
  status: z.enum(PO_STATUSES),
  orderedOn: dateKeySchema.nullable(),
  expectedOn: dateKeySchema.nullable(),
  receivedOn: dateKeySchema.nullable(),
  lines: z.array(orderLineSchema).min(1).max(50),
  total: money,
  invoiceNumber: text(60),
  /** Supplier payment: due date and when it was paid. */
  paymentDueOn: dateKeySchema.nullable(),
  paidOn: dateKeySchema.nullable(),
  note: text(300),
})
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>
export type OrderLineInput = z.infer<typeof orderLineSchema>

// ---- Recruitment ----

export const CANDIDATE_STAGES = ['applied', 'interview', 'offer', 'hired', 'rejected'] as const
export const candidateSchema = recordBase.extend({
  name: text(80).min(2),
  phone: text(30),
  email: text(120),
  position: text(40).min(1),
  stage: z.enum(CANDIDATE_STAGES),
  source: text(60),
  interviewOn: dateKeySchema.nullable(),
  notes: text(1000),
  /** CV in the manager's documents (category CV). */
  cvDocumentId: idSchema.nullable(),
})
export type Candidate = z.infer<typeof candidateSchema>

// ---- Daily operations (staff can log these) ----

export const INCIDENT_TYPES = [
  'Injury',
  'Customer complaint',
  'Equipment',
  'Food safety',
  'Security',
  'Other',
] as const
export const SEVERITIES = ['low', 'medium', 'high'] as const
export const incidentSchema = recordBase.extend({
  date: dateKeySchema,
  type: z.enum(INCIDENT_TYPES),
  severity: z.enum(SEVERITIES),
  description: text(1000).min(3),
  actionTaken: text(1000),
  status: z.enum(['open', 'closed']),
})
export type Incident = z.infer<typeof incidentSchema>

export const handoverSchema = recordBase.extend({
  date: dateKeySchema,
  shiftName: text(40),
  notes: text(1000).min(3),
  /** Cash in the till at handover (optional). */
  cashCount: money.nullable(),
})
export type Handover = z.infer<typeof handoverSchema>

export const CHECKLIST_KINDS = ['Opening', 'Closing', 'Cleaning', 'Other'] as const
export const checklistTemplateSchema = recordBase.extend({
  name: text(60).min(2),
  kind: z.enum(CHECKLIST_KINDS),
  items: z.array(text(120).min(1)).min(1).max(40),
})
export type ChecklistTemplate = z.infer<typeof checklistTemplateSchema>

/** One day's run of a checklist ({templateId}_{date}); staff tick items off. */
export const checklistRunSchema = recordBase.extend({
  templateId: idSchema,
  templateName: z.string(),
  date: dateKeySchema,
  items: z.array(
    z.object({
      text: z.string(),
      done: z.boolean(),
      by: z.string().nullable(),
      at: z.date().nullable(),
    }),
  ),
  completedAt: z.date().nullable(),
})
export type ChecklistRun = z.infer<typeof checklistRunSchema>

// ---- Food safety ----

export const temperatureLogSchema = recordBase.extend({
  date: dateKeySchema,
  equipmentId: idSchema,
  equipmentName: z.string(),
  reading: z.number().min(-60).max(150),
  min: z.number(),
  max: z.number(),
  ok: z.boolean(),
  note: text(200),
})
export type TemperatureLog = z.infer<typeof temperatureLogSchema>

export const INSPECTION_RESULTS = ['Pass', 'Minor issues', 'Major issues', 'Fail'] as const
export const inspectionSchema = recordBase.extend({
  date: dateKeySchema,
  inspector: text(80),
  kind: z.enum(['Authority', 'Internal']),
  result: z.enum(INSPECTION_RESULTS),
  score: z.number().min(0).max(100).nullable(),
  findings: text(1000),
  correctiveActions: text(1000),
})
export type Inspection = z.infer<typeof inspectionSchema>

// ---- Equipment ----

export const EQUIPMENT_KINDS = [
  'Espresso machine',
  'Grinder',
  'Fridge',
  'Freezer',
  'Oven',
  'Dishwasher',
  'Other',
] as const
export const EQUIPMENT_STATUSES = ['working', 'needs_repair', 'out_of_service'] as const
/** Units whose temperature is logged (fridges and freezers). */
export const COLD_UNITS: readonly string[] = ['Fridge', 'Freezer']

export const equipmentSchema = recordBase.extend({
  name: text(60).min(2),
  kind: z.enum(EQUIPMENT_KINDS),
  serial: text(60),
  purchasedOn: dateKeySchema.nullable(),
  warrantyUntil: dateKeySchema.nullable(),
  serviceEveryDays: z.number().int().min(7).max(1095).nullable(),
  lastServiceOn: dateKeySchema.nullable(),
  status: z.enum(EQUIPMENT_STATUSES),
  /** Allowed temperature range for cold units (°C). */
  tempMin: z.number().nullable(),
  tempMax: z.number().nullable(),
  /** The service / warranty date a reminder was already sent for. */
  serviceRemindedFor: dateKeySchema.nullable().optional(),
  warrantyRemindedFor: dateKeySchema.nullable().optional(),
})
export type Equipment = z.infer<typeof equipmentSchema>

export const maintenanceSchema = recordBase.extend({
  equipmentId: idSchema,
  equipmentName: z.string(),
  date: dateKeySchema,
  kind: z.enum(['Service', 'Repair', 'Breakdown']),
  cost: money,
  notes: text(500),
})
export type Maintenance = z.infer<typeof maintenanceSchema>

// ---- Customers ----

export const FEEDBACK_CHANNELS = [
  'In store',
  'Google',
  'Instagram',
  'Delivery app',
  'Phone',
] as const
export const FEEDBACK_TOPICS = ['Product', 'Service', 'Cleanliness', 'Price', 'Other'] as const
export const feedbackSchema = recordBase.extend({
  date: dateKeySchema,
  channel: z.enum(FEEDBACK_CHANNELS),
  rating: z.number().int().min(1).max(5),
  topic: z.enum(FEEDBACK_TOPICS),
  comment: text(1000),
  status: z.enum(['open', 'resolved']),
  resolution: text(1000),
})
export type Feedback = z.infer<typeof feedbackSchema>

// ---- People development ----

export const trainingSchema = recordBase.extend({
  employeeId: idSchema,
  employeeName: z.string(),
  title: text(100).min(2),
  provider: text(80),
  date: dateKeySchema,
  /** Certificate expiry, e.g. food-safety training (reminded like documents). */
  expiresOn: dateKeySchema.nullable(),
  notes: text(300),
  remindedFor: dateKeySchema.nullable().optional(),
})
export type Training = z.infer<typeof trainingSchema>

export const GOAL_STATUSES = ['not_started', 'in_progress', 'achieved', 'missed'] as const
export const goalSchema = recordBase.extend({
  employeeId: idSchema,
  employeeName: z.string(),
  title: text(120).min(2),
  dueOn: dateKeySchema.nullable(),
  status: z.enum(GOAL_STATUSES),
  progress: z.number().int().min(0).max(100),
})
export type Goal = z.infer<typeof goalSchema>

// ---- Rota ----

/** rota/{uid}_{date}: the shift someone works that day (null = day off), overriding their usual one. */
export const rotaEntrySchema = z.object({
  id: idSchema,
  branchId: idSchema,
  employeeId: idSchema,
  employeeName: z.string(),
  date: dateKeySchema,
  shiftId: idSchema.nullable(),
  updatedAt: z.date(),
})
export type RotaEntry = z.infer<typeof rotaEntrySchema>

/** An employee asks to swap their shift on a date with a colleague's; the manager decides. */
export const swapRequestSchema = recordBase.extend({
  date: dateKeySchema,
  fromId: idSchema,
  fromName: z.string(),
  toId: idSchema,
  toName: z.string(),
  reason: text(200),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  decidedBy: idSchema.nullable(),
})
export type SwapRequest = z.infer<typeof swapRequestSchema>

/**
 * Collections guarded by the generic rules in firestore.rules:
 * manager records (managers read and write), staff logs (everyone in the branch reads and adds,
 * managers edit) and personal records (the employee also reads their own).
 */
export const MANAGER_RECORDS = [
  'expenses',
  'salesDays',
  'purchaseOrders',
  'candidates',
  'inspections',
  'equipment',
  'maintenance',
  'feedback',
] as const
export const STAFF_LOGS = ['incidents', 'handovers', 'temperatureLogs'] as const
export const PERSONAL_RECORDS = ['training', 'goals'] as const
