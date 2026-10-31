import { COLLECTIONS, type EntityRef } from '@cityreach/shared'
import { collection, doc, serverTimestamp, type Transaction, type WriteBatch } from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { db } from '@/lib/store'

interface ActivityInput {
  action: string
  summary: string
  entity: EntityRef | null
}

/**
 * Adds an audit-log entry to a batch, so the action and its log entry are saved together.
 * `actorId` is the signed-in demo user.
 */
export function addActivity(
  batch: WriteBatch | Transaction,
  actor: SessionUser,
  input: ActivityInput,
) {
  // Both WriteBatch and Transaction have set(ref, data); the cast picks one overload for TS.
  ;(batch as WriteBatch).set(doc(collection(db, COLLECTIONS.activity)), {
    branchId: actor.access.branchId,
    actorId: actor.uid,
    actorName: actor.name,
    ...input,
    createdAt: serverTimestamp(),
  })
}
