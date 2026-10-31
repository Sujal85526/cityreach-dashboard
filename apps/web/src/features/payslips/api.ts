import {
  COLLECTIONS,
  overtimeMinutes,
  payFacts,
  payslipExtrasSchema,
  payslipTotals,
  type Attendance,
  type Payslip,
  type PayslipExtras,
  type User,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'

const payslips = collection(db, COLLECTIONS.payslips)
export const payslipId = (uid: string, month: string) => `${uid}_${month}`

/** Every saved payslip in the branch for one month (manager). */
export async function listMonthPayslips(branchId: string, month: string): Promise<Payslip[]> {
  const snap = await getDocs(
    query(payslips, where('branchId', '==', branchId), where('month', '==', month)),
  )
  return snap.docs.map((d) => fromDoc<Payslip>(d))
}

/** The employee's own payslips, newest month first. */
export async function listMyPayslips(uid: string): Promise<Payslip[]> {
  const snap = await getDocs(
    query(payslips, where('employeeId', '==', uid), orderBy('month', 'desc'), limit(24)),
  )
  return snap.docs.map((d) => fromDoc<Payslip>(d))
}

/** The figures for a month, from the employee's pay settings and that month's attendance. */
export function computePayslip(employee: User, records: Attendance[], extras: PayslipExtras) {
  const mine = records.filter((r) => r.employeeId === employee.id)
  const { unpaidLeaveDays, absentDays } = payFacts(mine)
  const input = {
    salary: employee.salary ?? 0,
    allowances: employee.allowances ?? 0,
    overtimeMinutes: overtimeMinutes(mine),
    bonus: extras.bonus,
    unpaidLeaveDays,
    absentDays,
    otherDeductions: extras.otherDeductions,
  }
  return { ...input, ...payslipTotals(input) }
}

/**
 * Saves (or recalculates) the month's payslip with the figures as they stand now. A saved
 * payslip doesn't change when attendance changes later; saving again recalculates it.
 */
export async function savePayslip(
  {
    employee,
    month,
    records,
    extras,
    existing,
    paid,
  }: {
    employee: User
    month: string
    records: Attendance[]
    extras: PayslipExtras
    existing: Payslip | null
    paid: boolean
  },
  actor: SessionUser,
): Promise<void> {
  const e = payslipExtrasSchema.parse(extras)
  const p = computePayslip(employee, records, e)
  const batch = writeBatch(db)
  batch.set(doc(payslips, payslipId(employee.id, month)), {
    branchId: employee.branchId,
    employeeId: employee.id,
    employeeName: employee.name,
    position: employee.position,
    month,
    salary: p.salary,
    allowances: p.allowances,
    overtimeMinutes: p.overtimeMinutes,
    overtimePay: p.overtimePay,
    bonus: p.bonus,
    unpaidLeaveDays: p.unpaidLeaveDays,
    absentDays: p.absentDays,
    leaveDeduction: p.leaveDeduction,
    otherDeductions: p.otherDeductions,
    deductionNote: e.deductionNote,
    paymentMethod: paid || existing?.status === 'paid' ? e.paymentMethod : null,
    paymentRef: paid || existing?.status === 'paid' ? e.paymentRef || null : null,
    gross: p.gross,
    net: p.net,
    status: paid || existing?.status === 'paid' ? 'paid' : 'draft',
    paidAt: paid ? serverTimestamp() : (existing?.paidAt ?? null),
    preparedBy: actor.uid,
    createdAt: existing?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: paid ? 'payslip_paid' : 'payslip_saved',
    summary: `${actor.name} ${paid ? 'marked as paid' : 'prepared'} ${employee.name}'s ${month} payslip`,
    entity: { collection: COLLECTIONS.payslips, id: payslipId(employee.id, month) },
  })
  await batch.commit()
}
