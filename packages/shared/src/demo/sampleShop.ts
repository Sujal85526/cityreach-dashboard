/**
 * The demo café ("Downtown"): staff, shifts, two weeks of attendance, suppliers, stock and
 * tasks. Used by the emulator seed (tools/seed.ts) and by Settings → "Load sample data" on a
 * real project, so both show the same shop. Pure: returns documents, writes nothing.
 */
import { COLLECTIONS } from '../constants/collections'
import { DEFAULT_PERFORMANCE_WEIGHTS, performanceScore } from '../rules/performance'
import { classifyClockIn, workedMinutes, type AttendanceStatus } from '../rules/attendance'
import { stockStatus } from '../rules/inventory'
import type { TaskPriority, TaskStatus } from '../rules/tasks'
import { toDateKey, zonedDateTime } from '../rules/time'

const DAY_MS = 86_400_000
const HISTORY_DAYS = 14
const WORK_DAYS = [1, 2, 3, 4, 5, 6] // Mon–Sat

const SHIFTS = [
  { id: 'morning', name: 'Morning', start: '07:00', end: '15:00' },
  { id: 'evening', name: 'Evening', start: '15:00', end: '23:00' },
  { id: 'night', name: 'Night', start: '23:00', end: '07:00' },
] as const
type ShiftKey = (typeof SHIFTS)[number]['id']

interface Person {
  key: string
  name: string
  position: string
  shift: ShiftKey
  status: 'active' | 'on_leave'
  /** Minutes late today (negative = early); null = no clock-in today. */
  todayOffset: number | null
  lateRate: number
  absentRate: number
}

export const SAMPLE_PEOPLE: Person[] = [
  {
    key: 'ahmed',
    name: 'Ahmed Hassan',
    position: 'Barista',
    shift: 'morning',
    status: 'active',
    todayOffset: 18,
    lateRate: 0.1,
    absentRate: 0.02,
  },
  {
    key: 'sara',
    name: 'Sara Mostafa',
    position: 'Shift Lead',
    shift: 'morning',
    status: 'active',
    todayOffset: -8,
    lateRate: 0.02,
    absentRate: 0,
  },
  {
    key: 'omar',
    name: 'Omar Khaled',
    position: 'Barista',
    shift: 'evening',
    status: 'active',
    todayOffset: 3,
    lateRate: 0.2,
    absentRate: 0.06,
  },
  {
    key: 'nour',
    name: 'Nour El-Din',
    position: 'Cashier',
    shift: 'morning',
    status: 'on_leave',
    todayOffset: null,
    lateRate: 0.08,
    absentRate: 0.04,
  },
  {
    key: 'layla',
    name: 'Layla Ibrahim',
    position: 'Barista',
    shift: 'evening',
    status: 'active',
    todayOffset: 0,
    lateRate: 0.05,
    absentRate: 0.03,
  },
  {
    key: 'youssef',
    name: 'Youssef Adel',
    position: 'Cleaner',
    shift: 'night',
    status: 'active',
    todayOffset: null,
    lateRate: 0.25,
    absentRate: 0.12,
  },
  {
    key: 'mariam',
    name: 'Mariam Fathy',
    position: 'Cashier',
    shift: 'evening',
    status: 'active',
    todayOffset: 11,
    lateRate: 0.08,
    absentRate: 0.02,
  },
  {
    key: 'karim',
    name: 'Karim Tarek',
    position: 'Barista',
    shift: 'morning',
    status: 'active',
    todayOffset: -2,
    lateRate: 0.15,
    absentRate: 0.05,
  },
]

const SUPPLIERS = [
  { key: 'green-valley', name: 'Green Valley', contactName: 'Mona Adel', categories: ['Dairy'] },
  {
    key: 'andes-roasters',
    name: 'Andes Roasters',
    contactName: 'Tarek Samy',
    categories: ['Coffee'],
  },
  { key: 'packpro', name: 'PackPro', contactName: 'Hossam Ali', categories: ['Packaging'] },
  {
    key: 'sweetline',
    name: 'Sweetline',
    contactName: 'Dina Farouk',
    categories: ['Syrups', 'Toppings'],
  },
]

const ITEMS: [
  name: string,
  category: string,
  unit: string,
  qty: number,
  min: number,
  supplier: string,
][] = [
  ['Whole Milk', 'Dairy', 'L', 6, 20, 'green-valley'],
  ['Oat Milk', 'Dairy', 'L', 14, 15, 'green-valley'],
  ['Espresso Beans — House Blend', 'Coffee', 'kg', 32, 10, 'andes-roasters'],
  ['Espresso Beans — Single Origin', 'Coffee', 'kg', 8, 5, 'andes-roasters'],
  ['12oz Paper Cups', 'Packaging', 'pcs', 240, 500, 'packpro'],
  ['16oz Paper Cups', 'Packaging', 'pcs', 780, 500, 'packpro'],
  ['Vanilla Syrup', 'Syrups', 'btl', 4, 6, 'sweetline'],
  ['Caramel Syrup', 'Syrups', 'btl', 9, 6, 'sweetline'],
  ['Chocolate Powder', 'Toppings', 'kg', 2, 4, 'sweetline'],
  ['Napkins', 'Packaging', 'pcs', 1200, 500, 'packpro'],
]

const TASKS: [
  title: string,
  description: string,
  category: string,
  assignee: string,
  priority: TaskPriority,
  dueTime: string,
  dayOffset: number,
  status: TaskStatus,
][] = [
  [
    'Update evening pastry display',
    'Rotate pastries and mark down day-old items.',
    'Service',
    'omar',
    'medium',
    '17:00',
    0,
    'pending',
  ],
  [
    'Weekly cash drawer audit',
    'Reconcile drawer totals against POS report.',
    'Finance',
    'mariam',
    'medium',
    '10:00',
    1,
    'pending',
  ],
  [
    'Post evening social update',
    "Photo of today's specials to Instagram.",
    'Marketing',
    'layla',
    'low',
    '19:00',
    0,
    'pending',
  ],
  [
    'Deep clean espresso machines',
    'Full backflush and group-head cleaning on both machines.',
    'Cleaning',
    'sara',
    'high',
    '14:00',
    0,
    'in_progress',
  ],
  [
    'Train new hire on POS',
    'Walk-through of order taking and refunds.',
    'Training',
    'sara',
    'medium',
    '16:00',
    0,
    'in_progress',
  ],
  [
    'Restock milk fridge',
    'Move new milk delivery into the front-of-house fridge.',
    'Inventory',
    'ahmed',
    'high',
    '09:00',
    0,
    'completed',
  ],
  [
    'Onboard new supplier order',
    'Verify oat milk delivery from Green Valley.',
    'Inventory',
    'karim',
    'low',
    '08:00',
    0,
    'completed',
  ],
  [
    'Sanitize bathrooms',
    'Full sanitization checklist, restock supplies.',
    'Cleaning',
    'youssef',
    'high',
    '23:00',
    -1,
    'overdue',
  ],
]

export interface SampleDoc {
  collection: string
  id: string
  data: Record<string, unknown>
}

export interface SampleShopOptions {
  branchId: string
  /** The manager the sample records are attributed to (task creator, stock movements). */
  manager: { uid: string; name: string }
  now: Date
  timeZone: string
  criticalRatio: number
  /** Added to every id (e.g. "sample-") so sample records can't clash with real ones. */
  idPrefix: string
  /** Email domain for the sample staff profiles (they have no logins unless the seed creates them). */
  emailDomain: string
  /** true → every document gets `sample: true`, so "Remove sample data" can find exactly these. */
  tag: boolean
}

/** Every document of the sample café, ready to write (instants are `Date`s). */
export function buildSampleShop(o: SampleShopOptions): SampleDoc[] {
  const docs: SampleDoc[] = []
  const tag = o.tag ? { sample: true } : {}
  const put = (collection: string, id: string, data: Record<string, unknown>) =>
    docs.push({ collection, id: `${o.idPrefix}${id}`, data: { ...data, ...tag } })
  const uid = (key: string) => `${o.idPrefix}${key}`
  const stamp = { createdAt: o.now, updatedAt: o.now }
  const dateKeyDaysAgo = (days: number) =>
    toDateKey(new Date(o.now.getTime() - days * DAY_MS), o.timeZone)
  const later = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000)

  // Deterministic pseudo-random numbers so every load produces the same history.
  let state = 42
  const rand = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }

  for (const s of SHIFTS)
    put(COLLECTIONS.shifts, s.id, {
      branchId: o.branchId,
      name: s.name,
      start: s.start,
      end: s.end,
      days: WORK_DAYS,
      ...stamp,
    })

  const today = toDateKey(o.now, o.timeZone)
  for (const p of SAMPLE_PEOPLE) {
    const shift = SHIFTS.find((s) => s.id === p.shift) ?? SHIFTS[0]
    const rows: { status: AttendanceStatus }[] = []
    for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo--) {
      const dateKey = daysAgo === 0 ? today : dateKeyDaysAgo(daysAgo)
      const start = zonedDateTime(dateKey, shift.start, o.timeZone)
      if (!WORK_DAYS.includes(new Date(`${dateKey}T12:00:00Z`).getUTCDay()) || start > o.now)
        continue

      let status: AttendanceStatus
      let clockInAt: Date | null = null
      let lateMinutes = 0
      if (daysAgo === 0) {
        if (p.status === 'on_leave') status = 'leave'
        else if (p.todayOffset === null) {
          if (o.now.getTime() - start.getTime() < 60 * 60_000) continue // still inside the absence window
          status = 'absent'
        } else {
          clockInAt = later(start, p.todayOffset)
          if (clockInAt > o.now) continue
          ;({ status, lateMinutes } = classifyClockIn(start, clockInAt, { graceMinutes: 5 }))
        }
      } else if (rand() < p.absentRate) status = 'absent'
      else {
        clockInAt = later(
          start,
          rand() < p.lateRate ? 6 + Math.floor(rand() * 25) : -Math.floor(rand() * 10),
        )
        ;({ status, lateMinutes } = classifyClockIn(start, clockInAt, { graceMinutes: 5 }))
      }

      // Night shift ends the next morning.
      const endDay =
        shift.end < shift.start
          ? toDateKey(new Date(start.getTime() + DAY_MS), o.timeZone)
          : dateKey
      const end = zonedDateTime(endDay, shift.end, o.timeZone)
      const clockOutAt = clockInAt && end <= o.now ? later(end, Math.floor(rand() * 8)) : null
      rows.push({ status })
      put(COLLECTIONS.attendance, `${p.key}_${dateKey}`, {
        branchId: o.branchId,
        employeeId: uid(p.key),
        employeeName: p.name,
        dateKey,
        shiftId: uid(shift.id),
        shiftStart: shift.start,
        shiftEnd: shift.end,
        shiftStartAt: start,
        clockInAt,
        clockOutAt,
        workedMinutes: clockInAt && clockOutAt ? workedMinutes(clockInAt, clockOutAt) : null,
        lateMinutes,
        status,
        source: status === 'leave' ? 'manager' : status === 'absent' ? 'system' : 'web',
        correctedBy: null,
        createdAt: clockInAt ?? start,
        updatedAt: clockOutAt ?? clockInAt ?? start,
      })
    }

    const count = (...s: AttendanceStatus[]) => rows.filter((r) => s.includes(r.status)).length
    const scheduled = count('on_time', 'late', 'absent')
    const attended = count('on_time', 'late')
    const { score } = performanceScore(
      {
        scheduledShifts: scheduled,
        attendedShifts: attended,
        onTimeShifts: count('on_time'),
        tasksAssigned: 10,
        tasksCompleted: Math.max(5, Math.round(10 - p.lateRate * 12 - p.absentRate * 20)),
        managerRating: null,
      },
      DEFAULT_PERFORMANCE_WEIGHTS,
    )
    put(COLLECTIONS.users, p.key, {
      branchId: o.branchId,
      role: 'employee',
      status: p.status,
      name: p.name,
      email: `${p.key}@${o.emailDomain}`,
      phone: '',
      position: p.position,
      shiftId: uid(p.shift),
      hiredAt: new Date('2025-03-01T00:00:00Z'),
      stats: {
        attendancePct: scheduled ? Math.round((attended / scheduled) * 100) : 100,
        performanceScore: score,
        updatedAt: o.now,
      },
      notes: [],
      warnings: [],
      achievements: [],
      ...stamp,
    })
  }

  for (const s of SUPPLIERS)
    put(COLLECTIONS.suppliers, s.key, {
      branchId: o.branchId,
      name: s.name,
      contactName: s.contactName,
      phone: '',
      email: '',
      categories: s.categories,
      ...stamp,
    })

  const supplierName = (key: string) => SUPPLIERS.find((s) => s.key === key)?.name ?? null
  ITEMS.forEach(([name, category, unit, quantity, minQuantity, supplier], i) => {
    const updatedAt = new Date(o.now.getTime() - (i + 1) * 3_600_000)
    put(COLLECTIONS.inventoryItems, `item-${i + 1}`, {
      branchId: o.branchId,
      name,
      category,
      unit,
      quantity,
      minQuantity,
      supplierId: uid(supplier),
      supplierName: supplierName(supplier),
      status: stockStatus(quantity, minQuantity, o.criticalRatio),
      createdAt: updatedAt,
      updatedAt,
    })
    put(COLLECTIONS.stockMovements, `movement-${i + 1}`, {
      branchId: o.branchId,
      itemId: uid(`item-${i + 1}`),
      itemName: name,
      delta: quantity,
      quantityAfter: quantity,
      reason: 'correction',
      by: o.manager.uid,
      byName: o.manager.name,
      createdAt: updatedAt,
    })
  })

  const personName = (key: string) => SAMPLE_PEOPLE.find((p) => p.key === key)?.name ?? key
  TASKS.forEach(
    ([title, description, category, assignee, priority, dueTime, dayOffset, status], i) => {
      const deadline = zonedDateTime(dateKeyDaysAgo(-dayOffset), dueTime, o.timeZone)
      put(COLLECTIONS.tasks, `task-${i + 1}`, {
        branchId: o.branchId,
        title,
        description,
        category,
        assigneeId: uid(assignee),
        assigneeName: personName(assignee),
        priority,
        deadline,
        status,
        completedAt: status === 'completed' ? later(deadline, -30) : null,
        createdBy: o.manager.uid,
        ...stamp,
      })
    },
  )

  return docs
}
