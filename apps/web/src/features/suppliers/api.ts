import { COLLECTIONS, supplierInputSchema, type Supplier, type SupplierInput } from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/firestore'

const suppliers = collection(db, COLLECTIONS.suppliers)
const items = collection(db, COLLECTIONS.inventoryItems)
const entity = (id: string) => ({ collection: COLLECTIONS.suppliers, id })

export async function listSuppliers(branchId: string): Promise<Supplier[]> {
  const snap = await getDocs(query(suppliers, where('branchId', '==', branchId)))
  return snap.docs.map((d) => fromDoc<Supplier>(d)).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Create (no `current`) or update a supplier. A renamed supplier's name is copied onto its
 * inventory items in the same batch, because the inventory table shows `supplierName`.
 */
export async function saveSupplier(
  current: Supplier | null,
  input: SupplierInput,
  actor: SessionUser,
): Promise<void> {
  const s = supplierInputSchema.parse(input)
  const ref = current ? doc(suppliers, current.id) : doc(suppliers)
  const batch = writeBatch(db)
  if (current) batch.update(ref, { ...s, updatedAt: serverTimestamp() })
  else
    batch.set(ref, {
      ...s,
      branchId: actor.access.branchId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

  if (current && current.name !== s.name) {
    const linked = await getDocs(
      query(
        items,
        where('branchId', '==', actor.access.branchId),
        where('supplierId', '==', current.id),
      ),
    )
    linked.docs.forEach((d) =>
      batch.update(d.ref, { supplierName: s.name, updatedAt: serverTimestamp() }),
    )
  }
  addActivity(batch, actor, {
    action: current ? 'supplier_updated' : 'supplier_added',
    summary: `${actor.name} ${current ? 'updated' : 'added'} supplier ${s.name}`,
    entity: entity(ref.id),
  })
  await batch.commit()
}

/** Refused while items still use the supplier, so no item points at a missing supplier. */
export async function deleteSupplier(supplier: Supplier, actor: SessionUser): Promise<void> {
  const linked = await getDocs(
    query(
      items,
      where('branchId', '==', actor.access.branchId),
      where('supplierId', '==', supplier.id),
      limit(1),
    ),
  )
  if (!linked.empty) throw new Error(`Move ${supplier.name}'s items to another supplier first.`)
  const batch = writeBatch(db)
  batch.delete(doc(suppliers, supplier.id))
  addActivity(batch, actor, {
    action: 'supplier_deleted',
    summary: `${actor.name} removed supplier ${supplier.name}`,
    entity: null,
  })
  await batch.commit()
}
