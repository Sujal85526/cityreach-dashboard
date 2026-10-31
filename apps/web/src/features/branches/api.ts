import { COLLECTIONS, type Branch, type BranchInfo } from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { forgetCachedSession, type SessionUser } from '@/features/auth/api'
import { newBranchDoc } from '@/features/settings/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'

const branches = collection(db, COLLECTIONS.branches)
const userRef = (uid: string) => doc(db, COLLECTIONS.users, uid)

/** The branches this owner owns (rules allow reading exactly these). */
export async function listMyBranches(uid: string): Promise<Branch[]> {
  const snap = await getDocs(query(branches, where('ownerId', '==', uid)))
  return snap.docs.map((d) => fromDoc<Branch>(d)).sort((a, b) => a.name.localeCompare(b.name))
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
  forgetCachedSession(actor.uid) // the reload that follows must not open the old branch
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
  forgetCachedSession(actor.uid)
}
