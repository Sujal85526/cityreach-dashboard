import {
  branchInfoSchema,
  COLLECTIONS,
  DEFAULT_BRANCH_RULES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TASK_CATEGORIES,
  shiftInputSchema,
  type Branch,
  type BranchInfo,
  type Shift,
  type ShiftInput,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'

const branchRef = (branchId: string) => doc(db, COLLECTIONS.branches, branchId)
const shifts = collection(db, COLLECTIONS.shifts)

export async function getBranch(branchId: string): Promise<Branch | null> {
  const snap = await getDoc(branchRef(branchId))
  return snap.exists() ? fromDoc<Branch>(snap) : null
}

/** A new branch document with the default settings (first run, or an owner opening another branch). */
export function newBranchDoc(info: BranchInfo, ownerId: string | null) {
  const { timeZone, ...rest } = branchInfoSchema.parse(info)
  return {
    ...rest,
    rules: { ...DEFAULT_BRANCH_RULES, timeZone },
    businessHours: DEFAULT_BUSINESS_HOURS,
    taskCategories: DEFAULT_TASK_CATEGORIES,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    ownerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

/** First run in production: creates the manager's branch with default settings. */
export async function createBranch(info: BranchInfo, actor: SessionUser): Promise<void> {
  const batch = writeBatch(db)
  const data = newBranchDoc(info, null)
  batch.set(branchRef(actor.access.branchId), data)
  addActivity(batch, actor, {
    action: 'branch_created',
    summary: `${actor.name} set up ${data.name}`,
    entity: { collection: COLLECTIONS.branches, id: actor.access.branchId },
  })
  await batch.commit()
}

/** Settings fields a page may change. Each page saves only its own fields. */
export type BranchPatch = Partial<
  Pick<
    Branch,
    | 'name'
    | 'address'
    | 'phone'
    | 'rules'
    | 'businessHours'
    | 'taskCategories'
    | 'notificationPrefs'
    | 'location'
    | 'leaveTypes'
    | 'vat'
  >
>

export async function updateBranch(
  patch: BranchPatch,
  what: string,
  actor: SessionUser,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(branchRef(actor.access.branchId), { ...patch, updatedAt: serverTimestamp() })
  addActivity(batch, actor, {
    action: 'settings_updated',
    summary: `${actor.name} updated ${what}`,
    entity: { collection: COLLECTIONS.branches, id: actor.access.branchId },
  })
  await batch.commit()
}

export async function listShifts(branchId: string): Promise<Shift[]> {
  const snap = await getDocs(query(shifts, where('branchId', '==', branchId)))
  return snap.docs.map((d) => fromDoc<Shift>(d)).sort((a, b) => a.start.localeCompare(b.start))
}

/** Creates (no id) or updates a shift. */
export async function saveShift(
  id: string | null,
  input: ShiftInput,
  actor: SessionUser,
): Promise<void> {
  const shift = shiftInputSchema.parse(input)
  const ref = id ? doc(shifts, id) : doc(shifts)
  const batch = writeBatch(db)
  if (id) batch.update(ref, { ...shift, updatedAt: serverTimestamp() })
  else
    batch.set(ref, {
      ...shift,
      branchId: actor.access.branchId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  addActivity(batch, actor, {
    action: id ? 'shift_updated' : 'shift_created',
    summary: `${actor.name} ${id ? 'updated' : 'added'} the ${shift.name} shift`,
    entity: { collection: COLLECTIONS.shifts, id: ref.id },
  })
  await batch.commit()
}

/** Refuses while employees are still assigned, so nobody is left pointing at a missing shift. */
export async function deleteShift(shift: Shift, actor: SessionUser): Promise<void> {
  const assigned = await getDocs(
    query(
      collection(db, COLLECTIONS.users),
      where('branchId', '==', actor.access.branchId),
      where('shiftId', '==', shift.id),
      limit(1),
    ),
  )
  if (!assigned.empty)
    throw new Error(`Move the employees on the ${shift.name} shift to another shift first.`)
  const batch = writeBatch(db)
  batch.delete(doc(shifts, shift.id))
  addActivity(batch, actor, {
    action: 'shift_deleted',
    summary: `${actor.name} removed the ${shift.name} shift`,
    entity: { collection: COLLECTIONS.shifts, id: shift.id },
  })
  await batch.commit()
}
