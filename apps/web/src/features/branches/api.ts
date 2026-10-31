import {
  branchSummary,
  COLLECTIONS,
  monthEnd,
  salesTotal,
  toDateKey,
  type Branch,
  type BranchInfo,
  type Expense,
  type SalesDay,
} from '@cityreach/shared'
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { listAttendanceRange } from '@/features/attendance/api'
import { listEmployees } from '@/features/employees/api'
import { listItems } from '@/features/inventory/api'
import { listBranchLeave } from '@/features/leave/api'
import { listMonthPayslips } from '@/features/payslips/api'
import { listRecords } from '@/features/records/api'
import { newBranchDoc } from '@/features/settings/api'
import { listOpenTasks } from '@/features/tasks/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/from-doc'

const branches = collection(db, COLLECTIONS.branches)
const userRef = (uid: string) => doc(db, COLLECTIONS.users, uid)

/** The branches this owner owns (rules allow reading exactly these). */
export async function listMyBranches(uid: string): Promise<Branch[]> {
  const snap = await getDocs(query(branches, where('ownerId', '==', uid)))
  return snap.docs.map((d) => fromDoc<Branch>(d)).sort((a, b) => a.name.localeCompare(b.name))
}

/** The all-branches overview is for owners; there is no real auth, so the data layer checks too. */
function assertOwner(actor: SessionUser) {
  if (actor.access.role !== 'owner') throw new Error('Only an owner can see all branches.')
}

/** The owner's branches for the overview. Refuses anyone who is not an owner. */
export async function listOwnedBranches(actor: SessionUser): Promise<Branch[]> {
  assertOwner(actor)
  return listMyBranches(actor.uid)
}

/**
 * One branch's figures for the owner's overview: this month's money and today's state, in
 * parallel. Refuses non-owners and branches the actor does not own.
 */
export async function loadBranchSummary(branch: Branch, actor: SessionUser) {
  assertOwner(actor)
  if (branch.ownerId !== actor.uid) throw new Error('You do not own this branch.')
  const now = new Date()
  const today = toDateKey(now, branch.rules.timeZone)
  const month = today.slice(0, 7)
  const inMonth = {
    filters: [where('date', '>=', `${month}-01`), where('date', '<=', monthEnd(month))],
    orderField: 'date',
    direction: 'asc',
  } as const
  const [sales, expenses, payslips, attendance, tasks, stock, leave, staff] = await Promise.all([
    listRecords<SalesDay>('salesDays', branch.id, { ...inMonth, filters: [...inMonth.filters] }),
    listRecords<Expense>('expenses', branch.id, { ...inMonth, filters: [...inMonth.filters] }),
    listMonthPayslips(branch.id, month),
    listAttendanceRange(branch.id, today, today),
    listOpenTasks(branch.id),
    listItems(branch.id),
    listBranchLeave(branch.id),
    listEmployees(branch.id),
  ])
  return branchSummary({
    now,
    sales: sales.reduce((sum, d) => sum + salesTotal(d), 0),
    expenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    payroll: payslips.reduce((sum, p) => sum + p.net, 0),
    staff,
    today: attendance,
    tasks,
    stock,
    leave,
  })
}

/** Owner opens another branch (default settings); they add its staff after switching to it. */
export async function openBranch(info: BranchInfo, actor: SessionUser): Promise<string> {
  const ref = doc(branches)
  const batch = writeBatch(db)
  batch.set(ref, newBranchDoc(info, actor.uid))
  await batch.commit()
  return ref.id
}

/** Owner switches the app to one of their branches (rules check they own it). */
export async function switchBranch(branchId: string, actor: SessionUser): Promise<void> {
  const batch = writeBatch(db)
  batch.update(userRef(actor.uid), { branchId, updatedAt: serverTimestamp() })
  await batch.commit()
}

/**
 * The manager of a branch nobody owns becomes its owner (one batch: their role and the branch's
 * owner; rules allow it only while the branch has no owner). Owners can open more branches.
 */
export async function claimOwnership(actor: SessionUser): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(branches, actor.access.branchId), {
    ownerId: actor.uid,
    updatedAt: serverTimestamp(),
  })
  batch.update(userRef(actor.uid), { role: 'owner', updatedAt: serverTimestamp() })
  addActivity(batch, actor, {
    action: 'branch_claimed',
    summary: `${actor.name} became the owner`,
    entity: { collection: COLLECTIONS.branches, id: actor.access.branchId },
  })
  await batch.commit()
}
