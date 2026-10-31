import {
  addDays,
  COLLECTIONS,
  plannedShiftOn,
  type Branch,
  type RotaEntry,
  type Shift,
  type SwapRequest,
  type User,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/from-doc'
import { addNotification } from '@/lib/notify'

const rota = collection(db, COLLECTIONS.rota)
const swaps = collection(db, COLLECTIONS.swapRequests)
export const rotaId = (uid: string, date: string) => `${uid}_${date}`

/** The branch's rota between two dates (inclusive). */
export async function listRota(branchId: string, from: string, to: string): Promise<RotaEntry[]> {
  const snap = await getDocs(
    query(
      rota,
      where('branchId', '==', branchId),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date'),
    ),
  )
  return snap.docs.map((d) => fromDoc<RotaEntry>(d))
}

/** One person's rota between two dates (clock-in uses yesterday–tomorrow). */
export async function listMyRota(
  branchId: string,
  uid: string,
  from: string,
  to: string,
): Promise<RotaEntry[]> {
  const snap = await getDocs(
    query(
      rota,
      where('branchId', '==', branchId),
      where('employeeId', '==', uid),
      where('date', '>=', from),
      where('date', '<=', to),
      orderBy('date'),
    ),
  )
  return snap.docs.map((d) => fromDoc<RotaEntry>(d))
}

/** Sets one day: a shift id, null for a day off, or 'usual' to remove the override. */
export async function setRotaDay(
  employee: Pick<User, 'id' | 'name' | 'branchId'>,
  date: string,
  shiftId: string | null | 'usual',
  actor: SessionUser,
): Promise<void> {
  const batch = writeBatch(db)
  const ref = doc(rota, rotaId(employee.id, date))
  if (shiftId === 'usual') batch.delete(ref)
  else
    batch.set(ref, {
      branchId: employee.branchId,
      employeeId: employee.id,
      employeeName: employee.name,
      date,
      shiftId,
      updatedAt: serverTimestamp(),
    })
  addActivity(batch, actor, {
    action: 'rota_changed',
    summary: `${actor.name} changed ${employee.name}'s rota on ${date}`,
    entity: null,
  })
  await batch.commit()
}

/**
 * Publishes a week: every active employee gets an entry for each of the 7 days (their usual shift
 * on its days, otherwise a day off), keeping any day already planned. Staff then see the team's week.
 */
export async function publishWeek(
  weekStart: string,
  employees: User[],
  shifts: Shift[],
  existing: RotaEntry[],
  branch: Branch,
  actor: SessionUser,
): Promise<number> {
  const batch = writeBatch(db)
  let written = 0
  for (const e of employees.filter((x) => x.status !== 'inactive' && x.role === 'employee'))
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i)
      if (existing.some((r) => r.employeeId === e.id && r.date === date)) continue
      const plan = plannedShiftOn(e.shiftId, undefined, shifts, date, branch.rules.timeZone)
      batch.set(doc(rota, rotaId(e.id, date)), {
        branchId: branch.id,
        employeeId: e.id,
        employeeName: e.name,
        date,
        shiftId: plan?.shift.id ?? null,
        updatedAt: serverTimestamp(),
      })
      written++
    }
  addActivity(batch, actor, {
    action: 'rota_published',
    summary: `${actor.name} published the rota for the week of ${weekStart}`,
    entity: null,
  })
  await batch.commit()
  return written
}

export async function listSwaps(branchId: string): Promise<SwapRequest[]> {
  const snap = await getDocs(
    query(swaps, where('branchId', '==', branchId), orderBy('createdAt', 'desc')),
  )
  return snap.docs.map((d) => fromDoc<SwapRequest>(d))
}

/** Employee asks to swap their shift on a date with a colleague; the manager is notified. */
export async function requestSwap(
  input: { date: string; toId: string; toName: string; reason: string },
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const ref = doc(swaps)
  const batch = writeBatch(db)
  batch.set(ref, {
    branchId: actor.access.branchId,
    createdBy: actor.uid,
    createdByName: actor.name,
    date: input.date,
    fromId: actor.uid,
    fromName: actor.name,
    toId: input.toId,
    toName: input.toName,
    reason: input.reason.trim().slice(0, 200),
    status: 'pending',
    decidedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  addNotification(batch, actor, branch, {
    type: 'swap_requested',
    tone: 'info',
    title: 'Shift swap request',
    body: `${actor.name} asked to swap ${input.date} with ${input.toName}.`,
    entity: { collection: COLLECTIONS.swapRequests, id: ref.id },
  })
  await batch.commit()
}

export async function cancelSwap(req: SwapRequest): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(swaps, req.id), { status: 'cancelled', updatedAt: serverTimestamp() })
  await batch.commit()
}

/**
 * Manager decides. Approving exchanges the two people's planned shifts for that date (rota entries
 * written for both) and tells both of them.
 */
export async function decideSwap(
  req: SwapRequest,
  approve: boolean,
  plans: { fromShiftId: string | null; toShiftId: string | null },
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(swaps, req.id), {
    status: approve ? 'approved' : 'rejected',
    decidedBy: actor.uid,
    updatedAt: serverTimestamp(),
  })
  if (approve)
    for (const [uid, name, shiftId] of [
      [req.fromId, req.fromName, plans.toShiftId],
      [req.toId, req.toName, plans.fromShiftId],
    ] as const)
      batch.set(doc(rota, rotaId(uid, req.date)), {
        branchId: req.branchId,
        employeeId: uid,
        employeeName: name,
        date: req.date,
        shiftId,
        updatedAt: serverTimestamp(),
      })
  for (const uid of [req.fromId, req.toId])
    addNotification(batch, actor, branch, {
      type: 'swap_requested',
      tone: approve ? 'success' : 'warning',
      title: approve ? 'Shift swap approved' : 'Shift swap not approved',
      body: `${req.fromName} ↔ ${req.toName} on ${req.date}: ${approve ? 'approved, the rota is updated' : 'not approved'}.`,
      entity: { collection: COLLECTIONS.swapRequests, id: req.id },
      recipientId: uid,
    })
  addActivity(batch, actor, {
    action: approve ? 'swap_approved' : 'swap_rejected',
    summary: `${actor.name} ${approve ? 'approved' : 'rejected'} the swap ${req.fromName} ↔ ${req.toName} (${req.date})`,
    entity: { collection: COLLECTIONS.swapRequests, id: req.id },
  })
  await batch.commit()
}
