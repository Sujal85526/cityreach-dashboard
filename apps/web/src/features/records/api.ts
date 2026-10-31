import type { EntityRef } from '@cityreach/shared'
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
  type QueryConstraint,
  type WriteBatch,
} from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/from-doc'

/**
 * Data access for the simple record modules (expenses, incidents, equipment, feedback…): every
 * record is branch-scoped and remembers who created it. the route guards decide who may do what
 * per collection (manager records, staff logs, personal records).
 */
export interface StoredRecord {
  id: string
  branchId: string
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

const MAX_LIST = 300

/** The branch's records, newest first (or by `orderField`), with optional extra filters. */
export async function listRecords<T extends StoredRecord>(
  coll: string,
  branchId: string,
  {
    filters = [],
    orderField = 'createdAt',
    direction = 'desc',
  }: {
    filters?: QueryConstraint[]
    orderField?: string
    direction?: 'asc' | 'desc'
  } = {},
): Promise<T[]> {
  const snap = await getDocs(
    query(
      collection(db, coll),
      where('branchId', '==', branchId),
      ...filters,
      orderBy(orderField, direction),
      limit(MAX_LIST),
    ),
  )
  return snap.docs.map((d) => fromDoc<T>(d))
}

export interface SaveOptions {
  /** Activity log line after the actor's name, e.g. "added expense: Rent 1,200". */
  summary: string
  /** Fixed id (e.g. one sales record per day); default: new id, or the existing record's. */
  id?: string
  /** Adds to the same batch (notifications, related updates). */
  extra?: (batch: WriteBatch, entity: EntityRef) => void
}

/** Creates or updates a record, with its activity entry, in one batch. Returns the id. */
export async function saveRecord(
  coll: string,
  existing: StoredRecord | null,
  data: Record<string, unknown>,
  actor: SessionUser,
  { summary, id, extra }: SaveOptions,
): Promise<string> {
  const ref = existing
    ? doc(db, coll, existing.id)
    : id
      ? doc(db, coll, id)
      : doc(collection(db, coll))
  const entity = { collection: coll, id: ref.id }
  const batch = writeBatch(db)
  batch.set(
    ref,
    existing
      ? { ...data, updatedAt: serverTimestamp() }
      : {
          ...data,
          branchId: actor.access.branchId,
          createdBy: actor.uid,
          createdByName: actor.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
    { merge: true },
  )
  addActivity(batch, actor, {
    action: `${coll}_saved`,
    summary: `${actor.name} ${summary}`,
    entity,
  })
  extra?.(batch, entity)
  await batch.commit()
  return ref.id
}

export async function deleteRecord(
  coll: string,
  record: StoredRecord,
  actor: SessionUser,
  summary: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, coll, record.id))
  addActivity(batch, actor, {
    action: `${coll}_deleted`,
    summary: `${actor.name} ${summary}`,
    entity: null,
  })
  await batch.commit()
}
