import {
  COLLECTIONS,
  leaveDates,
  leaveRequestInputSchema,
  MAX_LEAVE_DAYS,
  payAndLeaveSchema,
  shiftOn,
  splitPaidDays,
  type Attendance,
  type Branch,
  type LeaveRequest,
  type LeaveRequestInput,
  type PayAndLeave,
  type Shift,
  type User,
} from '@dm/shared'
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'
import { addNotification } from '@/lib/notify'
import { balancesFor, formatRange, plural, typeOf, workDaysOf } from './model'

const requests = collection(db, COLLECTIONS.leaveRequests)
const attendance = collection(db, COLLECTIONS.attendance)
const entity = (id: string) => ({ collection: COLLECTIONS.leaveRequests, id })
const PAGE = 200

const list = async (...constraints: Parameters<typeof query>[1][]) =>
  (
    await getDocs(query(requests, ...constraints, orderBy('createdAt', 'desc'), limit(PAGE)))
  ).docs.map((d) => fromDoc<LeaveRequest>(d))

/** The employee's own requests, newest first. */
export const listMyLeave = (uid: string) => list(where('employeeId', '==', uid))

/** Every request in the branch (manager), newest first. */
export const listBranchLeave = (branchId: string) => list(where('branchId', '==', branchId))

/** One employee's requests (manager, profile). */
export const listEmployeeLeave = (branchId: string, uid: string) =>
  list(where('branchId', '==', branchId), where('employeeId', '==', uid))

export interface LeaveContext {
  me: User
  shift: Shift | null
  branch: Branch
}

/** Employee asks for leave: the request plus the manager's notification, in one batch. */
export async function requestLeave(
  input: LeaveRequestInput,
  { me, shift, branch }: LeaveContext,
  actor: SessionUser,
): Promise<void> {
  const r = leaveRequestInputSchema.parse(input)
  const type = typeOf(branch, r.typeId)
  const dates = leaveDates(r.from, r.to, workDaysOf(shift, branch))
  if (dates.length === 0) throw new Error('Those dates are all days off. Pick working days.')
  if (dates.length > MAX_LEAVE_DAYS)
    throw new Error(`One request can cover up to ${MAX_LEAVE_DAYS} working days.`)

  const ref = doc(requests)
  const batch = writeBatch(db)
  batch.set(ref, {
    branchId: me.branchId,
    employeeId: me.id,
    employeeName: me.name,
    typeId: type.id,
    typeName: type.name,
    from: r.from,
    to: r.to,
    dates,
    reason: r.reason,
    status: 'pending',
    paidDays: null,
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    managerComment: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  addNotification(batch, actor, branch, {
    type: 'leave_requested',
    tone: 'info',
    title: 'Leave request',
    body: `${me.name} asked for ${type.name.toLowerCase()}: ${formatRange(r.from, r.to)} (${plural(dates.length, 'day')}).`,
    entity: entity(ref.id),
  })
  addActivity(batch, actor, {
    action: 'leave_requested',
    summary: `${me.name} requested ${type.name.toLowerCase()} for ${plural(dates.length, 'day')}`,
    entity: entity(ref.id),
  })
  await batch.commit()
}

/** The employee withdraws a request that hasn't been decided yet. */
export async function cancelLeave(request: LeaveRequest): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(requests, request.id), { status: 'cancelled', updatedAt: serverTimestamp() })
  await batch.commit()
}

export interface Decision {
  request: LeaveRequest
  approve: boolean
  comment: string
  employee: User
  shift: Shift | null
  /** The employee's other requests, for the balance. */
  history: LeaveRequest[]
}

/** How an approval would split into paid and unpaid days, with the balance as it stands now. */
export function previewDecision(
  d: Omit<Decision, 'approve' | 'comment' | 'shift'>,
  branch: Branch,
) {
  const type = typeOf(branch, d.request.typeId, d.request.typeName)
  const others = d.history.filter((r) => r.id !== d.request.id)
  const year = Number(d.request.from.slice(0, 4))
  const balance = balancesFor(d.employee, branch, others, year).find((b) => b.type.id === type.id)
  return {
    type,
    remaining: balance?.remaining ?? null,
    ...splitPaidDays(d.request.dates.length, type, balance?.remaining ?? null),
  }
}

/**
 * Manager approves or rejects, in one batch: the decision, and on approval a Leave record for each
 * working day (the first `paidDays` paid, the rest unpaid and deducted from pay), plus the
 * employee's notification. Days the employee already clocked in are left as they are.
 */
export async function decideLeave(d: Decision, branch: Branch, actor: SessionUser): Promise<void> {
  const { request, employee, shift } = d
  const comment = d.comment.trim().slice(0, 300) || null
  const { paidDays, unpaidDays } = previewDecision(d, branch)
  const batch = writeBatch(db)
  batch.update(doc(requests, request.id), {
    status: d.approve ? 'approved' : 'rejected',
    paidDays: d.approve ? paidDays : null,
    decidedBy: actor.uid,
    decidedByName: actor.name,
    decidedAt: serverTimestamp(),
    managerComment: comment,
    updatedAt: serverTimestamp(),
  })

  if (d.approve) {
    const existing = await getDocs(
      query(
        attendance,
        where('branchId', '==', branch.id),
        where('employeeId', '==', employee.id),
        where('dateKey', '>=', request.from),
        where('dateKey', '<=', request.to),
        // Newest first matches the deployed (…, dateKey desc) index; ascending has none in production.
        orderBy('dateKey', 'desc'),
      ),
    )
    const byDate = new Map(
      existing.docs.map((s) => [s.get('dateKey') as string, fromDoc<Attendance>(s)]),
    )
    request.dates.forEach((dateKey, i) => {
      const record = byDate.get(dateKey)
      if (record?.clockInAt) return
      const startAt = shift ? shiftOn(shift, dateKey, branch.rules.timeZone)?.startAt : null
      batch.set(
        doc(attendance, `${employee.id}_${dateKey}`),
        {
          branchId: employee.branchId,
          employeeId: employee.id,
          employeeName: employee.name,
          dateKey,
          shiftId: shift?.id ?? null,
          shiftStart: shift?.start ?? null,
          shiftEnd: shift?.end ?? null,
          shiftStartAt: startAt ? Timestamp.fromDate(startAt) : null,
          clockInAt: null,
          clockOutAt: null,
          workedMinutes: null,
          lateMinutes: 0,
          status: 'leave',
          source: 'manager',
          correctedBy: actor.uid,
          leaveTypeId: request.typeId,
          leavePaid: i < paidDays,
          leaveRequestId: request.id,
          updatedAt: serverTimestamp(),
          ...(record ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      )
    })
  }

  const when = `${formatRange(request.from, request.to)}`
  addNotification(batch, actor, branch, {
    type: 'leave_decided',
    tone: d.approve ? 'success' : 'warning',
    title: d.approve ? 'Leave approved' : 'Leave not approved',
    body: d.approve
      ? `Your ${request.typeName.toLowerCase()} for ${when} is approved${unpaidDays ? ` (${plural(unpaidDays, 'day')} unpaid)` : ''}.${comment ? ` ${comment}` : ''}`
      : `Your ${request.typeName.toLowerCase()} for ${when} was not approved.${comment ? ` ${comment}` : ''}`,
    entity: entity(request.id),
    recipientId: employee.id,
  })
  addActivity(batch, actor, {
    action: d.approve ? 'leave_approved' : 'leave_rejected',
    summary: `${actor.name} ${d.approve ? 'approved' : 'rejected'} ${employee.name}'s ${request.typeName.toLowerCase()} (${when})`,
    entity: entity(request.id),
  })
  await batch.commit()
}

/** Manager sets the monthly salary and per-type leave allowances on the profile. */
export async function savePayAndLeave(
  employee: User,
  input: PayAndLeave,
  actor: SessionUser,
): Promise<void> {
  const v = payAndLeaveSchema.parse(input)
  const batch = writeBatch(db)
  batch.update(doc(db, COLLECTIONS.users, employee.id), {
    salary: v.salary,
    allowances: v.allowances,
    leaveAllowances: v.leaveAllowances,
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'pay_updated',
    summary: `${actor.name} updated ${employee.name}'s pay and leave allowance`,
    entity: { collection: COLLECTIONS.users, id: employee.id },
  })
  await batch.commit()
}

/** The employee's own attendance in a date range (their pay this month). */
export async function listMyAttendanceRange(uid: string, from: string, to: string) {
  const snap = await getDocs(
    query(
      attendance,
      where('employeeId', '==', uid),
      where('dateKey', '>=', from),
      where('dateKey', '<=', to),
      orderBy('dateKey', 'desc'), // uses the deployed (employeeId, dateKey desc) index
    ),
  )
  return snap.docs.map((d) => fromDoc<Attendance>(d))
}
