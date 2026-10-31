import { buildSampleShop, COLLECTIONS, type Branch } from '@cityreach/shared'
import { collection, doc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'

/** Collections "Load sample data" writes to; every record carries `sample: true`. */
const SAMPLE_COLLECTIONS = [
  COLLECTIONS.attendance,
  COLLECTIONS.tasks,
  COLLECTIONS.stockMovements,
  COLLECTIONS.inventoryItems,
  COLLECTIONS.suppliers,
  COLLECTIONS.users,
  COLLECTIONS.shifts,
]
const BATCH = 450

export async function hasSampleData(branchId: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.users),
      where('branchId', '==', branchId),
      where('sample', '==', true),
      limit(1),
    ),
  )
  return !snap.empty
}

/**
 * Fills the shop with the demo café (8 staff without logins, shifts, two weeks of attendance,
 * suppliers, stock and tasks) so the app can be shown before real data exists.
 * Written through the normal security rules as the signed-in manager.
 */
export async function loadSampleData(branch: Branch, actor: SessionUser): Promise<number> {
  const docs = buildSampleShop({
    branchId: branch.id,
    manager: { uid: actor.uid, name: actor.name },
    now: new Date(),
    timeZone: branch.rules.timeZone,
    criticalRatio: branch.rules.inventory.criticalRatio,
    idPrefix: 'sample-',
    emailDomain: 'sample.demo',
    tag: true,
  })
  // Staff and shifts first, so attendance and tasks never point at missing records.
  const first: string[] = [
    COLLECTIONS.shifts,
    COLLECTIONS.users,
    COLLECTIONS.suppliers,
    COLLECTIONS.inventoryItems,
  ]
  const rank = (c: string) => (first.includes(c) ? first.indexOf(c) : first.length)
  docs.sort((a, b) => rank(a.collection) - rank(b.collection))
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = writeBatch(db)
    for (const d of docs.slice(i, i + BATCH)) batch.set(doc(db, d.collection, d.id), d.data)
    if (i + BATCH >= docs.length)
      addActivity(batch, actor, {
        action: 'sample_loaded',
        summary: `${actor.name} loaded sample data`,
        entity: null,
      })
    await batch.commit()
  }
  return docs.length
}

/** Deletes exactly the records tagged `sample: true` (real records are never touched). */
export async function removeSampleData(branch: Branch, actor: SessionUser): Promise<number> {
  const sampleStaff = await getDocs(
    query(
      collection(db, COLLECTIONS.users),
      where('branchId', '==', branch.id),
      where('sample', '==', true),
    ),
  )
  const refs = (
    await Promise.all(
      SAMPLE_COLLECTIONS.map((c) =>
        getDocs(
          query(collection(db, c), where('branchId', '==', branch.id), where('sample', '==', true)),
        ).then((s) => s.docs.map((d) => d.ref)),
      ),
    )
  ).flat()
  // Weekly performance snapshots of the sample staff ({uid}_{week}).
  const ids = sampleStaff.docs.map((d) => d.id)
  for (let i = 0; i < ids.length; i += 30) {
    const snaps = await getDocs(
      query(
        collection(db, COLLECTIONS.performance),
        where('branchId', '==', branch.id),
        where('employeeId', 'in', ids.slice(i, i + 30)),
      ),
    )
    refs.push(...snaps.docs.map((d) => d.ref))
  }
  // Real staff put on a sample shift lose it (otherwise they'd point at a deleted shift and
  // couldn't clock in): they become "No fixed shift".
  const sampleShifts = refs.filter((r) => r.parent.id === COLLECTIONS.shifts).map((r) => r.id)
  const realOnSampleShifts = sampleShifts.length
    ? (
        await getDocs(
          query(
            collection(db, COLLECTIONS.users),
            where('branchId', '==', branch.id),
            where('shiftId', 'in', sampleShifts),
          ),
        )
      ).docs.filter((d) => d.get('sample') !== true)
    : []

  for (let i = 0; i < refs.length; i += BATCH) {
    const batch = writeBatch(db)
    if (i === 0) for (const u of realOnSampleShifts) batch.update(u.ref, { shiftId: null })
    for (const ref of refs.slice(i, i + BATCH)) batch.delete(ref)
    if (i + BATCH >= refs.length)
      addActivity(batch, actor, {
        action: 'sample_removed',
        summary: `${actor.name} removed the sample data`,
        entity: null,
      })
    await batch.commit()
  }
  return refs.length
}
