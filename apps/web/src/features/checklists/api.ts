import { COLLECTIONS, type ChecklistRun, type ChecklistTemplate } from '@dm/shared'
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'

const runs = collection(db, COLLECTIONS.checklistRuns)
export const runId = (templateId: string, date: string) => `${templateId}_${date}`

/** All checklist runs of the branch on one day. */
export async function listRuns(branchId: string, date: string): Promise<ChecklistRun[]> {
  const snap = await getDocs(
    query(runs, where('branchId', '==', branchId), where('date', '==', date)),
  )
  return snap.docs.map((d) => fromDoc<ChecklistRun>(d))
}

/**
 * Ticks (or unticks) one item of today's checklist, creating the day's run from the template on the
 * first tick. A transaction, so two people ticking at once don't overwrite each other. The run is
 * complete when every item is done.
 */
export async function toggleItem(
  template: ChecklistTemplate,
  date: string,
  index: number,
  actor: SessionUser,
): Promise<void> {
  const ref = doc(runs, runId(template.id, date))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const items = snap.exists()
      ? fromDoc<ChecklistRun>(snap).items
      : template.items.map((text) => ({ text, done: false, by: null, at: null }))
    const item = items[index]
    if (!item) throw new Error('That item no longer exists. Reload the checklist.')
    const done = !item.done
    const next = items.map((it, i) =>
      i === index
        ? { text: it.text, done, by: done ? actor.name : null, at: done ? Timestamp.now() : null }
        : { ...it, at: it.at ? Timestamp.fromDate(it.at) : null },
    )
    const complete = next.every((it) => it.done)
    if (snap.exists())
      tx.update(ref, {
        items: next,
        completedAt: complete ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
    else
      tx.set(ref, {
        branchId: actor.access.branchId,
        templateId: template.id,
        templateName: template.name,
        date,
        items: next,
        completedAt: complete ? serverTimestamp() : null,
        createdBy: actor.uid,
        createdByName: actor.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
  })
}
