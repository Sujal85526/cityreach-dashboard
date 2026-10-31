import { COLLECTIONS, isManagerRole, type Notification } from '@dm/shared'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Query,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'

const notifications = collection(db, COLLECTIONS.notifications)
export const NOTIFICATION_PAGE = 50

/**
 * Whose bell: managers see the branch-wide alerts (recipientId == null), employees see the
 * ones addressed to them. Both queries match firestore.rules, so they're allowed as lists.
 */
function mine(user: SessionUser): Query {
  return isManagerRole(user.access.role)
    ? query(
        notifications,
        where('branchId', '==', user.access.branchId),
        where('recipientId', '==', null),
      )
    : query(notifications, where('recipientId', '==', user.uid))
}

/** Live: the latest notifications, newest first. */
export function subscribeNotifications(
  user: SessionUser,
  onData: (items: Notification[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(mine(user), orderBy('createdAt', 'desc'), limit(NOTIFICATION_PAGE)),
    (snap) => onData(snap.docs.map((d) => fromDoc<Notification>(d))),
    onError,
  )
}

/** Live: number of unread notifications (the bell badge). */
export function subscribeUnreadCount(
  user: SessionUser,
  onData: (count: number) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(mine(user), where('readAt', '==', null)),
    (snap) => onData(snap.size),
    onError,
  )
}

/** Marks notifications read (rules allow changing only `readAt`). */
export async function markRead(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 450))
      batch.update(doc(notifications, id), { readAt: serverTimestamp() })
    await batch.commit()
  }
}

/** Where a notification leads when clicked. */
export function linkFor(n: Notification, role: SessionUser['access']['role']): string {
  const manager = isManagerRole(role)
  const base = manager ? '' : '/me'
  switch (n.entity?.collection) {
    case COLLECTIONS.attendance:
      return manager ? '/attendance' : '/me/attendance'
    case COLLECTIONS.tasks:
      return `${base}/tasks`
    case COLLECTIONS.inventoryItems:
      return '/inventory'
    case COLLECTIONS.documents:
      return '/documents'
    case COLLECTIONS.leaveRequests:
      return `${base}/leave`
    case COLLECTIONS.reports:
      return '/reports'
    case COLLECTIONS.users:
      return manager ? `/employees/${n.entity.id}` : '/me'
    default:
      return manager ? '/notifications' : '/me/notifications'
  }
}
