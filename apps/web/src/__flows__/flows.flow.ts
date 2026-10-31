/**
 * End-to-end flows through the real api.ts code, as a signed-in employee or manager,
 * against the emulators (firestore.rules enforced). `pnpm test:flows` with `pnpm emulators` running.
 *
 * Covers the module chains from docs/PRODUCT.md:
 *   clock in → attendance → lateness → notification + activity
 *   stock update → status → stock movement → alert only when worse
 *   deadline passes → overdue → notification; employee completes → notification
 *   no clock-in → automatic absence (+ notification only for recent no-shows)
 */
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PERFORMANCE_WEIGHTS,
  monthlyPay,
  payFacts,
  toDateKey,
  type Branch,
  type Shift,
  type Task,
  type User,
} from '@dm/shared'
import { readFileSync } from 'node:fs'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clockIn, clockOut, recordId } from '@/features/attendance/api'
import type { SessionUser } from '@/features/auth/api'
import { markAbsences } from '@/features/automation/api'
import {
  checkDocumentExpiry,
  deleteDocument,
  listDocuments,
  loadDocumentFile,
  updateDocumentDetails,
  uploadDocument,
} from '@/features/documents/api'
import { adjustStock, createItem } from '@/features/inventory/api'
import { decideLeave, listBranchLeave, requestLeave, savePayAndLeave } from '@/features/leave/api'
import { markOverdueTasks, moveTask } from '@/features/tasks/api'
import { listMyPayslips, savePayslip } from '@/features/payslips/api'
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

const BRANCH = 'flowshop'
const PASSWORD = 'flow-test-password'
const HOUR = 3_600_000
const run = Date.now()
const now = new Date()
const hhmm = (d: Date) => d.toISOString().slice(11, 16) // branch timezone is UTC in these tests
const minuteFloor = (ms: number) => new Date(Math.floor(ms / 60_000) * 60_000)

const branch: Branch = {
  id: BRANCH,
  name: 'Flow Test Café',
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
  location: { lat: 25.2048, lng: 55.2708, radiusMeters: 100 },
  createdAt: now,
  updatedAt: now,
}

const shiftStarting = (id: string, start: Date): Shift => ({
  id,
  branchId: BRANCH,
  name: id,
  start: hhmm(start),
  end: hhmm(new Date(start.getTime() + 8 * HOUR)),
  days: [0, 1, 2, 3, 4, 5, 6],
  createdAt: now,
  updatedAt: now,
})
// Ahmed's shift started 30 minutes ago → he will be ~30 min late. Omar's started 2 h ago and he never comes.
const lateShift = shiftStarting('late-shift', minuteFloor(run - 30 * 60_000))
const missedShift = shiftStarting('missed-shift', minuteFloor(run - 2 * HOUR))

const people: Record<
  'manager' | 'employee' | 'noShow',
  { uid: string; email: string; user: User }
> = {} as never
const session = (who: keyof typeof people): SessionUser => {
  const { uid, email, user } = people[who]
  return {
    uid,
    email,
    name: user.name,
    access: { role: user.role, branchId: BRANCH, status: 'active' },
  }
}
/**
 * Switches user. Firestore picks up a new sign-in token a moment after Auth reports it; in the
 * app users are long signed in before acting, but a test acts immediately, so it waits here.
 */
async function signInAs(who: keyof typeof people) {
  await signOut(auth)
  await signInWithEmailAndPassword(auth, people[who].email, PASSWORD)
  await auth.authStateReady()
  await new Promise((r) => setTimeout(r, 300))
}

beforeAll(async () => {
  await loadRules(readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'))
  await clearFirestore()
  const make = async (
    key: keyof typeof people,
    name: string,
    role: User['role'],
    shiftId: string | null,
  ) => {
    const email = `${key.toLowerCase()}-${run}@flow.test`
    const uid = await createLogin(email, PASSWORD)
    const user = {
      id: uid,
      branchId: BRANCH,
      role,
      status: 'active',
      name,
      email,
      phone: '',
      position: role === 'manager' ? 'Owner' : 'Barista',
      shiftId,
      hiredAt: new Date(run - 30 * 24 * HOUR),
      stats: { attendancePct: 100, performanceScore: 0, updatedAt: now },
      notes: [],
      warnings: [],
      achievements: [],
      createdAt: now,
      updatedAt: now,
    } satisfies User
    people[key] = { uid, email, user }
    const { id: _id, ...doc } = user
    await putDoc(`users/${uid}`, doc)
  }
  await make('manager', 'Hana Test', 'manager', null)
  await make('employee', 'Ahmed Test', 'employee', lateShift.id)
  await make('noShow', 'Omar Test', 'employee', missedShift.id)
  const { id: _b, ...branchDoc } = branch
  await putDoc(`branches/${BRANCH}`, branchDoc)
  for (const s of [lateShift, missedShift]) {
    const { id, ...doc } = s
    await putDoc(`shifts/${id}`, doc)
  }
})

afterAll(async () => {
  await signOut(auth)
  await deleteLogins(Object.values(people).map((p) => p.uid))
})

const notifications = async (type: string) =>
  (await listDocs('notifications')).filter((n) => n.type === type)
const activity = async (action: string) =>
  (await listDocs('activity')).filter((a) => a.action === action)

// A tiny real JPEG (1×1 px) standing in for the camera photo.
const PHOTO =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
// About 2.2 km north of the shop.
const AWAY = { lat: 25.2248, lng: 55.2708, accuracy: 25 }

describe('clock in → attendance → lateness → notification', () => {
  it('records a late clock-in with server time, location and photo, then an early clock-out', async () => {
    await signInAs('employee')
    const ctx = { me: people.employee.user, shifts: [lateShift, missedShift], rota: [], branch }
    const capture = { location: AWAY, photo: PHOTO }
    const result = await clockIn(ctx, session('employee'), capture)

    expect(result.status).toBe('late')
    expect(result.lateMinutes).toBeGreaterThanOrEqual(30)
    expect(result.lateMinutes).toBeLessThanOrEqual(31)

    const id = result.id
    const saved = await getDoc(`attendance/${id}`)
    expect(saved).toMatchObject({ status: 'late', source: 'web', employeeId: people.employee.uid })
    const clockInAt = saved?.clockInAt
    expect(clockInAt).toBeInstanceOf(Date)
    expect(Math.abs((clockInAt as Date).getTime() - Date.now())).toBeLessThan(60_000) // server time ≈ now

    const late = await notifications('late_arrival')
    expect(late).toHaveLength(1)
    expect(late[0]?.body).toMatch(/Ahmed Test arrived 3[01] minutes late/)
    expect(await activity('clock_in')).toHaveLength(1)
    expect(saved).toMatchObject({ photo: true, clockInLocation: { inside: false } })
    const location = saved?.clockInLocation as { distance: number } | undefined
    expect(location?.distance).toBeGreaterThan(2000)
    expect((await getDoc(`attendancePhotos/${id}`))?.image).toBe(PHOTO)
    const away = await notifications('clock_in_away')
    expect(away[0]?.body).toMatch(/Ahmed Test clocked in 2\.\d km from the shop/)

    await expect(clockIn(ctx, session('employee'), capture)).rejects.toThrow(/already clocked in/)

    // The 8-hour shift started ~30 min ago, so clocking out now is ~7.5 h early.
    const left = await clockOut(result, branch, session('employee'), {
      location: null,
      reason: 'Feeling unwell',
    })
    expect(left.earlyLeaveMinutes).toBeGreaterThan(440)
    const out = await getDoc(`attendance/${id}`)
    expect(out?.clockOutAt).toBeInstanceOf(Date)
    expect(out).toMatchObject({ workedMinutes: 0, earlyLeaveReason: 'Feeling unwell' })
    expect(out?.earlyLeaveMinutes).toBe(left.earlyLeaveMinutes)
    const early = await notifications('early_leave')
    expect(early[0]?.body).toMatch(
      /Ahmed Test clocked out 7h \d+m before the shift ended \(Feeling unwell\)/,
    )
  })
})

describe('no clock-in → automatic absence', () => {
  it('marks missed shifts once, and notifies only for the recent one', async () => {
    await signInAs('manager')
    const input = {
      branch,
      shifts: [lateShift, missedShift],
      employees: [people.employee.user, people.noShow.user],
    }
    const marked = await markAbsences(input, session('manager'))
    expect(marked).toBeGreaterThan(0)

    const today = toDateKey(new Date(run - 2 * HOUR), 'UTC')
    expect(await getDoc(`attendance/${recordId(people.noShow.uid, today)}`)).toMatchObject({
      status: 'absent',
      source: 'system',
    })
    // Ahmed clocked in today, so today's record stays his clock-in.
    expect(
      (
        await getDoc(
          `attendance/${recordId(people.employee.uid, toDateKey(new Date(run - 30 * 60_000), 'UTC'))}`,
        )
      )?.status,
    ).toBe('late')

    const absences = await notifications('absence')
    expect(absences).toHaveLength(1) // older catch-ups are recorded silently
    expect(absences[0]?.body).toContain('Omar Test')

    expect(await markAbsences(input, session('manager'))).toBe(0) // idempotent
  })
})

describe('stock update → status → movement → alert only when worse', () => {
  it('goes in stock → low → critical → in stock, logs every change and alerts only when worse', async () => {
    await signInAs('manager')
    await createItem(
      {
        name: 'Oat Milk',
        category: 'Dairy',
        unit: 'L',
        quantity: 20,
        minQuantity: 15,
        supplierId: null,
      },
      null,
      branch,
      session('manager'),
    )
    const item = (await listDocs('inventoryItems'))[0] as { id: string; status: string }
    expect(item.status).toBe('in_stock')

    // Minimum 15 L, critical ratio 50 % → Low below 15 L, Critical at or below 7.5 L.
    const steps = [
      [{ mode: 'remove', amount: 8 }, 'usage', 12, 'low'], // worse → alert
      [{ mode: 'remove', amount: 5 }, 'usage', 7, 'critical'], // worse → alert
      [{ mode: 'remove', amount: 1 }, 'usage', 6, 'critical'], // same → no alert
      [{ mode: 'remove', amount: 100 }, 'waste', 0, 'critical'], // never below 0; same → no alert
      [{ mode: 'add', amount: 20 }, 'delivery', 20, 'in_stock'], // better → no alert
    ] as const
    for (const [change, reason, quantity, status] of steps) {
      expect(await adjustStock(item.id, change, reason, branch, session('manager'))).toEqual({
        quantity,
        status,
      })
    }

    expect(await getDoc(`inventoryItems/${item.id}`)).toMatchObject({
      quantity: 20,
      status: 'in_stock',
    })
    expect(await listDocs('stockMovements')).toHaveLength(6) // initial count + 5 changes
    expect(await notifications('stock_low')).toHaveLength(1)
    expect(await notifications('stock_critical')).toHaveLength(1) // not repeated while already critical
  })
})

describe('deadline passes → overdue → completed', () => {
  it('marks only past-deadline open tasks overdue, once; the employee can still complete it', async () => {
    const task = (id: string, deadline: Date) =>
      putDoc(`tasks/${id}`, {
        branchId: BRANCH,
        title: id === 'past' ? 'Clean espresso machine' : 'Restock cups',
        description: '',
        category: 'Cleaning',
        assigneeId: people.employee.uid,
        assigneeName: people.employee.user.name,
        priority: 'high',
        deadline,
        status: 'pending',
        completedAt: null,
        createdBy: people.manager.uid,
        createdAt: now,
        updatedAt: now,
      })
    await task('past', new Date(run - HOUR))
    await task('future', new Date(run + HOUR))

    await signInAs('manager')
    expect(await markOverdueTasks(branch, session('manager'))).toBe(1)
    expect((await getDoc('tasks/past'))?.status).toBe('overdue')
    expect((await getDoc('tasks/future'))?.status).toBe('pending')
    expect(await notifications('task_overdue')).toHaveLength(1)
    expect(await markOverdueTasks(branch, session('manager'))).toBe(0)

    await signInAs('employee')
    const past = { id: 'past', ...(await getDoc('tasks/past')) } as Task
    await moveTask(past, 'completed', branch, session('employee'))
    const done = await getDoc('tasks/past')
    expect(done?.status).toBe('completed')
    expect(done?.completedAt).toBeInstanceOf(Date)
    const completed = await notifications('task_completed')
    expect(completed).toHaveLength(1)
    expect(completed[0]?.body).toContain('Ahmed Test completed')
  })
})

describe('leave request → approval → attendance → pay', () => {
  it('pays leave up to the balance, marks the days, notifies, and deducts the rest', async () => {
    // Omar gets 1 day of annual leave and a salary of AED 3,000 (AED 100 a day).
    await signInAs('manager')
    await savePayAndLeave(
      people.noShow.user,
      { salary: 3000, allowances: 0, leaveAllowances: { annual: 1 } },
      session('manager'),
    )
    const omar = { ...people.noShow.user, salary: 3000, leaveAllowances: { annual: 1 } }

    await signInAs('noShow')
    const ctx = { me: omar, shift: missedShift, branch }
    await requestLeave(
      { typeId: 'annual', from: '2099-12-01', to: '2099-12-03', reason: 'Family visit' },
      ctx,
      session('noShow'),
    )
    expect((await notifications('leave_requested'))[0]?.body).toContain(
      'Omar Test asked for annual leave',
    )

    await signInAs('manager')
    const [request] = await listBranchLeave(BRANCH)
    expect(request).toMatchObject({
      status: 'pending',
      dates: ['2099-12-01', '2099-12-02', '2099-12-03'],
    })
    await decideLeave(
      {
        request: request!,
        approve: true,
        comment: 'Enjoy',
        employee: omar,
        shift: missedShift,
        history: [request!],
      },
      branch,
      session('manager'),
    )

    expect(await getDoc(`leaveRequests/${request!.id}`)).toMatchObject({
      status: 'approved',
      paidDays: 1,
    })
    const days = await Promise.all(
      request!.dates.map((d) => getDoc(`attendance/${recordId(people.noShow.uid, d)}`)),
    )
    expect(days.map((d) => [d?.status, d?.leavePaid])).toEqual([
      ['leave', true],
      ['leave', false],
      ['leave', false],
    ])
    const decided = await notifications('leave_decided')
    expect(decided[0]).toMatchObject({ recipientId: people.noShow.uid })
    expect(decided[0]?.body).toMatch(/approved \(2 days unpaid\)\. Enjoy/)

    const facts = payFacts(days.map((d) => d as { status: string; leavePaid?: boolean }))
    expect(monthlyPay(3000, facts.unpaidLeaveDays, facts.absentDays)).toMatchObject({
      deduction: 200,
      net: 2800,
    })
  })
})

describe('documents: compress → store in pieces → open', () => {
  it('stores a compressible PDF small, an incompressible file in pieces, and gives both back exactly', async () => {
    await signInAs('manager')
    const text = new TextEncoder().encode('%PDF-1.4 trade license '.repeat(60_000)) // ≈ 1.4 MB
    // Random bytes don't compress (getRandomValues fills at most 64 kB per call).
    const random = new Uint8Array(1_600_000)
    for (let i = 0; i < random.length; i += 65_536)
      crypto.getRandomValues(random.subarray(i, i + 65_536))

    const pdf = new File([text], 'license.pdf', { type: 'application/pdf' })
    const blob = new File([random], 'scan.bin', { type: 'application/octet-stream' })
    const small = await uploadDocument(
      {
        file: pdf,
        name: 'Trade license',
        category: 'License',
        note: '',
        expiresOn: null,
        remindDaysBefore: 30,
        employeeId: null,
        employeeName: null,
      },
      session('manager'),
    )
    expect(small.storedSize).toBeLessThan(small.originalSize / 10)
    await uploadDocument(
      {
        file: blob,
        name: 'Scan',
        category: 'Other',
        note: '',
        expiresOn: null,
        remindDaysBefore: 30,
        employeeId: null,
        employeeName: null,
      },
      session('manager'),
    )

    const docs = await listDocuments(BRANCH)
    const license = docs.find((d) => d.name === 'Trade license')!
    const scan = docs.find((d) => d.name === 'Scan')!
    expect(license).toMatchObject({ encoding: 'gzip', chunkCount: 1, fileName: 'license.pdf' })
    expect(scan.chunkCount).toBe(3) // 1.6 MB in 750 kB pieces

    expect(new Uint8Array(await (await loadDocumentFile(license)).arrayBuffer())).toEqual(text)
    expect(new Uint8Array(await (await loadDocumentFile(scan)).arrayBuffer())).toEqual(random)

    await deleteDocument(scan, session('manager'))
    expect((await listDocuments(BRANCH)).map((d) => d.name)).toEqual(['Trade license'])
    expect(await getDoc(`documentChunks/${scan.id}_0`)).toBeNull()
  })
})

describe('document expiry → reminders', () => {
  it('reminds once inside the window, again when expired, and starts over when renewed', async () => {
    await signInAs('manager')
    const day = (offset: number) => toDateKey(new Date(Date.now() + offset * 86_400_000), 'UTC')
    const file = new File([new TextEncoder().encode('license')], 'license.txt', {
      type: 'text/plain',
    })
    await uploadDocument(
      {
        file,
        name: 'Food permit',
        category: 'License',
        note: '',
        expiresOn: day(10),
        remindDaysBefore: 30,
        employeeId: null,
        employeeName: null,
      },
      session('manager'),
    )
    const permit = () => listDocuments(BRANCH).then((d) => d.find((x) => x.name === 'Food permit')!)

    expect(await checkDocumentExpiry(branch, session('manager'))).toBe(1)
    expect(await checkDocumentExpiry(branch, session('manager'))).toBe(0) // not repeated
    expect((await notifications('document_expiry'))[0]?.body).toMatch(/Food permit expires on/)

    const current = await permit()
    const details = {
      name: current.name,
      category: current.category,
      note: '',
      remindDaysBefore: 30,
      employeeId: null,
      employeeName: null,
    }
    await updateDocumentDetails(current, { ...details, expiresOn: day(-1) }, session('manager'))
    expect(await checkDocumentExpiry(branch, session('manager'))).toBe(1)
    expect((await notifications('document_expiry')).map((n) => n.title)).toContain(
      'Document expired',
    )

    // Renewed for a year: valid again, no reminder yet.
    await updateDocumentDetails(
      await permit(),
      { ...details, expiresOn: day(365) },
      session('manager'),
    )
    expect(await checkDocumentExpiry(branch, session('manager'))).toBe(0)
  })
})

describe('employee documents', () => {
  it('links a visa to the employee and names them in the reminder', async () => {
    await signInAs('manager')
    const soon = toDateKey(new Date(Date.now() + 5 * 86_400_000), 'UTC')
    await uploadDocument(
      {
        file: new File([new TextEncoder().encode('visa')], 'visa.pdf', { type: 'application/pdf' }),
        name: 'Visa',
        category: 'Visa',
        note: '',
        expiresOn: soon,
        remindDaysBefore: 30,
        employeeId: people.employee.uid,
        employeeName: 'Ahmed Test',
      },
      session('manager'),
    )
    const visa = (await listDocuments(BRANCH)).find((d) => d.name === 'Visa')
    expect(visa).toMatchObject({ employeeId: people.employee.uid, employeeName: 'Ahmed Test' })
    await checkDocumentExpiry(branch, session('manager'))
    const bodies = (await notifications('document_expiry')).map((n) => n.body)
    expect(bodies).toContainEqual(expect.stringMatching(/^Ahmed Test's Visa expires on/))
  })
})

describe('payslip → paid → employee sees it', () => {
  it('saves the month with deductions and bonus, marks it paid, and shows it only to the employee', async () => {
    await signInAs('manager')
    const omar = { ...people.noShow.user, salary: 3000, allowances: 500 }
    const month = '2099-12'
    // Two unpaid leave days from the leave flow above (2099-12-02, 03).
    const records = await Promise.all(
      ['2099-12-01', '2099-12-02', '2099-12-03'].map(async (d) => ({
        id: recordId(omar.id, d),
        ...(await getDoc(`attendance/${recordId(omar.id, d)}`)),
      })),
    )
    const extras = {
      bonus: 100,
      otherDeductions: 50,
      deductionNote: 'Advance',
      paymentMethod: 'WPS' as const,
      paymentRef: 'SIF-2099-12',
    }
    await savePayslip(
      { employee: omar, month, records: records as never, extras, existing: null, paid: true },
      session('manager'),
    )
    const saved = await getDoc(`payslips/${omar.id}_${month}`)
    expect(saved).toMatchObject({
      status: 'paid',
      leaveDeduction: 200, // 2 unpaid days × AED 100
      gross: 3600, // 3,000 + 500 + 100 bonus
      net: 3350, // − 200 − 50
    })

    await signInAs('noShow')
    expect((await listMyPayslips(omar.id)).map((s) => s.month)).toEqual([month])
  })
})
