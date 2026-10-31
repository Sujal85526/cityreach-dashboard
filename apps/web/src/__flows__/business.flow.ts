/**
 * End-to-end flows for the operations, purchasing, rota and owner modules, through the real
 * api.ts code against the emulators (firestore.rules enforced). `pnpm test:flows`.
 *
 *   purchase order received → stock up + movements → can't be received twice
 *   rota day off → clock-in refused (by the app and by the rules) → rota shift → clock-in counted against it
 *   swap request → manager notified → approved → both rota days exchanged
 *   checklist ticked by staff → complete → unticked → open again
 *   temperature out of range → manager alerted; in range → no alert
 *   date reminders (machine service) sent once
 *   manager claims the branch → owner → opens and switches branch; can't switch to someone else's
 */
import {
  addDays,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PERFORMANCE_WEIGHTS,
  toDateKey,
  type Branch,
  type ChecklistTemplate,
  type Equipment,
  type PurchaseOrder,
  type Shift,
  type User,
} from '@dm/shared'
import { readFileSync } from 'node:fs'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clockIn } from '@/features/attendance/api'
import type { SessionUser } from '@/features/auth/api'
import { checkDateReminders } from '@/features/automation/reminders'
import { claimOwnership, openBranch, switchBranch } from '@/features/branches/api'
import { toggleItem } from '@/features/checklists/api'
import { temperatureModule } from '@/features/food-safety/modules'
import { createItem, listItems, receiveOrder } from '@/features/inventory/api'
import { listRecords, saveRecord } from '@/features/records/api'
import { decideSwap, listRota, listSwaps, requestSwap, setRotaDay } from '@/features/rota/api'
import { auth } from '@/lib/firebase'
import {
  clearFirestore,
  createLogin,
  deleteLogins,
  getDoc,
  listDocs,
  loadRules,
  putDoc,
} from './emulator'

const BRANCH = 'bizshop'
const PASSWORD = 'flow-test-password'
const HOUR = 3_600_000
const run = Date.now()
const now = new Date()
const today = toDateKey(now, 'UTC')
const hhmm = (d: Date) => d.toISOString().slice(11, 16)

const branch: Branch = {
  id: BRANCH,
  name: 'Business Flow Café',
  address: '',
  phone: '',
  rules: {
    timeZone: 'UTC',
    attendance: { graceMinutes: 5, absentAfterMinutes: 60 },
    inventory: { criticalRatio: 0.5 },
    performance: DEFAULT_PERFORMANCE_WEIGHTS,
  },
  businessHours: [],
  taskCategories: ['Cleaning'],
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  location: null,
  createdAt: now,
  updatedAt: now,
}
// Both shifts are open right now (started 20 minutes ago).
const shift = (id: string): Shift => {
  const start = new Date(Math.floor((run - 20 * 60_000) / 60_000) * 60_000)
  return {
    id,
    branchId: BRANCH,
    name: id,
    start: hhmm(start),
    end: hhmm(new Date(start.getTime() + 8 * HOUR)),
    days: [0, 1, 2, 3, 4, 5, 6],
    createdAt: now,
    updatedAt: now,
  }
}
const usual = shift('usual-shift')
const cover = shift('cover-shift')

type Who = 'manager' | 'barista' | 'colleague'
const people = {} as Record<Who, { uid: string; email: string; user: User }>
const session = (who: Who, role = people[who].user.role): SessionUser => ({
  uid: people[who].uid,
  email: people[who].email,
  name: people[who].user.name,
  access: { role, branchId: BRANCH, status: 'active' },
})
async function signInAs(who: Who) {
  await signOut(auth)
  await signInWithEmailAndPassword(auth, people[who].email, PASSWORD)
  await auth.authStateReady()
  await new Promise((r) => setTimeout(r, 300))
}
const notifications = async (type: string) =>
  (await listDocs('notifications')).filter((n) => n.type === type && n.branchId === BRANCH)

beforeAll(async () => {
  await loadRules(readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'))
  await clearFirestore()
  const make = async (key: Who, name: string, role: User['role'], shiftId: string | null) => {
    const email = `${key}-${run}@biz.test`
    const uid = await createLogin(email, PASSWORD)
    const user: User = {
      id: uid,
      branchId: BRANCH,
      role,
      status: 'active',
      name,
      email,
      phone: '',
      position: role === 'employee' ? 'Barista' : 'Manager',
      shiftId,
      hiredAt: new Date(run - 400 * 24 * HOUR),
      stats: { attendancePct: 100, performanceScore: 0, updatedAt: now },
      notes: [],
      warnings: [],
      achievements: [],
      createdAt: now,
      updatedAt: now,
    }
    people[key] = { uid, email, user }
    const { id: _id, ...doc } = user
    await putDoc(`users/${uid}`, doc)
  }
  await make('manager', 'Hana Biz', 'manager', null)
  await make('barista', 'Ahmed Biz', 'employee', usual.id)
  await make('colleague', 'Nour Biz', 'employee', null)
  const { id: _b, ...branchDoc } = branch
  await putDoc(`branches/${BRANCH}`, branchDoc)
  for (const { id, ...doc } of [usual, cover]) await putDoc(`shifts/${id}`, doc)
})

afterAll(async () => {
  await signOut(auth)
  await deleteLogins(Object.values(people).map((p) => p.uid))
})

describe('purchase order received → stock', () => {
  it('adds the ordered quantities to stock with a movement each, and only once', async () => {
    await signInAs('manager')
    const manager = session('manager')
    await createItem(
      {
        name: 'Oat Milk',
        category: 'Dairy',
        unit: 'L',
        quantity: 2,
        minQuantity: 10,
        supplierId: null,
      },
      null,
      branch,
      manager,
    )
    const [item] = await listItems(BRANCH)
    if (!item) throw new Error('item not created')
    expect(item.status).not.toBe('in_stock')

    const lines = [{ itemId: item.id, itemName: item.name, unit: 'L', quantity: 20, unitPrice: 11 }]
    await saveRecord(
      'purchaseOrders',
      null,
      {
        number: 'PO-0001',
        supplierId: 'green',
        supplierName: 'Green Valley',
        status: 'ordered',
        lines,
        total: 220,
        invoiceNumber: '',
        note: '',
        orderedOn: today,
        expectedOn: addDays(today, 1),
        receivedOn: null,
        paymentDueOn: null,
        paidOn: null,
      },
      manager,
      { summary: 'ordered PO-0001' },
    )
    const [order] = await listRecords<PurchaseOrder>('purchaseOrders', BRANCH)
    if (!order) throw new Error('order not saved')

    await receiveOrder(order, today, branch, manager)
    expect(await getDoc(`inventoryItems/${item.id}`)).toMatchObject({
      quantity: 22,
      status: 'in_stock',
    })
    expect(await getDoc(`purchaseOrders/${order.id}`)).toMatchObject({
      status: 'received',
      receivedOn: today,
    })
    const deliveries = (await listDocs('stockMovements')).filter(
      (m) => m.itemId === item.id && m.reason === 'delivery',
    )
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({ delta: 20, quantityAfter: 22 })

    await expect(receiveOrder(order, today, branch, manager)).rejects.toThrow(/received already/)
    expect(await getDoc(`inventoryItems/${item.id}`)).toMatchObject({ quantity: 22 })
  })
})

describe('rota → clock-in', () => {
  it('refuses clock-in on a rota day off (app and rules), allows the rota shift', async () => {
    await signInAs('manager')
    await setRotaDay(people.barista.user, today, null, session('manager'))

    await signInAs('barista')
    const rotaOff = [
      {
        id: `${people.barista.uid}_${today}`,
        branchId: BRANCH,
        employeeId: people.barista.uid,
        employeeName: 'Ahmed Biz',
        date: today,
        shiftId: null,
        updatedAt: now,
      },
    ]
    const me = people.barista.user
    const shifts = [usual, cover]
    const capture = { location: null, photo: null }
    await expect(
      clockIn({ me, shifts, rota: rotaOff, branch }, session('barista'), capture),
    ).rejects.toThrow(/off today/)
    // An app that ignored the rota still can't: the rules read the rota day.
    await expect(
      clockIn({ me, shifts, rota: [], branch }, session('barista'), capture),
    ).rejects.toThrow()

    await signInAs('manager')
    await setRotaDay(people.barista.user, today, cover.id, session('manager'))
    const rota = await listRota(BRANCH, today, today)
    await signInAs('barista')
    const result = await clockIn({ me, shifts, rota, branch }, session('barista'), capture)
    // The cover shift started 20 minutes ago (5 min grace) → late, against the rota's shift.
    expect(result).toMatchObject({ status: 'late', shiftId: cover.id })
    expect(result.lateMinutes).toBeGreaterThanOrEqual(19)
  })
})

describe('shift swap → approval → rota', () => {
  it('notifies the manager, then exchanges both people’s shifts on that day', async () => {
    const date = addDays(today, 3)
    await signInAs('barista')
    await requestSwap(
      { date, toId: people.colleague.uid, toName: 'Nour Biz', reason: 'Dentist' },
      branch,
      session('barista'),
    )
    expect(await notifications('swap_requested')).toHaveLength(1)

    await signInAs('manager')
    const [req] = await listSwaps(BRANCH)
    if (!req) throw new Error('swap not saved')
    expect(req).toMatchObject({ status: 'pending', fromName: 'Ahmed Biz' })
    await decideSwap(
      req,
      true,
      { fromShiftId: usual.id, toShiftId: null },
      branch,
      session('manager'),
    )
    expect(await getDoc(`swapRequests/${req.id}`)).toMatchObject({ status: 'approved' })
    expect(await getDoc(`rota/${people.barista.uid}_${date}`)).toMatchObject({ shiftId: null })
    expect(await getDoc(`rota/${people.colleague.uid}_${date}`)).toMatchObject({
      shiftId: usual.id,
    })
    const told = (await notifications('swap_requested')).map((n) => n.recipientId)
    expect(told).toEqual(expect.arrayContaining([people.barista.uid, people.colleague.uid]))
  })
})

describe('checklist', () => {
  it('is complete when staff tick every item, and open again when one is unticked', async () => {
    await signInAs('manager')
    const id = await saveRecord(
      'checklistTemplates',
      null,
      { name: 'Opening', kind: 'Opening', items: ['Machine on', 'Fridge temps'] },
      session('manager'),
      { summary: 'added a checklist' },
    )
    const template = (await listRecords<ChecklistTemplate>('checklistTemplates', BRANCH)).find(
      (t) => t.id === id,
    )
    if (!template) throw new Error('template not saved')

    await signInAs('barista')
    await toggleItem(template, today, 0, session('barista'))
    expect(await getDoc(`checklistRuns/${id}_${today}`)).toMatchObject({ completedAt: null })
    await toggleItem(template, today, 1, session('barista'))
    const done = await getDoc(`checklistRuns/${id}_${today}`)
    expect(done?.completedAt).toBeInstanceOf(Date)
    expect(done?.items).toEqual([
      expect.objectContaining({ done: true, by: 'Ahmed Biz' }),
      expect.objectContaining({ done: true, by: 'Ahmed Biz' }),
    ])
    await toggleItem(template, today, 1, session('barista'))
    expect(await getDoc(`checklistRuns/${id}_${today}`)).toMatchObject({ completedAt: null })
  })
})

describe('temperature log → alert', () => {
  it('alerts the manager for a reading out of range, not for one in range', async () => {
    await signInAs('manager')
    const fridgeId = await saveRecord(
      'equipment',
      null,
      {
        name: 'Milk fridge',
        kind: 'Fridge',
        serial: '',
        purchasedOn: addDays(today, -100),
        warrantyUntil: null,
        // Serviced 85 days ago every 90 days → due in 5 days (inside the 7-day reminder window).
        serviceEveryDays: 90,
        lastServiceOn: addDays(today, -85),
        status: 'working',
        tempMin: 1,
        tempMax: 5,
      },
      session('manager'),
      { summary: 'added equipment' },
    )
    const [fridge] = await listRecords<Equipment>('equipment', BRANCH)
    if (!fridge) throw new Error('fridge not saved')

    await signInAs('barista')
    const ctx = { today, branch, actor: session('barista'), isManager: false }
    const m = temperatureModule(ctx, [fridge])
    const log = async (reading: number) => {
      const data = m.prepare?.({ equipmentId: fridgeId, date: today, reading, note: '' }) ?? {}
      await saveRecord('temperatureLogs', null, data, ctx.actor, {
        summary: m.describe(data),
        extra: (batch, entity) => m.extra?.(batch, entity, data),
      })
    }
    await log(7.2)
    await log(3.5)
    const alerts = await notifications('temperature_alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.body).toMatch(/Milk fridge read 7.2 °C \(allowed 1 to 5 °C\)/)
    const logs = await listDocs('temperatureLogs')
    expect(logs.map((l) => l.ok).sort()).toEqual([false, true])
  })

  it('reminds about the machine service once', async () => {
    await signInAs('manager')
    const employees = Object.values(people).map((p) => p.user)
    expect(await checkDateReminders(branch, employees, session('manager'))).toBe(1)
    expect(await checkDateReminders(branch, employees, session('manager'))).toBe(0)
    expect(await notifications('equipment_service')).toHaveLength(1)
  })
})

describe('owner and branches', () => {
  it('staff cannot claim the branch; the manager can, then opens and switches branches', async () => {
    await signInAs('barista')
    await expect(claimOwnership(session('barista'))).rejects.toThrow()

    await signInAs('manager')
    await claimOwnership(session('manager'))
    expect(await getDoc(`users/${people.manager.uid}`)).toMatchObject({ role: 'owner' })
    expect(await getDoc(`branches/${BRANCH}`)).toMatchObject({ ownerId: people.manager.uid })

    const owner = session('manager', 'owner')
    await new Promise((r) => setTimeout(r, 300))
    const second = await openBranch(
      { name: 'Marina', address: '', phone: '', timeZone: 'UTC' },
      owner,
    )
    await switchBranch(second, owner)
    expect(await getDoc(`users/${people.manager.uid}`)).toMatchObject({ branchId: second })

    // A branch someone else runs can't be switched to.
    const { id: _id, ...other } = { ...branch, name: 'Not mine', ownerId: 'someone-else' }
    await putDoc('branches/not-mine', other)
    await expect(switchBranch('not-mine', owner)).rejects.toThrow()
    await switchBranch(BRANCH, owner)
  })
})
