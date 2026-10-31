/**
 * Security-rule tests for firestore.rules (the server-side guard on the free plan).
 * Needs the Firestore emulator running: `pnpm emulators`, then `pnpm test:rules`.
 * Uses its own project id, so it never touches the seeded demo data.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  query,
  where,
  Bytes,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const BRANCH = 'b1'
const HOUR = 3_600_000
let env: RulesTestEnvironment
/** What a cheating phone would send: a time a few minutes earlier than now. */
const backdated = () => Timestamp.fromMillis(Date.now() - 2 * 60_000)

const user = (role: 'manager' | 'employee', shiftId: string | null, status = 'active') => ({
  branchId: BRANCH,
  role,
  status,
  shiftId,
  name: role,
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-test',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = fs(ctx)
    await setDoc(doc(db, 'branches', BRANCH), { rules: { attendance: { graceMinutes: 5 } } })
    await setDoc(doc(db, 'shifts', 'evening'), { branchId: BRANCH, start: '15:00', end: '23:00' })
    await setDoc(doc(db, 'users', 'boss'), user('manager', null))
    await setDoc(doc(db, 'users', 'emp'), user('employee', 'evening'))
    await setDoc(doc(db, 'users', 'other'), user('employee', 'evening'))
    await setDoc(doc(db, 'users', 'gone'), user('employee', 'evening', 'inactive'))
  })
})

// The testing library returns the compat Firestore type; the modular API accepts the same object.
const fs = (ctx: RulesTestContext) => ctx.firestore() as unknown as Firestore
const as = (uid: string) => fs(env.authenticatedContext(uid))
const DATE = '2026-10-07'
const ref = (db: Firestore, uid = 'emp') => doc(db, 'attendance', `${uid}_${DATE}`)

/** A valid phase-1 clock-in; `startsInMs` places the shift start relative to now. */
const clockIn = (uid = 'emp', startsInMs = HOUR, extra: Record<string, unknown> = {}) => {
  const startAt = Math.floor((Date.now() + startsInMs) / 1000) * 1000
  return {
    branchId: BRANCH,
    employeeId: uid,
    employeeName: uid,
    dateKey: DATE,
    shiftId: 'evening',
    shiftStart: '15:00',
    shiftEnd: '23:00',
    shiftStartAt: Timestamp.fromMillis(startAt),
    shiftEndAt: Timestamp.fromMillis(startAt + 8 * HOUR), // 15:00–23:00 is 480 min
    clockInAt: serverTimestamp(),
    clockOutAt: null,
    workedMinutes: null,
    lateMinutes: 0,
    status: 'pending',
    source: 'web',
    correctedBy: null,
    clockInLocation: { lat: 25.2048, lng: 55.2708, accuracy: 20, distance: 15, inside: true },
    photo: false,
    ...extra,
  }
}

/** Status the rules expect, computed from what the server actually stored. */
async function expectedClassification(db: Firestore) {
  const d = (await getDoc(ref(db))).data() as { clockInAt: Timestamp; shiftStartAt: Timestamp }
  const diff = Math.floor((d.clockInAt.toMillis() - d.shiftStartAt.toMillis()) / 60_000)
  return diff > 5 ? { status: 'late', lateMinutes: diff } : { status: 'on_time', lateMinutes: 0 }
}

describe('clock in', () => {
  it('accepts a clock-in stamped with server time for the assigned shift', async () => {
    // The app first checks that today's record doesn't exist yet.
    await assertSucceeds(getDoc(ref(as('emp'))))
    await assertFails(getDoc(ref(as('emp'), 'other')))
    await assertSucceeds(setDoc(ref(as('emp')), clockIn()))
  })

  it('rejects a clock-in time set by the phone', async () => {
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', HOUR, { clockInAt: backdated() })))
  })

  it('rejects writing the final status directly (it must be checked in step 2)', async () => {
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', HOUR, { status: 'on_time' })))
  })

  it("rejects a shift that isn't the employee's, or a moved start time", async () => {
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', HOUR, { shiftId: 'morning' })))
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', HOUR, { shiftStart: '18:00' })))
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', 5 * HOUR))) // shift start far in the future
  })

  it('rejects clocking in for someone else, twice, or while deactivated', async () => {
    await assertFails(setDoc(ref(as('emp'), 'other'), clockIn('other')))
    await assertSucceeds(setDoc(ref(as('emp')), clockIn()))
    await assertFails(setDoc(ref(as('emp')), clockIn()))
    await assertFails(setDoc(ref(as('gone'), 'gone'), clockIn('gone')))
  })

  it('lets a late arrival replace an automatic Absent, but not a manager record', async () => {
    const seed = (source: string) =>
      env.withSecurityRulesDisabled((ctx) =>
        setDoc(ref(fs(ctx)), { ...clockIn(), clockInAt: null, status: 'absent', source }),
      )
    await seed('system')
    await assertSucceeds(setDoc(ref(as('emp')), clockIn('emp', -2 * HOUR)))
    await seed('manager')
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', -2 * HOUR)))
  })
})

describe('on time / late classification', () => {
  for (const [label, startsIn] of [
    ['on time', HOUR],
    ['late', -30 * 60_000],
  ] as const) {
    it(`accepts only the exact ${label} result computed from server times`, async () => {
      const db = as('emp')
      await setDoc(ref(db), clockIn('emp', startsIn))
      const right = await expectedClassification(db)
      const wrong =
        right.status === 'late'
          ? { status: 'on_time', lateMinutes: 0 }
          : { status: 'late', lateMinutes: 1 }
      await assertFails(updateDoc(ref(db), { ...wrong, updatedAt: serverTimestamp() }))
      await assertSucceeds(updateDoc(ref(db), { ...right, updatedAt: serverTimestamp() }))
      expect(right.status).toBe(label === 'late' ? 'late' : 'on_time')
      // Once classified it can't be changed by the employee.
      await assertFails(updateDoc(ref(db), { status: 'on_time', lateMinutes: 0 }))
    })
  }
})

describe('clock out', () => {
  it('requires server time, happens once, and totals worked minutes exactly', async () => {
    const db = as('emp')
    await setDoc(ref(db), clockIn())
    await updateDoc(ref(db), { ...(await expectedClassification(db)) })
    await assertFails(updateDoc(ref(db), { clockOutAt: backdated(), updatedAt: serverTimestamp() }))
    await assertSucceeds(
      updateDoc(ref(db), { clockOutAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    )
    await assertFails(updateDoc(ref(db), { clockOutAt: serverTimestamp() }))
    await assertFails(updateDoc(ref(db), { workedMinutes: 480 }))
    const { worked, early } = await expectedTotals(db)
    await assertSucceeds(
      updateDoc(ref(db), {
        workedMinutes: worked,
        earlyLeaveMinutes: early,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('checks the early-leave minutes exactly, and keeps the reason short', async () => {
    const db = as('emp')
    await setDoc(ref(db), clockIn('emp', -HOUR)) // shift started 1 h ago, ends in 7 h
    await updateDoc(ref(db), { ...(await expectedClassification(db)) })
    await assertFails(
      updateDoc(ref(db), { clockOutAt: serverTimestamp(), earlyLeaveReason: 'x'.repeat(201) }),
    )
    await assertFails(
      updateDoc(ref(db), { clockOutAt: serverTimestamp(), clockOutLocation: { lat: 'here' } }),
    )
    await assertSucceeds(
      updateDoc(ref(db), {
        clockOutAt: serverTimestamp(),
        clockOutLocation: { lat: 25.2, lng: 55.27, accuracy: 30, distance: 500, inside: false },
        earlyLeaveReason: 'Feeling unwell',
        updatedAt: serverTimestamp(),
      }),
    )
    const { worked, early } = await expectedTotals(db)
    expect(early).toBeGreaterThan(400) // about 7 h left
    await assertFails(updateDoc(ref(db), { workedMinutes: worked, earlyLeaveMinutes: 0 }))
    await assertSucceeds(updateDoc(ref(db), { workedMinutes: worked, earlyLeaveMinutes: early }))
  })
})

/** Worked and early-leave minutes the rules expect, from the stored server times (grace 10). */
async function expectedTotals(db: Firestore) {
  const d = (await getDoc(ref(db))).data() as Record<string, Timestamp>
  const mins = (a: Timestamp, b: Timestamp) => Math.floor((b.toMillis() - a.toMillis()) / 60_000)
  const left = mins(d.clockOutAt!, d.shiftEndAt!)
  return { worked: Math.max(0, mins(d.clockInAt!, d.clockOutAt!)), early: left > 10 ? left : 0 }
}

describe('clock-in location and photo', () => {
  const photo = (uid = 'emp', image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==') => ({
    branchId: BRANCH,
    employeeId: uid,
    dateKey: DATE,
    image,
    takenAt: serverTimestamp(),
  })
  const photoRef = (db: Firestore, uid = 'emp') => doc(db, 'attendancePhotos', `${uid}_${DATE}`)
  const clockInWithPhoto = (db: Firestore, p = photo()) => {
    const batch = writeBatch(db)
    batch.set(ref(db), clockIn('emp', HOUR, { photo: true }))
    batch.set(photoRef(db), p)
    return batch.commit()
  }

  it('rejects a shift end moved earlier, or a malformed location', async () => {
    const early = Timestamp.fromMillis(Date.now() + 2 * HOUR)
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', HOUR, { shiftEndAt: early })))
    await assertFails(setDoc(ref(as('emp')), clockIn('emp', HOUR, { clockInLocation: 'shop' })))
    await assertSucceeds(setDoc(ref(as('emp')), clockIn('emp', HOUR, { clockInLocation: null })))
  })

  it('stores the photo only together with the clock-in, as a small JPEG', async () => {
    await assertFails(clockInWithPhoto(as('emp'), photo('emp', 'data:image/png;base64,AAAA')))
    await assertFails(
      clockInWithPhoto(as('emp'), photo('emp', `data:image/jpeg;base64,${'A'.repeat(160_000)}`)),
    )
    await assertSucceeds(
      clockInWithPhoto(as('emp'), photo('emp', `data:image/jpeg;base64,${'A'.repeat(50_000)}`)),
    )
    // A photo sent later (not at the clock-in instant) is refused.
    await assertFails(setDoc(photoRef(as('emp')), photo()))
  })

  it('shows the photo to the employee and their manager only', async () => {
    await clockInWithPhoto(as('emp'))
    await assertSucceeds(getDoc(photoRef(as('emp'))))
    await assertSucceeds(getDoc(photoRef(as('boss'))))
    await assertFails(getDoc(photoRef(as('other'))))
    await assertFails(deleteDoc(photoRef(as('emp'))))
    await assertSucceeds(deleteDoc(photoRef(as('boss'))))
  })
})

describe('who can read and correct', () => {
  it('keeps attendance private to the employee and their manager', async () => {
    await setDoc(ref(as('emp')), clockIn())
    await assertSucceeds(getDoc(ref(as('emp'))))
    await assertFails(getDoc(ref(as('other'))))
    await assertSucceeds(
      getDocs(query(collection(as('boss'), 'attendance'), where('branchId', '==', BRANCH))),
    )
    await assertFails(
      getDocs(query(collection(as('other'), 'attendance'), where('branchId', '==', BRANCH))),
    )
  })

  it('lets the manager record leave; employees cannot', async () => {
    const leave = { ...clockIn(), clockInAt: null, status: 'leave', source: 'manager' }
    await assertFails(setDoc(ref(as('emp')), leave))
    await assertSucceeds(setDoc(ref(as('boss')), leave))
  })
})

describe('leave requests', () => {
  const request = (uid = 'emp', extra: Record<string, unknown> = {}) => ({
    branchId: BRANCH,
    employeeId: uid,
    employeeName: uid,
    typeId: 'annual',
    typeName: 'Annual leave',
    from: '2026-11-02',
    to: '2026-11-04',
    dates: ['2026-11-02', '2026-11-03', '2026-11-04'],
    reason: 'Family visit',
    status: 'pending',
    paidDays: null,
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    managerComment: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  })
  const leave = (db: Firestore, id = 'r1') => doc(db, 'leaveRequests', id)
  const decide = (status: string, paidDays: number | null, by = 'boss') => ({
    status,
    paidDays,
    decidedBy: by,
    decidedByName: by,
    decidedAt: serverTimestamp(),
    managerComment: null,
    updatedAt: serverTimestamp(),
  })

  it('lets employees ask only for themselves, as a pending request', async () => {
    await assertFails(setDoc(leave(as('emp')), request('other')))
    await assertFails(setDoc(leave(as('emp')), request('emp', { status: 'approved', paidDays: 3 })))
    await assertFails(setDoc(leave(as('gone')), request('gone')))
    await assertSucceeds(setDoc(leave(as('emp')), request()))
  })

  it('lets only the manager approve or reject, once, and keeps requests private', async () => {
    await setDoc(leave(as('emp')), request())
    await assertFails(updateDoc(leave(as('emp')), decide('approved', 3, 'emp')))
    await assertFails(updateDoc(leave(as('boss')), decide('approved', 9))) // more paid days than dates
    await assertSucceeds(updateDoc(leave(as('boss')), decide('approved', 2)))
    await assertFails(updateDoc(leave(as('boss')), decide('rejected', null)))
    await assertSucceeds(getDoc(leave(as('emp'))))
    await assertFails(getDoc(leave(as('other'))))
  })

  it('lets the employee cancel only a pending request', async () => {
    await setDoc(leave(as('emp')), request())
    await assertFails(updateDoc(leave(as('other')), { status: 'cancelled' }))
    await assertSucceeds(
      updateDoc(leave(as('emp')), { status: 'cancelled', updatedAt: serverTimestamp() }),
    )
    await setDoc(leave(as('emp'), 'r2'), request())
    await updateDoc(leave(as('boss'), 'r2'), decide('rejected', null))
    await assertFails(updateDoc(leave(as('emp'), 'r2'), { status: 'cancelled' }))
  })
})

describe('documents', () => {
  const details = (by = 'boss', extra: Record<string, unknown> = {}) => ({
    branchId: BRANCH,
    name: 'Trade license 2026',
    category: 'License',
    note: '',
    fileName: 'license.pdf',
    mimeType: 'application/pdf',
    originalSize: 1000,
    storedSize: 900,
    encoding: 'gzip',
    chunkCount: 1,
    uploadedBy: by,
    uploadedByName: by,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  })
  const chunk = (size = 900) => ({
    branchId: BRANCH,
    documentId: 'd1',
    index: 0,
    data: Bytes.fromUint8Array(new Uint8Array(size)),
  })
  const docRef = (db: Firestore) => doc(db, 'documents', 'd1')
  const chunkRef = (db: Firestore, id = 'd1_0') => doc(db, 'documentChunks', id)

  it('lets only the manager store, read, rename and delete documents', async () => {
    await assertFails(setDoc(docRef(as('emp')), details('emp')))
    await assertFails(setDoc(chunkRef(as('emp')), chunk()))
    await assertSucceeds(setDoc(docRef(as('boss')), details()))
    await assertSucceeds(setDoc(chunkRef(as('boss')), chunk()))
    await assertFails(getDoc(docRef(as('emp'))))
    await assertFails(getDoc(chunkRef(as('emp'))))
    await assertSucceeds(getDoc(chunkRef(as('boss'))))
    await assertSucceeds(
      updateDoc(docRef(as('boss')), { name: 'License (renewed)', updatedAt: serverTimestamp() }),
    )
    await assertFails(updateDoc(docRef(as('boss')), { storedSize: 1 }))
    await assertSucceeds(
      updateDoc(docRef(as('boss')), {
        expiresOn: '2027-01-15',
        remindDaysBefore: 30,
        remindedFor: null,
      }),
    )
    await assertFails(updateDoc(docRef(as('boss')), { expiresOn: 'next year' }))
    await assertSucceeds(deleteDoc(chunkRef(as('boss'))))
  })

  it('refuses oversized pieces and files over 5 MB', async () => {
    await assertFails(setDoc(chunkRef(as('boss')), chunk(800_000)))
    await assertFails(setDoc(chunkRef(as('boss'), 'd1_9'), chunk())) // id must match document + index
    await assertFails(setDoc(docRef(as('boss')), details('boss', { storedSize: 6_000_000 })))
  })
})

describe('payslips', () => {
  const slip = (by = 'boss', extra: Record<string, unknown> = {}) => ({
    branchId: BRANCH,
    employeeId: 'emp',
    employeeName: 'emp',
    position: 'Barista',
    month: '2026-10',
    salary: 3000,
    allowances: 0,
    overtimeMinutes: 0,
    overtimePay: 0,
    bonus: 0,
    unpaidLeaveDays: 0,
    absentDays: 0,
    leaveDeduction: 0,
    otherDeductions: 0,
    deductionNote: '',
    gross: 3000,
    net: 3000,
    status: 'draft',
    paidAt: null,
    preparedBy: by,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  })
  const slipRef = (db: Firestore, id = 'emp_2026-10') => doc(db, 'payslips', id)

  it('lets only the manager prepare and mark payslips paid', async () => {
    await assertFails(setDoc(slipRef(as('emp')), slip('emp')))
    await assertFails(setDoc(slipRef(as('boss'), 'emp_2026-11'), slip())) // id must match month
    await assertFails(setDoc(slipRef(as('boss')), slip('boss', { net: 5000 }))) // net above gross
    await assertSucceeds(setDoc(slipRef(as('boss')), slip()))
    await assertSucceeds(
      updateDoc(slipRef(as('boss')), { status: 'paid', paidAt: serverTimestamp() }),
    )
    await assertFails(updateDoc(slipRef(as('emp')), { status: 'draft' }))
  })

  it('shows each employee only their own payslip', async () => {
    await setDoc(slipRef(as('boss')), slip())
    await assertSucceeds(getDoc(slipRef(as('emp'))))
    await assertFails(getDoc(slipRef(as('other'))))
  })
})

describe('owner and branches', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = fs(ctx)
      await setDoc(doc(db, 'users', 'owner'), user('owner' as 'manager', null))
      await setDoc(doc(db, 'branches', 'b2'), { ownerId: 'owner', rules: {} })
      await setDoc(doc(db, 'branches', 'b3'), { ownerId: 'someone-else', rules: {} })
    })
  })

  it('lets an owner switch only into branches they own', async () => {
    await assertSucceeds(updateDoc(doc(as('owner'), 'users', 'owner'), { branchId: 'b2' }))
    await assertFails(updateDoc(doc(as('owner'), 'users', 'owner'), { branchId: 'b3' }))
    await assertFails(updateDoc(doc(as('boss'), 'users', 'boss'), { branchId: 'b2' })) // not an owner
  })

  it('lets only an owner open a branch or make someone an owner', async () => {
    await assertSucceeds(setDoc(doc(as('owner'), 'branches', 'b4'), { ownerId: 'owner' }))
    await assertFails(setDoc(doc(as('boss'), 'branches', 'b5'), { ownerId: 'boss' }))
    await assertFails(updateDoc(doc(as('boss'), 'users', 'emp'), { role: 'owner' }))
    await assertSucceeds(updateDoc(doc(as('owner'), 'users', 'emp'), { role: 'manager' }))
  })

  it('lets a manager claim an unowned branch together with becoming owner', async () => {
    const db = as('boss')
    const claim = writeBatch(db)
    claim.update(doc(db, 'branches', BRANCH), { ownerId: 'boss' })
    claim.update(doc(db, 'users', 'boss'), { role: 'owner', updatedAt: serverTimestamp() })
    await assertSucceeds(claim.commit())
    const thief = as('other')
    const steal = writeBatch(thief)
    steal.update(doc(thief, 'users', 'other'), { role: 'owner' })
    await assertFails(steal.commit())
  })
})

describe('operations records', () => {
  const rec = (by: string, extra: Record<string, unknown> = {}) => ({
    branchId: BRANCH,
    createdBy: by,
    createdByName: by,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  })

  it('keeps manager records (expenses, equipment…) to managers', async () => {
    await assertFails(setDoc(doc(as('emp'), 'expenses', 'e1'), rec('emp', { amount: 10 })))
    await assertSucceeds(setDoc(doc(as('boss'), 'expenses', 'e1'), rec('boss', { amount: 10 })))
    await assertFails(getDoc(doc(as('emp'), 'expenses', 'e1')))
    await assertFails(setDoc(doc(as('boss'), 'expenses', 'e2'), rec('emp'))) // someone else's name
  })

  it('lets staff add logs in their own name at server time; only managers change them', async () => {
    await assertSucceeds(
      setDoc(doc(as('emp'), 'temperatureLogs', 't1'), rec('emp', { reading: 4 })),
    )
    await assertFails(setDoc(doc(as('emp'), 'incidents', 'i1'), rec('other')))
    await assertFails(
      setDoc(doc(as('emp'), 'handovers', 'h1'), rec('emp', { createdAt: backdated() })),
    )
    await assertSucceeds(getDoc(doc(as('other'), 'temperatureLogs', 't1')))
    await assertFails(updateDoc(doc(as('emp'), 'temperatureLogs', 't1'), { reading: 3 }))
    await assertSucceeds(updateDoc(doc(as('boss'), 'temperatureLogs', 't1'), { reading: 3 }))
  })

  it('shows training and goals to the manager and to that employee only', async () => {
    await assertSucceeds(setDoc(doc(as('boss'), 'goals', 'g1'), rec('boss', { employeeId: 'emp' })))
    await assertSucceeds(getDoc(doc(as('emp'), 'goals', 'g1')))
    await assertFails(getDoc(doc(as('other'), 'goals', 'g1')))
    await assertFails(setDoc(doc(as('emp'), 'goals', 'g2'), rec('emp', { employeeId: 'emp' })))
  })

  it('lets staff tick checklist items but not edit anything else', async () => {
    // The first tick of the day reads the run before it exists (transaction).
    await assertSucceeds(getDoc(doc(as('emp'), 'checklistRuns', `open_${DATE}`)))
    const run = rec('emp', { templateId: 'open', date: DATE, items: [], completedAt: null })
    await assertSucceeds(setDoc(doc(as('emp'), 'checklistRuns', `open_${DATE}`), run))
    await assertSucceeds(
      updateDoc(doc(as('other'), 'checklistRuns', `open_${DATE}`), { items: [{ done: true }] }),
    )
    await assertFails(
      updateDoc(doc(as('other'), 'checklistRuns', `open_${DATE}`), { date: '2027-01-01' }),
    )
  })
})

describe('rota and swaps', () => {
  it('uses the rota shift for clock-in: a day off refuses it, a planned shift allows it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(fs(ctx), 'rota', `emp_${DATE}`), {
        branchId: BRANCH,
        employeeId: 'emp',
        date: DATE,
        shiftId: null,
      })
    })
    await assertFails(setDoc(ref(as('emp')), clockIn())) // usual shift, but the rota says day off
    await assertSucceeds(
      setDoc(
        ref(as('emp')),
        clockIn('emp', HOUR, {
          shiftId: null,
          shiftStart: null,
          shiftEnd: null,
          shiftStartAt: null,
          shiftEndAt: null,
        }),
      ),
    )
  })

  it('lets only managers plan the rota', async () => {
    const entry = { branchId: BRANCH, employeeId: 'emp', date: DATE, shiftId: 'evening' }
    await assertFails(setDoc(doc(as('emp'), 'rota', `emp_${DATE}`), entry))
    await assertSucceeds(setDoc(doc(as('boss'), 'rota', `emp_${DATE}`), entry))
    await assertSucceeds(getDoc(doc(as('other'), 'rota', `emp_${DATE}`)))
  })

  it('lets an employee ask for a swap as themselves; the manager decides', async () => {
    const req = {
      branchId: BRANCH,
      createdBy: 'emp',
      createdByName: 'emp',
      date: DATE,
      fromId: 'emp',
      fromName: 'emp',
      toId: 'other',
      toName: 'other',
      reason: '',
      status: 'pending',
      decidedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await assertFails(setDoc(doc(as('other'), 'swapRequests', 's1'), req)) // not as themselves
    await assertSucceeds(setDoc(doc(as('emp'), 'swapRequests', 's1'), req))
    await assertFails(
      updateDoc(doc(as('emp'), 'swapRequests', 's1'), { status: 'approved', decidedBy: 'emp' }),
    )
    await assertSucceeds(
      updateDoc(doc(as('boss'), 'swapRequests', 's1'), { status: 'approved', decidedBy: 'boss' }),
    )
  })
})

describe('tasks', () => {
  const task = (status: string, deadlineInMs: number, extra: Record<string, unknown> = {}) => ({
    branchId: BRANCH,
    title: 'Clean espresso machine',
    description: '',
    category: 'Cleaning',
    assigneeId: 'emp',
    assigneeName: 'emp',
    priority: 'high',
    deadline: Timestamp.fromMillis(Date.now() + deadlineInMs),
    status,
    completedAt: null,
    createdBy: 'boss',
    ...extra,
  })
  const tRef = (db: Firestore) => doc(db, 'tasks', 't1')
  const seedTask = (data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled((ctx) => setDoc(tRef(fs(ctx)), data))

  it('only managers create tasks, always starting as pending', async () => {
    await assertFails(setDoc(tRef(as('emp')), task('pending', HOUR)))
    await assertFails(setDoc(tRef(as('boss')), task('completed', HOUR)))
    await assertSucceeds(setDoc(tRef(as('boss')), task('pending', HOUR)))
  })

  it('lets the assignee start, put back and complete with server time', async () => {
    await seedTask(task('pending', HOUR))
    const db = as('emp')
    await assertSucceeds(
      updateDoc(tRef(db), { status: 'in_progress', updatedAt: serverTimestamp() }),
    )
    await assertSucceeds(updateDoc(tRef(db), { status: 'pending', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(tRef(db), { status: 'completed', completedAt: backdated() }))
    await assertSucceeds(
      updateDoc(tRef(db), { status: 'completed', completedAt: serverTimestamp() }),
    )
    await assertFails(updateDoc(tRef(db), { status: 'pending', completedAt: null })) // no reopening
  })

  it('stops employees editing anything else, or tasks that are not theirs', async () => {
    await seedTask(task('pending', HOUR))
    await assertFails(
      updateDoc(tRef(as('emp')), { deadline: Timestamp.fromMillis(Date.now() + 9 * HOUR) }),
    )
    await assertFails(updateDoc(tRef(as('emp')), { status: 'in_progress', priority: 'low' }))
    await assertFails(updateDoc(tRef(as('other')), { status: 'in_progress' }))
    await assertFails(getDoc(tRef(as('other'))))
  })

  it('allows overdue only after the deadline, and an overdue task can still be completed', async () => {
    await seedTask(task('pending', HOUR))
    await assertFails(updateDoc(tRef(as('boss')), { title: 'x', branchId: 'elsewhere' }))
    await assertFails(
      updateDoc(tRef(as('emp')), { status: 'overdue', updatedAt: serverTimestamp() }),
    )
    await seedTask(task('in_progress', -HOUR))
    await assertSucceeds(
      updateDoc(tRef(as('emp')), { status: 'overdue', updatedAt: serverTimestamp() }),
    )
    await assertFails(updateDoc(tRef(as('emp')), { status: 'in_progress' }))
    await assertSucceeds(
      updateDoc(tRef(as('emp')), { status: 'completed', completedAt: serverTimestamp() }),
    )
  })
})

describe('inventory', () => {
  const item = (quantity: number, status: string, extra: Record<string, unknown> = {}) => ({
    branchId: BRANCH,
    name: 'Oat Milk',
    category: 'Dairy',
    unit: 'L',
    quantity,
    minQuantity: 15,
    supplierId: null,
    supplierName: null,
    status,
    ...extra,
  })
  const iRef = (db: Firestore) => doc(db, 'inventoryItems', 'oat')
  beforeEach(() =>
    env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(fs(ctx), 'branches', BRANCH), {
        rules: { attendance: { graceMinutes: 5 }, inventory: { criticalRatio: 0.5 } },
      }),
    ),
  )

  it('stores only the status the stock rule gives (14 L vs min 15 L is low)', async () => {
    await assertFails(setDoc(iRef(as('boss')), item(14, 'in_stock')))
    await assertSucceeds(setDoc(iRef(as('boss')), item(14, 'low')))
    await assertFails(updateDoc(iRef(as('boss')), { quantity: 7, status: 'low' }))
    await assertSucceeds(updateDoc(iRef(as('boss')), { quantity: 7, status: 'critical' }))
    await assertFails(updateDoc(iRef(as('boss')), { quantity: -1, status: 'critical' }))
  })

  it('keeps inventory and its movement log manager-only', async () => {
    await assertFails(setDoc(iRef(as('emp')), item(20, 'in_stock')))
    await env.withSecurityRulesDisabled((ctx) => setDoc(iRef(fs(ctx)), item(20, 'in_stock')))
    await assertFails(getDoc(iRef(as('emp'))))
    const move = { branchId: BRANCH, itemId: 'oat', delta: -2, by: 'boss' }
    await assertFails(setDoc(doc(as('emp'), 'stockMovements', 'm1'), { ...move, by: 'emp' }))
    await assertFails(
      setDoc(doc(as('boss'), 'stockMovements', 'm1'), { ...move, by: 'someone-else' }),
    )
    await assertSucceeds(setDoc(doc(as('boss'), 'stockMovements', 'm1'), move))
  })
})

describe('notifications', () => {
  const note = (recipientId: string | null, actorId = 'boss') => ({
    branchId: BRANCH,
    recipientId,
    actorId,
    type: 'task_assigned',
    tone: 'info',
    title: 'New task',
    body: 'x',
    entity: null,
    readAt: null,
  })
  const nRef = (db: Firestore, id: string) => doc(db, 'notifications', id)
  beforeEach(() =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(nRef(fs(ctx), 'mine'), note('emp'))
      await setDoc(nRef(fs(ctx), 'managers'), note(null))
    }),
  )

  it('shows employees only their own, managers only the branch alerts', async () => {
    await assertSucceeds(
      getDocs(query(collection(as('emp'), 'notifications'), where('recipientId', '==', 'emp'))),
    )
    await assertFails(getDoc(nRef(as('emp'), 'managers')))
    await assertFails(getDoc(nRef(as('other'), 'mine')))
    await assertSucceeds(
      getDocs(
        query(
          collection(as('boss'), 'notifications'),
          where('branchId', '==', BRANCH),
          where('recipientId', '==', null),
        ),
      ),
    )
  })

  it('lets the reader mark as read, and change nothing else', async () => {
    await assertSucceeds(updateDoc(nRef(as('emp'), 'mine'), { readAt: serverTimestamp() }))
    await assertFails(updateDoc(nRef(as('emp'), 'mine'), { body: 'edited' }))
    await assertFails(updateDoc(nRef(as('other'), 'mine'), { readAt: serverTimestamp() }))
  })

  it('never lets anyone write a notification in someone else’s name', async () => {
    await assertFails(setDoc(nRef(as('emp'), 'fake'), note(null, 'boss')))
    await assertSucceeds(setDoc(nRef(as('emp'), 'real'), note(null, 'emp')))
  })
})

describe('performance', () => {
  const snap = (managerRating: unknown) => ({
    branchId: BRANCH,
    employeeId: 'emp',
    period: '2026-W41',
    score: 80,
    managerRating,
  })
  const pRef = (db: Firestore) => doc(db, 'performance', 'emp_2026-W41')

  it('lets only managers write snapshots, with a 1–5 whole-number rating', async () => {
    await assertFails(setDoc(pRef(as('emp')), snap(5)))
    await assertFails(setDoc(pRef(as('boss')), snap(6)))
    await assertFails(setDoc(pRef(as('boss')), snap(3.5)))
    await assertSucceeds(setDoc(pRef(as('boss')), snap(null)))
    await assertSucceeds(setDoc(pRef(as('boss')), snap(4)))
    await assertFails(getDoc(pRef(as('emp'))))
  })
})

describe('sample data', () => {
  it('lets a manager delete only records tagged as sample data', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(fs(ctx), 'users', 'sample-ahmed'), {
        ...user('employee', null),
        sample: true,
      })
      await setDoc(doc(fs(ctx), 'attendance', 'sample-ahmed_2026-10-07'), {
        branchId: BRANCH,
        employeeId: 'sample-ahmed',
        sample: true,
      })
    })
    await assertFails(deleteDoc(doc(as('emp'), 'users', 'sample-ahmed')))
    await assertFails(deleteDoc(doc(as('boss'), 'users', 'emp'))) // a real employee
    await assertSucceeds(deleteDoc(doc(as('boss'), 'users', 'sample-ahmed')))
    await assertSucceeds(deleteDoc(doc(as('boss'), 'attendance', 'sample-ahmed_2026-10-07')))
  })
})
