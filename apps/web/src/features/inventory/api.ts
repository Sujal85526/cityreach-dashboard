import {
  applyStockChange,
  COLLECTIONS,
  inventoryItemInputSchema,
  shouldAlertStockChange,
  stockStatus,
  type Branch,
  type InventoryItem,
  type PurchaseOrder,
  type InventoryItemInput,
  type StockChange,
  type StockMovement,
  type StockStatus,
  type Supplier,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Transaction,
  type WriteBatch,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'
import { addNotification } from '@/lib/notify'

const items = collection(db, COLLECTIONS.inventoryItems)
const movements = collection(db, COLLECTIONS.stockMovements)
const entity = (id: string) => ({ collection: COLLECTIONS.inventoryItems, id })

export type MovementReason = StockMovement['reason']

export async function listItems(branchId: string): Promise<InventoryItem[]> {
  const snap = await getDocs(query(items, where('branchId', '==', branchId)))
  return snap.docs
    .map((d) => fromDoc<InventoryItem>(d))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Last 20 stock changes of one item, newest first. */
export async function listMovements(branchId: string, itemId: string): Promise<StockMovement[]> {
  const snap = await getDocs(
    query(
      movements,
      where('branchId', '==', branchId),
      where('itemId', '==', itemId),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
  )
  return snap.docs.map((d) => fromDoc<StockMovement>(d))
}

/**
 * "Whole Milk has fallen below its minimum stock level." Sent only when the status gets
 * worse (in stock → low → critical), so updates within the same band don't spam the manager.
 */
function alertIfWorse(
  writer: WriteBatch | Transaction,
  prev: StockStatus,
  next: StockStatus,
  item: { id: string; name: string; quantity: number; minQuantity: number; unit: string },
  branch: Branch,
  actor: SessionUser,
) {
  if (!shouldAlertStockChange(prev, next)) return
  const left = `${item.quantity} ${item.unit} left, minimum ${item.minQuantity} ${item.unit}`
  addNotification(writer, actor, branch, {
    type: next === 'critical' ? 'stock_critical' : 'stock_low',
    tone: next === 'critical' ? 'danger' : 'warning',
    title: next === 'critical' ? 'Critical stock' : 'Low stock',
    body:
      next === 'critical'
        ? `${item.name} is critically low (${left}). Reorder today.`
        : `${item.name} has fallen below its minimum stock level (${left}).`,
    entity: entity(item.id),
  })
}

function movementDoc(
  branchId: string,
  item: { id: string; name: string },
  delta: number,
  quantityAfter: number,
  reason: MovementReason,
  actor: SessionUser,
) {
  return {
    branchId,
    itemId: item.id,
    itemName: item.name,
    delta,
    quantityAfter,
    reason,
    by: actor.uid,
    byName: actor.name,
    createdAt: serverTimestamp(),
  }
}

export async function createItem(
  input: InventoryItemInput,
  supplier: Supplier | null,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const i = inventoryItemInputSchema.parse(input)
  const ref = doc(items)
  const status = stockStatus(i.quantity, i.minQuantity, branch.rules.inventory.criticalRatio)
  const batch = writeBatch(db)
  batch.set(ref, {
    ...i,
    branchId: branch.id,
    supplierName: supplier?.name ?? null,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(
    doc(movements),
    movementDoc(
      branch.id,
      { id: ref.id, name: i.name },
      i.quantity,
      i.quantity,
      'correction',
      actor,
    ),
  )
  addActivity(batch, actor, {
    action: 'stock_item_added',
    summary: `${actor.name} added ${i.name} (${i.quantity} ${i.unit})`,
    entity: entity(ref.id),
  })
  alertIfWorse(batch, 'in_stock', status, { ...i, id: ref.id }, branch, actor)
  await batch.commit()
}

/** Edits details. Quantity changes go through adjustStock so every change is logged. */
export async function updateItem(
  item: InventoryItem,
  input: InventoryItemInput,
  supplier: Supplier | null,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const { quantity: _ignored, ...i } = inventoryItemInputSchema.parse({
    ...input,
    quantity: item.quantity,
  })
  const status = stockStatus(item.quantity, i.minQuantity, branch.rules.inventory.criticalRatio)
  const batch = writeBatch(db)
  batch.update(doc(items, item.id), {
    ...i,
    supplierName: supplier?.name ?? null,
    status,
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'stock_item_updated',
    summary: `${actor.name} updated ${i.name}`,
    entity: entity(item.id),
  })
  alertIfWorse(batch, item.status, status, { ...item, ...i }, branch, actor)
  await batch.commit()
}

/**
 * Stock in / out / count, in one transaction (docs/PRODUCT.md §5): re-reads the current
 * quantity, applies the change, recalculates Low / Critical, logs a stock movement and the
 * activity entry, and alerts the manager only if the status got worse.
 */
export async function adjustStock(
  itemId: string,
  change: StockChange,
  reason: MovementReason,
  branch: Branch,
  actor: SessionUser,
): Promise<{ quantity: number; status: StockStatus }> {
  return runTransaction(db, async (tx) => {
    const ref = doc(items, itemId)
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('This item no longer exists.')
    const item = fromDoc<InventoryItem>(snap)
    const { quantity, delta } = applyStockChange(item.quantity, change)
    if (delta === 0) throw new Error('That would not change the stock level.')
    const status = stockStatus(quantity, item.minQuantity, branch.rules.inventory.criticalRatio)

    tx.update(ref, { quantity, status, updatedAt: serverTimestamp() })
    tx.set(doc(movements), movementDoc(branch.id, item, delta, quantity, reason, actor))
    addActivity(tx, actor, {
      action: `stock_${reason}`,
      summary: `${actor.name} ${delta > 0 ? 'added' : 'removed'} ${Math.abs(delta)} ${item.unit} of ${item.name} (${reason}) → ${quantity} ${item.unit}`,
      entity: entity(item.id),
    })
    alertIfWorse(tx, item.status, status, { ...item, quantity }, branch, actor)
    return { quantity, status }
  })
}

/**
 * Receives a purchase order in one transaction: every line is added to stock (delivery movement,
 * Low / Critical recomputed), the order is marked received, and the activity log notes it.
 * Lines whose item was deleted are skipped. Example: 20 L oat milk at 14 L → 34 L, back to In stock.
 */
export async function receiveOrder(
  order: PurchaseOrder,
  receivedOn: string,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, COLLECTIONS.purchaseOrders, order.id)
    const current = await tx.get(orderRef)
    if (!current.exists() || current.get('status') !== 'ordered')
      throw new Error(
        'Only an ordered purchase can be received (it may have been received already).',
      )
    const snaps = await Promise.all(order.lines.map((l) => tx.get(doc(items, l.itemId))))
    snaps.forEach((snap, i) => {
      const line = order.lines[i]
      if (!snap.exists() || !line) return
      const item = fromDoc<InventoryItem>(snap)
      const { quantity, delta } = applyStockChange(item.quantity, {
        mode: 'add',
        amount: line.quantity,
      })
      const status = stockStatus(quantity, item.minQuantity, branch.rules.inventory.criticalRatio)
      tx.update(snap.ref, { quantity, status, updatedAt: serverTimestamp() })
      tx.set(doc(movements), movementDoc(branch.id, item, delta, quantity, 'delivery', actor))
    })
    tx.update(orderRef, { status: 'received', receivedOn, updatedAt: serverTimestamp() })
    addActivity(tx, actor, {
      action: 'order_received',
      summary: `${actor.name} received ${order.number} from ${order.supplierName} (${order.lines.length} items)`,
      entity: { collection: COLLECTIONS.purchaseOrders, id: order.id },
    })
  })
}

export async function deleteItem(item: InventoryItem, actor: SessionUser): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(items, item.id))
  addActivity(batch, actor, {
    action: 'stock_item_deleted',
    summary: `${actor.name} removed ${item.name} from inventory`,
    entity: null,
  })
  await batch.commit()
}
