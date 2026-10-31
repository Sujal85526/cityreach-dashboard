import {
  COLLECTIONS,
  type Branch,
  type EntityRef,
  type NotificationTone,
  type NotificationType,
} from '@cityreach/shared'
import { collection, doc, serverTimestamp, type Transaction, type WriteBatch } from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { db } from './firebase'

interface NotificationInput {
  type: NotificationType
  tone: NotificationTone
  title: string
  body: string
  entity: EntityRef | null
  /** null = every manager of the branch. */
  recipientId?: string | null
}

/**
 * Adds a rule-based notification to the same batch as the action that caused it,
 * unless the manager switched that type off in Settings → Notification preferences.
 */
export function addNotification(
  batch: WriteBatch | Transaction,
  actor: SessionUser,
  branch: Pick<Branch, 'notificationPrefs'>,
  input: NotificationInput,
) {
  if (branch.notificationPrefs[input.type] === false) return
  ;(batch as WriteBatch).set(doc(collection(db, COLLECTIONS.notifications)), {
    branchId: actor.access.branchId,
    recipientId: input.recipientId ?? null,
    actorId: actor.uid,
    type: input.type,
    tone: input.tone,
    title: input.title,
    body: input.body,
    entity: input.entity,
    readAt: null,
    createdAt: serverTimestamp(),
  })
}
