/**
 * The demo team's records: staff, shifts, rota, attendance, leave, suppliers, stock with its
 * movement history, tasks, weekly performance snapshots and payslips. Everything is generated
 * relative to `now`, so the shop always looks current. Used by the in-memory demo seed
 * (apps/web/src/lib/store/seed). Pure: returns documents, writes nothing.
 */
import { COLLECTIONS } from '../constants/collections'
import { classifyClockIn, workedMinutes, type AttendanceStatus } from '../rules/attendance'
import { addDays } from '../rules/expiry'
import { stockStatus } from '../rules/inventory'
import { payFacts } from '../rules/leave'
import { overtimeMinutes, payslipTotals } from '../rules/payroll'
import { lastWeeks, weekRange } from '../rules/periods'
import {
  DEFAULT_PERFORMANCE_WEIGHTS,
  performanceScore,
  periodFacts,
  type PeriodFacts,
} from '../rules/performance'
import { shiftEndFrom } from '../rules/shifts'
import type { TaskPriority, TaskStatus } from '../rules/tasks'
import { toDateKey, zonedDateTime } from '../rules/time'
import {
  leaveDates,
  plannedShiftKey,
  rotaOverride,
  SAMPLE_LEAVES,
  SAMPLE_PEOPLE,
  SHIFTS,
  WORK_DAYS,
  type Person,
  type ShiftKey,
} from './people'

export { SAMPLE_LEAVES, SAMPLE_PEOPLE, plannedShiftKey, rotaOverride } from './people'
export type { Person, SampleLeave, ShiftKey } from './people'

const DAY_MS = 86_400_000
const MIN_MS = 60_000
/** The shop's location, for the clock-in checks. */
const SHOP = { lat: 53.4808, lng: -2.2426 }

const SUPPLIERS = [
  {
    key: 'green-valley',
    name: 'Green Valley Dairy',
    contactName: 'Grace Whitfield',
    phone: '+44 161 555 0191',
    email: 'orders@greenvalleydairy.example',
    categories: ['Dairy'],
  },
  {
    key: 'northern-roast',
    name: 'Northern Roast Co.',
    contactName: 'Marco Bellini',
    phone: '+44 161 555 0132',
    email: 'trade@northernroast.example',
    categories: ['Beverages'],
  },
  {
    key: 'packpro',
    name: 'PackPro Supplies',
    contactName: 'Ian Fraser',
    phone: '+44 161 555 0177',
    email: 'sales@packpro.example',
    categories: ['Packaging'],
  },
  {
    key: 'sweetline',
    name: 'Sweetline Syrups',
    contactName: 'Chloe Barnes',
    phone: '+44 161 555 0165',
    email: 'hello@sweetline.example',
    categories: ['Syrups', 'Toppings'],
  },
  {
    key: 'albion-bakehouse',
    name: 'Albion Bakehouse',
    contactName: 'Tom Hargreaves',
    phone: '+44 161 555 0108',
    email: 'wholesale@albionbakehouse.example',
    categories: ['Bakery'],
  },
  {
    key: 'cleanco',
    name: 'CleanCo Trade',
    contactName: 'Priti Shah',
    phone: '+44 161 555 0149',
    email: 'accounts@cleanco.example',
    categories: ['Cleaning'],
  },
]

/** name, category, unit, quantity, minimum, supplier. Two low, one critical, the rest comfortable. */
const ITEMS: [string, string, string, number, number, string][] = [
  ['Whole Milk', 'Dairy', 'L', 38, 30, 'green-valley'],
  ['Oat Milk', 'Dairy', 'L', 9, 15, 'green-valley'],
  ['Espresso Beans — House Blend', 'Beverages', 'kg', 24, 10, 'northern-roast'],
  ['Espresso Beans — Single Origin', 'Beverages', 'kg', 9, 5, 'northern-roast'],
  ['English Breakfast Tea', 'Beverages', 'box', 14, 6, 'northern-roast'],
  ['Hot Chocolate Powder', 'Beverages', 'kg', 8, 5, 'northern-roast'],
  ['8oz Paper Cups', 'Packaging', 'pcs', 900, 600, 'packpro'],
  ['12oz Paper Cups', 'Packaging', 'pcs', 480, 600, 'packpro'],
  ['16oz Paper Cups', 'Packaging', 'pcs', 1350, 600, 'packpro'],
  ['Cup Lids', 'Packaging', 'pcs', 1800, 1000, 'packpro'],
  ['Napkins', 'Packaging', 'pcs', 2400, 1000, 'packpro'],
  ['Vanilla Syrup', 'Syrups', 'btl', 2, 6, 'sweetline'],
  ['Caramel Syrup', 'Syrups', 'btl', 9, 6, 'sweetline'],
  ['Butter Croissants', 'Bakery', 'pcs', 48, 30, 'albion-bakehouse'],
  ['Sourdough Loaves', 'Bakery', 'pcs', 16, 10, 'albion-bakehouse'],
  ['Blueberry Muffins', 'Bakery', 'pcs', 24, 12, 'albion-bakehouse'],
  ['Anti-bacterial Sanitiser', 'Cleaning', 'btl', 11, 6, 'cleanco'],
  ['Paper Towels', 'Cleaning', 'roll', 40, 20, 'cleanco'],
]

type TaskRow = [
  title: string,
  description: string,
  category: string,
  assignee: string,
  priority: TaskPriority,
]

/** Older, completed work that feeds the performance history (not shown on the board). */
const HISTORY_TASKS: Record<string, [string, string][]> = {
  barista: [
    ['Deep clean the grinder', 'Cleaning'],
    ['Weekly dry-stock count', 'Inventory'],
    ['Clean and descale the milk jugs', 'Cleaning'],
    ['Update the specials chalkboard', 'Marketing'],
    ['Date-check the fridge', 'Inventory'],
    ['Photograph the new seasonal menu', 'Marketing'],
  ],
  cashier: [
    ['Reconcile the weekly till takings', 'Finance'],
    ['File supplier invoices', 'Finance'],
    ['Restock the condiment station', 'Service'],
    ['Run a refund walkthrough with a new starter', 'Training'],
    ['Check the pastry display labels', 'Service'],
    ['Count and bank the cash float', 'Finance'],
  ],
  lead: [
    ['Run the Monday team briefing', 'Training'],
    ['Check the allergen folder is up to date', 'Service'],
    ['Walk the opening checklist with a new starter', 'Training'],
    ['Review next week’s rota', 'Service'],
    ['Rotate stock in the walk-in', 'Inventory'],
    ['Reset the front-of-house layout', 'Service'],
  ],
  cleaner: [
    ['Clean the extraction fans', 'Cleaning'],
    ['Sanitise the customer seating area', 'Cleaning'],
    ['Wash down the back-of-house floor', 'Cleaning'],
    ['Deep clean the storeroom shelves', 'Cleaning'],
    ['Clean behind the fridges', 'Cleaning'],
    ['Polish the front windows', 'Cleaning'],
  ],
}

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

interface AttRow {
  employeeId: string
  dateKey: string
  status: AttendanceStatus
  lateMinutes: number
  workedMinutes: number | null
  shiftStart: string | null
  shiftEnd: string | null
}
interface TaskRecord {
  assigneeId: string
  deadline: Date
  status: TaskStatus
  completedAt: Date | null
}

/** A small coloured avatar with initials, standing in for the live clock-in photo. */
function avatarPhoto(name: string, hue: number): string {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="hsl(${hue},38%,42%)"/><text x="48" y="60" font-size="36" text-anchor="middle" fill="#fff" font-family="sans-serif">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const money = (n: number) => Math.round(n * 100) / 100

/** Every document of the demo team, ready to write (instants are `Date`s). */
export function buildSampleShop(o: SampleShopOptions): SampleDoc[] {
  const docs: SampleDoc[] = []
  const tag = o.tag ? { sample: true } : {}
  const put = (collection: string, id: string, data: Record<string, unknown>) =>
    docs.push({ collection, id: `${o.idPrefix}${id}`, data: { ...data, ...tag } })
  const uid = (key: string) => `${o.idPrefix}${key}`
  const tz = o.timeZone
  const now = o.now
  const today = toDateKey(now, tz)
  const stamp = { createdAt: now, updatedAt: now }
  const later = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN_MS)
  const fromNow = (minutes: number) => later(now, minutes)
  const at = (days: number, time: string) => zonedDateTime(addDays(today, days), time, tz)
  const dateKeyOf = (d: Date) => toDateKey(d, tz)
  const daysAgoOf = (dateKey: string) =>
    Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dateKey}T00:00:00Z`)) / DAY_MS)

  // Deterministic pseudo-random numbers so every load produces the same history.
  let state = 42
  const rand = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }

  // ---- Shifts ----
  for (const s of SHIFTS)
    put(COLLECTIONS.shifts, s.id, {
      branchId: o.branchId,
      name: s.name,
      start: s.start,
      end: s.end,
      days: WORK_DAYS,
      ...stamp,
    })
  const shiftOf = (key: ShiftKey) => SHIFTS.find((s) => s.id === key) ?? SHIFTS[0]

  // ---- History window: 8 trend weeks and the whole of last month, whichever reaches further back ----
  const trendWeeks = lastWeeks(today, 8)
  const firstOfLastMonth = addDays(`${today.slice(0, 8)}01`, -1).slice(0, 8) + '01'
  const monday = weekRange(trendWeeks[0] ?? '').from
  const historyStart = monday < firstOfLastMonth ? monday : firstOfLastMonth

  const attRows: AttRow[] = []
  const taskRows: TaskRecord[] = []
  const hiredKey = (p: Person) => (typeof p.hired === 'number' ? addDays(today, -p.hired) : p.hired)

  // ---- Leave: approved and pending requests, and the attendance days an approved one marks ----
  const leaveByDay = new Map<string, (typeof SAMPLE_LEAVES)[number]>()
  // Whoever is rostered today and first in line is the one currently away, so the dashboard
  // shows someone on leave on any day of the week.
  const awayKey =
    ['priya', 'jamal', 'noah', 'sofia', 'ella', 'liam'].find((k) => {
      const p = SAMPLE_PEOPLE.find((x) => x.key === k)
      return p ? plannedShiftKey(p, today, today) !== null : false
    }) ?? 'priya'
  for (const base of SAMPLE_LEAVES) {
    const leave = base.id === 'seed-leave-2' ? { ...base, key: awayKey } : base
    const p = SAMPLE_PEOPLE.find((x) => x.key === leave.key)
    if (!p) continue
    const dates = leaveDates(p, leave, today)
    if (dates.length === 0) continue
    put(COLLECTIONS.leaveRequests, leave.id, {
      branchId: o.branchId,
      employeeId: uid(p.key),
      employeeName: p.name,
      typeId: leave.typeId,
      typeName: leave.typeId === 'sick' ? 'Sick leave' : 'Annual leave',
      from: dates[0],
      to: dates.at(-1),
      dates,
      reason: leave.reason,
      status: leave.status,
      paidDays: leave.status === 'approved' ? dates.length : null,
      decidedBy: leave.status === 'approved' ? o.manager.uid : null,
      decidedByName: leave.status === 'approved' ? o.manager.name : null,
      decidedAt: leave.status === 'approved' ? at(Math.min(leave.from, 0) - 3, '10:00') : null,
      managerComment: null,
      createdAt: at(Math.min(leave.from, 0) - 6, '09:30'),
      updatedAt: at(Math.min(leave.from, 0) - 3, '10:00'),
    })
    if (leave.status === 'approved') for (const d of dates) leaveByDay.set(`${p.key}_${d}`, leave)
  }

  // ---- Rota: this and the past weeks plus next week; only the days off depart from the usual week ----
  const thisMonday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7))
  const rotaEnd = addDays(thisMonday, 13)
  for (let d = historyStart; d <= rotaEnd; d = addDays(d, 1))
    for (const p of SAMPLE_PEOPLE) {
      const entry = rotaOverride(p.key, d)
      if (!entry) continue
      put(COLLECTIONS.rota, `${p.key}_${d}`, {
        branchId: o.branchId,
        employeeId: uid(p.key),
        employeeName: p.name,
        date: d,
        shiftId: entry.shiftId ? uid(entry.shiftId) : null,
        updatedAt: now,
      })
    }

  // ---- Attendance ----
  for (const p of SAMPLE_PEOPLE) {
    const hue = (p.name.length * 47) % 360
    const photo = avatarPhoto(p.name, hue)
    for (let d = historyStart; d <= today; d = addDays(d, 1)) {
      if (d < hiredKey(p)) continue
      const shiftKey = plannedShiftKey(p, d, today)
      const leave = leaveByDay.get(`${p.key}_${d}`)
      if (!shiftKey && !leave) continue
      const shift = shiftOf(shiftKey ?? p.histShift)
      const daysAgo = daysAgoOf(d)
      const start = zonedDateTime(d, shift.start, tz)
      if (start > now && !leave) continue

      if (leave) {
        put(COLLECTIONS.attendance, `${p.key}_${d}`, {
          branchId: o.branchId,
          employeeId: uid(p.key),
          employeeName: p.name,
          dateKey: d,
          shiftId: null,
          shiftStart: null,
          shiftEnd: null,
          shiftStartAt: null,
          clockInAt: null,
          clockOutAt: null,
          workedMinutes: null,
          lateMinutes: 0,
          status: 'leave',
          source: 'manager',
          correctedBy: o.manager.uid,
          leaveTypeId: leave.typeId,
          leavePaid: true,
          leaveRequestId: leave.id,
          createdAt: at(Math.min(leave.from, 0) - 3, '10:00'),
          updatedAt: at(Math.min(leave.from, 0) - 3, '10:00'),
        })
        attRows.push({
          employeeId: p.key,
          dateKey: d,
          status: 'leave',
          lateMinutes: 0,
          workedMinutes: null,
          shiftStart: null,
          shiftEnd: null,
        })
        continue
      }

      // Night shift ends the next morning.
      const end = shiftEndFrom(start, shift.start, shift.end)
      const trend = 0.55 + daysAgo / 45 // things get steadily better
      let status: AttendanceStatus
      let lateMinutes = 0
      let clockInAt: Date | null = null
      let clockOutAt: Date | null = null
      let earlyLeave = 0
      let away = false

      const absentOn =
        (p.key === 'tomas' && daysAgo === 3) || (p.key === 'noah' && daysAgo === 9)
      if (daysAgo === 0) {
        if (p.todayOffset === null) continue
        const clockIn = later(start, p.todayOffset)
        if (clockIn > now) continue
        clockInAt = clockIn
        ;({ status, lateMinutes } = classifyClockIn(start, clockIn, { graceMinutes: 5 }))
      } else if (absentOn || (daysAgo > 14 && rand() < p.absentRate * trend)) {
        status = 'absent'
      } else {
        let offset: number
        if (p.key === 'ella' && daysAgo === 2) offset = 24
        else if (rand() < p.lateRate * trend) offset = 6 + Math.floor(rand() * 24)
        else offset = -Math.floor(rand() * 10)
        clockInAt = later(start, offset)
        ;({ status, lateMinutes } = classifyClockIn(start, clockInAt, { graceMinutes: 5 }))
        const overtime =
          (p.key === 'liam' && (daysAgo === 2 || daysAgo === 10)) ||
          (daysAgo > 0 && rand() < p.overtimeRate)
        if (p.key === 'noah' && daysAgo === 5) {
          earlyLeave = 45
          clockOutAt = later(end, -45)
        } else if (overtime) {
          clockOutAt = later(end, 35 + Math.floor(rand() * 60))
        } else {
          clockOutAt = later(end, Math.floor(rand() * 8))
        }
        if (clockOutAt > now) clockOutAt = null
        away = p.key === 'jamal' && daysAgo === 8
      }

      const worked = clockInAt && clockOutAt ? workedMinutes(clockInAt, clockOutAt) : null
      const clocked = clockInAt !== null
      const showPhoto = clocked && daysAgo <= 14
      const distance = away ? 2300 : 8 + Math.floor(rand() * 70)
      attRows.push({
        employeeId: p.key,
        dateKey: d,
        status,
        lateMinutes,
        workedMinutes: worked,
        shiftStart: shift.start,
        shiftEnd: shift.end,
      })
      put(COLLECTIONS.attendance, `${p.key}_${d}`, {
        branchId: o.branchId,
        employeeId: uid(p.key),
        employeeName: p.name,
        dateKey: d,
        shiftId: uid(shift.id),
        shiftStart: shift.start,
        shiftEnd: shift.end,
        shiftStartAt: start,
        shiftEndAt: end,
        clockInAt,
        clockOutAt,
        workedMinutes: worked,
        lateMinutes,
        status,
        source: status === 'absent' ? 'system' : 'web',
        correctedBy: null,
        ...(clocked
          ? {
              clockInLocation: {
                lat: SHOP.lat + (away ? 0.02 : (rand() - 0.5) * 0.0006),
                lng: SHOP.lng + (away ? 0.02 : (rand() - 0.5) * 0.0006),
                accuracy: 8 + Math.floor(rand() * 18),
                distance,
                inside: !away,
              },
            }
          : {}),
        ...(showPhoto ? { photo: true } : {}),
        ...(earlyLeave
          ? { earlyLeaveMinutes: earlyLeave, earlyLeaveReason: 'Dentist appointment' }
          : {}),
        createdAt: clockInAt ?? start,
        updatedAt: clockOutAt ?? clockInAt ?? start,
      })
      if (showPhoto && clockInAt)
        put(COLLECTIONS.attendancePhotos, `${p.key}_${d}`, {
          branchId: o.branchId,
          employeeId: uid(p.key),
          dateKey: d,
          image: photo,
          takenAt: clockInAt,
        })
    }
  }

  // ---- Suppliers ----
  for (const s of SUPPLIERS)
    put(COLLECTIONS.suppliers, s.key, {
      branchId: o.branchId,
      name: s.name,
      contactName: s.contactName,
      phone: s.phone,
      email: s.email,
      categories: s.categories,
      ...stamp,
    })

  // ---- Stock, with a believable history of deliveries and usage ----
  const supplierName = (key: string) => SUPPLIERS.find((s) => s.key === key)?.name ?? null
  const movers = ['liam', 'jamal', 'maya', 'sofia', 'daniel']
  const name = (key: string) =>
    SAMPLE_PEOPLE.find((p) => p.key === key)?.name ?? (key === 'daniel' ? 'Daniel Brooks' : key)
  ITEMS.forEach(([itemName, category, unit, quantity, minQuantity, supplier], i) => {
    const id = `item-${i + 1}`
    const step = (x: number) => Math.max(1, Math.round(x))
    // Walk backwards from today's quantity: usage, usage, a delivery, usage, usage, a delivery, the count.
    const moves: { daysAgo: number; delta: number; reason: string }[] = []
    let after = quantity
    const usage = (daysAgo: number, share: number, reason = 'usage') => {
      const u = step(minQuantity * share)
      moves.push({ daysAgo, delta: -u, reason })
      after += u
    }
    const delivery = (daysAgo: number, share: number) => {
      const d = Math.min(step(minQuantity * share), Math.max(1, Math.floor(after * 0.7)))
      moves.push({ daysAgo, delta: d, reason: 'delivery' })
      after -= d
    }
    usage(0.2 + (i % 3) * 0.3, 0.22)
    usage(2 + (i % 4), 0.3)
    usage(5 + (i % 3), 0.18, i % 7 === 3 ? 'waste' : 'usage')
    delivery(7 + (i % 4), 1.4)
    usage(10 + (i % 3), 0.35)
    usage(13 + (i % 4), 0.3)
    delivery(16 + (i % 5), 1.3)
    moves.push({ daysAgo: 30 + (i % 8), delta: after, reason: 'correction' })
    const sorted = moves.sort((a, b) => b.daysAgo - a.daysAgo)
    let running = 0
    sorted.forEach((m, n) => {
      running = Math.max(0, money(running + m.delta))
      const createdAt = new Date(now.getTime() - m.daysAgo * DAY_MS)
      const by = movers[(i + n) % movers.length] ?? 'liam'
      put(COLLECTIONS.stockMovements, `movement-${i + 1}-${n + 1}`, {
        branchId: o.branchId,
        itemId: uid(id),
        itemName,
        delta: m.delta,
        quantityAfter: running,
        reason: m.reason,
        by: uid(by),
        byName: name(by),
        createdAt,
      })
    })
    const updatedAt = new Date(now.getTime() - (moves.length ? Math.min(...moves.map((m) => m.daysAgo)) : 1) * DAY_MS)
    put(COLLECTIONS.inventoryItems, id, {
      branchId: o.branchId,
      name: itemName,
      category,
      unit,
      quantity,
      minQuantity,
      supplierId: uid(supplier),
      supplierName: supplierName(supplier),
      status: stockStatus(quantity, minQuantity, o.criticalRatio),
      createdAt: new Date(now.getTime() - (30 + (i % 8)) * DAY_MS),
      updatedAt,
    })
  })

  // ---- Tasks: recently completed, open, one overdue, and older completed work for the history ----
  const board: [TaskRow, TaskStatus, { deadline: Date; completedAt: Date | null }][] = [
    [
      ['Restock milk fridge', 'Move the new milk delivery into the front-of-house fridge.', 'Inventory', 'maya', 'high'],
      'completed',
      { deadline: fromNow(-40), completedAt: fromNow(-100) },
    ],
    [
      ['Check oat milk delivery against the order', 'Count the cartons and note anything short.', 'Inventory', 'jamal', 'low'],
      'completed',
      { deadline: fromNow(-150), completedAt: fromNow(-190) },
    ],
    [
      ['Reconcile Saturday till takings', 'Match the cash and card totals to the till report.', 'Finance', 'ella', 'medium'],
      'completed',
      { deadline: at(-2, '10:00'), completedAt: at(-2, '09:20') },
    ],
    [
      ['Rotate pastry display and mark down day-old items', 'Check dates and update the price cards.', 'Service', 'noah', 'medium'],
      'completed',
      { deadline: at(-3, '17:00'), completedAt: at(-3, '16:40') },
    ],
    [
      ['Descale the milk steam wands', 'Soak and flush both wands, then wipe down.', 'Cleaning', 'sofia', 'high'],
      'completed',
      { deadline: at(-5, '14:00'), completedAt: at(-5, '13:35') },
    ],
    [
      ['Update allergen information cards', 'Check every card against the new menu.', 'Service', 'liam', 'high'],
      'completed',
      { deadline: at(-7, '12:00'), completedAt: at(-7, '11:30') },
    ],
    [
      ['Post weekend specials on Instagram', 'Photo and caption for Saturday and Sunday.', 'Marketing', 'sofia', 'low'],
      'completed',
      { deadline: at(-9, '18:00'), completedAt: at(-9, '17:50') },
    ],
    [
      ['Weekend stock rotation', 'Move older stock forward and date-label new deliveries.', 'Inventory', 'maya', 'medium'],
      'pending',
      { deadline: fromNow(300), completedAt: null },
    ],
    [
      ['Staff briefing: new menu items', 'Read through the new menu and be ready to answer questions.', 'Training', 'maya', 'medium'],
      'in_progress',
      { deadline: fromNow(20 * 60), completedAt: null },
    ],
    [
      ['Label and date all prep containers', 'Use the new colour-coded date labels.', 'Service', 'maya', 'low'],
      'pending',
      { deadline: fromNow(30 * 60), completedAt: null },
    ],
    [
      ['Deep clean espresso machines', 'Full backflush and group-head cleaning on both machines.', 'Cleaning', 'liam', 'high'],
      'in_progress',
      { deadline: fromNow(180), completedAt: null },
    ],
    [
      ['Refresh the pastry display layout', 'Re-plan the shelves for the weekend range.', 'Service', 'noah', 'medium'],
      'pending',
      { deadline: fromNow(27 * 60), completedAt: null },
    ],
    [
      ['Weekly cash drawer audit', 'Reconcile drawer totals against the till report.', 'Finance', 'ella', 'medium'],
      'pending',
      { deadline: fromNow(30 * 60), completedAt: null },
    ],
    [
      ['Post evening social update', 'Photo of today’s specials to Instagram.', 'Marketing', 'sofia', 'low'],
      'pending',
      { deadline: fromNow(6 * 60), completedAt: null },
    ],
    [
      ['Stocktake dry goods shelf', 'Count the shelf and update the stock levels.', 'Inventory', 'jamal', 'medium'],
      'in_progress',
      { deadline: fromNow(8 * 60), completedAt: null },
    ],
    [
      ['Sanitise staff toilets', 'Full sanitising checklist and restock supplies.', 'Cleaning', 'tomas', 'high'],
      'overdue',
      { deadline: fromNow(-14 * 60), completedAt: null },
    ],
  ]
  let taskNo = 0
  const addTask = (
    row: TaskRow,
    status: TaskStatus,
    t: { deadline: Date; completedAt: Date | null },
    created: Date,
  ) => {
    const [title, description, category, assignee, priority] = row
    taskNo++
    taskRows.push({ assigneeId: assignee, deadline: t.deadline, status, completedAt: t.completedAt })
    put(COLLECTIONS.tasks, `task-${taskNo}`, {
      branchId: o.branchId,
      title,
      description,
      category,
      assigneeId: uid(assignee),
      assigneeName: name(assignee),
      priority,
      deadline: t.deadline,
      status,
      completedAt: t.completedAt,
      createdBy: o.manager.uid,
      createdAt: created,
      updatedAt: t.completedAt ?? created,
    })
  }
  for (const [row, status, t] of board)
    addTask(row, status, t, new Date(Math.min(t.deadline.getTime(), now.getTime()) - 2 * DAY_MS))

  SAMPLE_PEOPLE.forEach((p, e) => {
    const pool =
      HISTORY_TASKS[
        p.position === 'Cleaner'
          ? 'cleaner'
          : p.position === 'Cashier'
            ? 'cashier'
            : p.position === 'Shift Lead'
              ? 'lead'
              : 'barista'
      ] ?? []
    for (let w = 0; w < 6; w++) {
      const daysAgo = 15 + w * 7 + (e % 6)
      const [title, category] = pool[(w + e) % pool.length] ?? ['Weekly check', 'Service']
      const deadline = at(-daysAgo, '17:00')
      const lateChance = (p.key === 'tomas' ? 0.25 : p.key === 'noah' ? 0.2 : 0.1) * (0.6 + daysAgo / 70)
      const completedAt =
        rand() < lateChance ? later(deadline, 120 + Math.floor(rand() * 1100)) : later(deadline, -(60 + Math.floor(rand() * 300)))
      addTask(
        [title, 'Routine task from the weekly plan.', category, p.key, w % 3 === 0 ? 'high' : 'medium'],
        'completed',
        { deadline, completedAt },
        later(deadline, -3 * 24 * 60),
      )
    }
  })

  // ---- Weekly performance snapshots and each person's rolling stats ----
  const weights = DEFAULT_PERFORMANCE_WEIGHTS
  const comments = [
    'Great attitude with customers this week.',
    'Reliable and quick on the till.',
    'Needs to keep an eye on timekeeping.',
    'Took the lead on the busy Saturday.',
    'Solid week, good teamwork.',
  ]
  const factsFor = (key: string, from: string, to: string, rating: number | null): PeriodFacts =>
    periodFacts(
      attRows.filter((a) => a.employeeId === key && a.dateKey >= from && a.dateKey <= to),
      taskRows.filter((t) => {
        const k = dateKeyOf(t.deadline)
        return t.assigneeId === key && k >= from && k <= to
      }),
      rating,
      now,
    )
  const stats: Record<string, { attendancePct: number; performanceScore: number }> = {}
  for (const p of SAMPLE_PEOPLE) {
    trendWeeks.forEach((week, w) => {
      const { from, to } = weekRange(week)
      const unrated = factsFor(p.key, from, to, null)
      if (unrated.scheduledShifts === 0 && unrated.tasksAssigned === 0) return
      const rated = w < trendWeeks.length - 1 && rand() < 0.7
      const roll = rand()
      const rating = rated ? (roll < 0.2 ? 3 : roll < 0.7 ? 4 : 5) : null
      const facts = { ...unrated, managerRating: rating }
      const { score, breakdown } = performanceScore(facts, weights)
      const { managerRating: _rating, ...inputs } = facts
      put(COLLECTIONS.performance, `${p.key}_${week}`, {
        branchId: o.branchId,
        employeeId: uid(p.key),
        employeeName: p.name,
        period: week,
        inputs,
        managerRating: rating,
        managerComment: rating && rand() < 0.5 ? (comments[Math.floor(rand() * comments.length)] ?? null) : null,
        breakdown,
        score,
        computedAt: now,
      })
    })
    const rolling = factsFor(p.key, addDays(today, -27), today, null)
    stats[p.key] = {
      attendancePct: rolling.scheduledShifts
        ? Math.round((rolling.attendedShifts / rolling.scheduledShifts) * 100)
        : 100,
      performanceScore: performanceScore(rolling, weights).score,
    }
  }

  // ---- Staff profiles ----
  const noteAt = (days: number) => at(-days, '12:00')
  const people: Record<string, Partial<Record<'notes' | 'warnings' | 'achievements', string[]>>> = {
    liam: {
      achievements: ['Led the autumn menu launch with almost no waste.'],
      notes: ['Interested in moving up to assistant manager next year.'],
    },
    noah: {
      warnings: ['Late three times in one fortnight; agreed to leave home 15 minutes earlier.'],
    },
    maya: { achievements: ['Three months in a row of great customer feedback.'] },
    sofia: { achievements: ['Finished barista skills level 2.'] },
    tomas: { notes: ['Prefers nights; keen to take on the weekly deep clean.'] },
  }
  for (const p of SAMPLE_PEOPLE) {
    const extra = people[p.key] ?? {}
    const list = (kind: 'notes' | 'warnings' | 'achievements', ageDays: number) =>
      (extra[kind] ?? []).map((text, n) => ({
        id: `${kind}-${p.key}-${n + 1}`,
        text,
        by: o.manager.name,
        at: noteAt(ageDays + n * 9),
      }))
    put(COLLECTIONS.users, p.key, {
      branchId: o.branchId,
      role: 'employee',
      status: p.key === awayKey ? 'on_leave' : 'active',
      name: p.name,
      email: `${p.key}@${o.emailDomain}`,
      phone: p.phone,
      position: p.position,
      shiftId: p.shift ? uid(p.shift) : null,
      hiredAt: new Date(`${hiredKey(p)}T09:00:00Z`),
      salary: p.salary,
      allowances: p.allowances,
      stats: { ...stats[p.key]!, updatedAt: now },
      notes: list('notes', 20),
      warnings: list('warnings', 30),
      achievements: list('achievements', 14),
      ...stamp,
    })
  }

  // ---- Payslips: last month from the attendance above, two earlier months from typical figures ----
  const firstOfThisMonth = `${today.slice(0, 8)}01`
  const monthBefore = (first: string) => addDays(first, -1).slice(0, 8) + '01'
  const lastMonthFirst = monthBefore(firstOfThisMonth)
  const payMonths = [
    // From the 25th the current month's payslips are already prepared (as drafts).
    ...(Number(today.slice(8)) >= 25
      ? [{ month: firstOfThisMonth.slice(0, 7), real: true, draft: true }]
      : []),
    { month: lastMonthFirst.slice(0, 7), real: true, draft: false },
    { month: monthBefore(lastMonthFirst).slice(0, 7), real: false, draft: false },
    { month: monthBefore(monthBefore(lastMonthFirst)).slice(0, 7), real: false, draft: false },
  ]
  const payroll = [
    ...SAMPLE_PEOPLE.map((p) => ({
      key: p.key,
      name: p.name,
      position: p.position,
      salary: p.salary,
      allowances: p.allowances,
    })),
    { key: 'daniel', name: 'Daniel Brooks', position: 'General Manager', salary: 3400, allowances: 100 },
  ]
  payMonths.forEach(({ month, real, draft }, n) => {
    const monthEnd = addDays(`${month}-01`, 31).slice(0, 8) + '01'
    const paidAt = new Date(`${addDays(monthEnd, -3)}T10:00:00Z`)
    const preparedAt = draft ? now : paidAt
    payroll.forEach((p, e) => {
      const records = attRows.filter((a) => a.employeeId === p.key && a.dateKey.startsWith(month))
      let overtime: number
      let absent: number
      if (real && records.length > 0) {
        absent = payFacts(records).absentDays
        overtime = overtimeMinutes(records)
      } else {
        overtime = (e + n) % 3 === 0 ? 0 : 35 + ((e * 17 + n * 23) % 90)
        absent = (e + n * 3) % 9 === 0 ? 1 : 0
      }
      const bonus = p.key === 'liam' && n === 2 ? 100 : 0
      const totals = payslipTotals({
        salary: p.salary,
        allowances: p.allowances,
        overtimeMinutes: overtime,
        bonus,
        unpaidLeaveDays: 0,
        absentDays: absent,
        otherDeductions: 0,
      })
      put(COLLECTIONS.payslips, `${p.key}_${month}`, {
        branchId: o.branchId,
        employeeId: uid(p.key),
        employeeName: p.name,
        position: p.position,
        month,
        salary: p.salary,
        allowances: p.allowances,
        overtimeMinutes: overtime,
        overtimePay: totals.overtimePay,
        bonus,
        unpaidLeaveDays: 0,
        absentDays: absent,
        leaveDeduction: totals.leaveDeduction,
        otherDeductions: 0,
        deductionNote: '',
        gross: totals.gross,
        net: totals.net,
        status: draft ? 'draft' : 'paid',
        paidAt: draft ? null : paidAt,
        paymentMethod: draft ? null : 'BACS',
        paymentRef: draft ? null : `BACS-${month.replace('-', '')}-${String(e + 1).padStart(2, '0')}`,
        preparedBy: o.manager.uid,
        createdAt: preparedAt,
        updatedAt: preparedAt,
      })
    })
  })

  return docs
}
