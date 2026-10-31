import { COLLECTIONS, type Activity } from '@cityreach/shared'
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from '@/lib/store'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/from-doc'

const activity = collection(db, COLLECTIONS.activity)

/** Newest audit-log entries for the dashboard's "Recent activity". */
export async function listRecentActivity(branchId: string, count = 8): Promise<Activity[]> {
  const snap = await getDocs(
    query(activity, where('branchId', '==', branchId), orderBy('createdAt', 'desc'), limit(count)),
  )
  return snap.docs.map((d) => fromDoc<Activity>(d))
}

/** Events since `since`, counted on the server (no documents downloaded). */
export async function countActivitySince(branchId: string, since: Date): Promise<number> {
  const snap = await getCountFromServer(
    query(
      activity,
      where('branchId', '==', branchId),
      where('createdAt', '>=', Timestamp.fromDate(since)),
    ),
  )
  return snap.data().count
}
