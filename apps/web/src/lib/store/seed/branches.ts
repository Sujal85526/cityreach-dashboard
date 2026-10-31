/**
 * Two more branches owned by the demo Owner (Salford Quays and Didsbury), each with its own staff,
 * sales, tasks, stock, leave and today's attendance, so "All branches" has real figures to compare.
 * Compact on purpose: enough for every screen of a branch to show something once the owner
 * switches into it. Everything is relative to today. Runs after the main seed.
 */
import {
  addDays,
  COLLECTIONS,
  DEFAULT_BRANCH_RULES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TASK_CATEGORIES,
  payslipTotals,
  stockStatus,
  zonedDateTime,
} from '@cityreach/shared'
import type { SeedDb } from './adapter'

const TZ = DEFAULT_BRANCH_RULES.timeZone
const SHIFTS = [
  { id: 'morning', name: 'Morning', start: '07:00', end: '15:00' },
  { id: 'evening', name: 'Evening', start: '15:00', end: '23:00' },
] as const
const OWNER = { uid: 'amara', name: 'Amara Okafor' }

type Mood = 'on_time' | 'late' | 'absent' | 'not_in'
interface Person {
  key: string
  name: string
  position: string
  salary: number
  allowances: number
  shift: 'morning' | 'evening'
  today: Mood
}
type Stock = [name: string, category: string, unit: string, quantity: number, min: number, supplier: number]
type Open = [title: string, assignee: number, hoursFromNow: number, priority: 'low' | 'medium' | 'high']

interface BranchPlan {
  id: string
  prefix: string
  name: string
  address: string
  phone: string
  location: { lat: number; lng: number }
  /** Average takings on a normal day. */
  dailySales: number
  people: Person[]
  suppliers: [name: string, contact: string][]
  stock: Stock[]
  open: Open[]
  /** Pending leave requests: [person index, days from today, number of days]. */
  leave: [number, number, number][]
}

const PLANS: BranchPlan[] = [
  {
    id: 'salford-quays',
    prefix: 'sq',
    name: 'Salford Quays',
    address: '9 Broadway, Salford Quays, Manchester',
    phone: '+44 161 555 0177',
    location: { lat: 53.4723, lng: -2.2951 },
    dailySales: 1750,
    people: [
      { key: 'hana', name: 'Hana Yilmaz', position: 'Shift Lead', salary: 2500, allowances: 150, shift: 'morning', today: 'on_time' },
      { key: 'ravi', name: 'Ravi Menon', position: 'Barista', salary: 2100, allowances: 50, shift: 'morning', today: 'late' },
      { key: 'chloe', name: 'Chloe Adams', position: 'Barista', salary: 2050, allowances: 50, shift: 'morning', today: 'absent' },
      { key: 'kofi', name: 'Kofi Mensah', position: 'Cashier', salary: 1950, allowances: 0, shift: 'evening', today: 'not_in' },
      { key: 'lucy', name: 'Lucy Brennan', position: 'Kitchen Assistant', salary: 1900, allowances: 0, shift: 'evening', today: 'not_in' },
    ],
    suppliers: [
      ['Quay Dairy Co.', 'Tom Hargreaves'],
      ['Harbour Bakes', 'Nadia Karim'],
    ],
    stock: [
      ['Whole Milk', 'Dairy', 'L', 22, 40, 0],
      ['Oat Milk', 'Dairy', 'L', 36, 20, 0],
      ['Butter Croissants', 'Bakery', 'pcs', 70, 40, 1],
      ['Sourdough Loaves', 'Bakery', 'pcs', 6, 14, 1],
      ['Espresso Beans — House Blend', 'Beverages', 'kg', 26, 12, 0],
      ['12oz Paper Cups', 'Packaging', 'pcs', 1500, 800, 1],
    ],
    open: [
      ['Deep clean the espresso machine', 0, 5, 'high'],
      ['Count the till float', 1, -4, 'high'],
      ['Order more oat milk', 2, 26, 'medium'],
      ['Refresh the pastry display', 3, 8, 'low'],
    ],
    leave: [[1, 6, 3]],
  },
  {
    id: 'didsbury',
    prefix: 'dd',
    name: 'Didsbury',
    address: '41 Wilmslow Road, Didsbury, Manchester',
    phone: '+44 161 555 0188',
    location: { lat: 53.4136, lng: -2.2332 },
    dailySales: 930,
    people: [
      { key: 'isla', name: 'Isla Moran', position: 'Shift Lead', salary: 2350, allowances: 100, shift: 'morning', today: 'on_time' },
      { key: 'omar', name: 'Omar Farouk', position: 'Barista', salary: 1950, allowances: 50, shift: 'morning', today: 'on_time' },
      { key: 'beth', name: 'Beth Taylor', position: 'Cashier', salary: 1850, allowances: 0, shift: 'evening', today: 'late' },
      { key: 'jonas', name: 'Jonas Weber', position: 'Barista', salary: 1900, allowances: 50, shift: 'evening', today: 'not_in' },
    ],
    suppliers: [['Village Dairy', 'Eleanor Pike']],
    stock: [
      ['Whole Milk', 'Dairy', 'L', 4, 18, 0],
      ['Oat Milk', 'Dairy', 'L', 14, 10, 0],
      ['Vanilla Syrup', 'Syrups', 'btl', 1, 4, 0],
      ['8oz Paper Cups', 'Packaging', 'pcs', 520, 400, 0],
      ['Napkins', 'Packaging', 'pcs', 1400, 600, 0],
    ],
    open: [
      ['Wipe down the window seats', 0, 3, 'low'],
      ['Reorder vanilla syrup', 1, -20, 'high'],
      ['Update the chalkboard menu', 2, 30, 'medium'],
    ],
    leave: [
      [1, 9, 2],
      [3, 14, 5],
    ],
  },
]

const money = (n: number) => Math.round(n * 100) / 100
const weekdayFactor = [1.1, 0.85, 0.88, 0.92, 0.98, 1.15, 1.4]

export function seedBranches(db: SeedDb, today: string) {
  const now = new Date()
  const writer = db.bulkWriter()
  const put = (coll: string, id: string, data: Record<string, unknown>) =>
    writer.set(db.collection(coll).doc(id), data)
  const day = (offset: number) => addDays(today, offset)
  const at = (offset: number, time: string) => zonedDateTime(day(offset), time, TZ)
  let state = 11
  const rand = () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }

  for (const plan of PLANS) {
    const { id: branchId, prefix } = plan
    const uid = (key: string) => `${prefix}-${key}`
    const base = (createdAt = now) => ({
      branchId,
      createdBy: OWNER.uid,
      createdByName: OWNER.name,
      createdAt,
      updatedAt: createdAt,
    })
    const stamp = { createdAt: now, updatedAt: now }

    put(COLLECTIONS.branches, branchId, {
      name: plan.name,
      address: plan.address,
      phone: plan.phone,
      location: { ...plan.location, radiusMeters: 150 },
      rules: DEFAULT_BRANCH_RULES,
      businessHours: DEFAULT_BUSINESS_HOURS,
      taskCategories: DEFAULT_TASK_CATEGORIES,
      notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
      ownerId: OWNER.uid,
      automation: { performanceDate: today },
      ...stamp,
    })
    for (const s of SHIFTS)
      put(COLLECTIONS.shifts, `${prefix}-${s.id}`, {
        branchId,
        name: s.name,
        start: s.start,
        end: s.end,
        days: [0, 1, 2, 3, 4, 5, 6],
        ...stamp,
      })
    const shiftOf = (key: 'morning' | 'evening') => SHIFTS.find((s) => s.id === key) ?? SHIFTS[0]

    // ---- Staff (hidden from the sign-in lists: they belong to this branch only) ----
    plan.people.forEach((p, e) => {
      put(COLLECTIONS.users, uid(p.key), {
        branchId,
        role: 'employee',
        status: 'active',
        extraBranch: true,
        name: p.name,
        email: `${uid(p.key)}@cityreach.demo`,
        phone: `+44 7700 900 ${3 + e}${prefix === 'sq' ? '1' : '2'}0`,
        position: p.position,
        shiftId: `${prefix}-${p.shift}`,
        hiredAt: new Date(`${day(-(200 + e * 40))}T09:00:00Z`),
        salary: p.salary,
        allowances: p.allowances,
        stats: { attendancePct: 94 - e, performanceScore: 88 - e * 2, updatedAt: now },
        notes: [],
        warnings: [],
        achievements: [],
        ...stamp,
      })
    })

    // ---- Attendance: today plus the last two weeks ----
    for (let back = 14; back >= 0; back--) {
      const date = day(-back)
      plan.people.forEach((p) => {
        const shift = shiftOf(p.shift)
        const start = zonedDateTime(date, shift.start, TZ)
        if (start > now) return
        let mood: Mood = p.today
        if (back > 0) {
          const roll = rand()
          mood = roll < 0.04 ? 'absent' : roll < 0.16 ? 'late' : 'on_time'
        } else if (mood === 'not_in') return
        const lateMinutes = mood === 'late' ? 12 + Math.floor(rand() * 14) : 0
        const clockInAt =
          mood === 'absent'
            ? null
            : new Date(start.getTime() + (mood === 'late' ? lateMinutes : -4) * 60_000)
        const end = new Date(start.getTime() + 8 * 3_600_000)
        const clockOutAt = clockInAt && end < now ? new Date(end.getTime() + 3 * 60_000) : null
        put(COLLECTIONS.attendance, `${uid(p.key)}_${date}`, {
          branchId,
          employeeId: uid(p.key),
          employeeName: p.name,
          dateKey: date,
          shiftId: `${prefix}-${shift.id}`,
          shiftStart: shift.start,
          shiftEnd: shift.end,
          shiftStartAt: start,
          shiftEndAt: end,
          clockInAt,
          clockOutAt,
          workedMinutes: clockInAt && clockOutAt ? 480 - lateMinutes : null,
          lateMinutes,
          status: mood === 'absent' ? 'absent' : mood === 'late' ? 'late' : 'on_time',
          source: mood === 'absent' ? 'system' : 'web',
          correctedBy: null,
          createdAt: clockInAt ?? start,
          updatedAt: clockOutAt ?? clockInAt ?? start,
        })
      })
    }

    // ---- Sales (weekend peak) and this month's expenses ----
    for (let back = 70; back >= 1; back--) {
      const date = day(-back)
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
      const total = Math.round(
        plan.dailySales * (weekdayFactor[weekday] ?? 1) * (0.9 + rand() * 0.2),
      )
      const card = Math.round(total * 0.58)
      const online = Math.round(total * 0.14)
      put(COLLECTIONS.salesDays, `${branchId}_${date}`, {
        ...base(at(-back, '22:40')),
        date,
        cash: total - card - online,
        card,
        online,
        note: '',
      })
    }
    const month = today.slice(0, 7)
    const expenses: [string, string, number][] = [
      ['Rent', 'Shop rent (monthly)', plan.dailySales > 1500 ? 5200 : 3300],
      ['Supplies', 'Weekly stock top-up', Math.round(plan.dailySales * 0.7)],
      ['Utilities', 'Electricity and gas', 520],
    ]
    expenses.forEach(([category, description, amount], i) =>
      put(COLLECTIONS.expenses, `${prefix}-expense-${i + 1}`, {
        ...base(),
        date: `${month}-0${i + 1}`,
        category,
        description,
        amount,
        vat: 0,
        paymentMethod: 'Bank transfer',
      }),
    )

    // ---- Last month's payslips ----
    const lastMonth = addDays(`${month}-01`, -1).slice(0, 7)
    plan.people.forEach((p, e) => {
      const totals = payslipTotals({
        salary: p.salary,
        allowances: p.allowances,
        overtimeMinutes: e % 2 ? 0 : 60,
        bonus: 0,
        unpaidLeaveDays: 0,
        absentDays: 0,
        otherDeductions: 0,
      })
      const paidAt = new Date(`${lastMonth}-28T10:00:00Z`)
      put(COLLECTIONS.payslips, `${uid(p.key)}_${lastMonth}`, {
        branchId,
        employeeId: uid(p.key),
        employeeName: p.name,
        position: p.position,
        month: lastMonth,
        salary: p.salary,
        allowances: p.allowances,
        overtimeMinutes: e % 2 ? 0 : 60,
        overtimePay: totals.overtimePay,
        bonus: 0,
        unpaidLeaveDays: 0,
        absentDays: 0,
        leaveDeduction: totals.leaveDeduction,
        otherDeductions: 0,
        deductionNote: '',
        gross: totals.gross,
        net: totals.net,
        status: 'paid',
        paidAt,
        paymentMethod: 'BACS',
        paymentRef: `BACS-${lastMonth.replace('-', '')}-${prefix}${e + 1}`,
        preparedBy: OWNER.uid,
        createdAt: paidAt,
        updatedAt: paidAt,
      })
    })

    // ---- Suppliers and stock ----
    plan.suppliers.forEach(([name, contactName], i) =>
      put(COLLECTIONS.suppliers, `${prefix}-supplier-${i + 1}`, {
        branchId,
        name,
        contactName,
        phone: '+44 161 555 01' + (40 + i),
        email: `orders@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`,
        categories: ['Food & drink'],
        ...stamp,
      }),
    )
    plan.stock.forEach(([name, category, unit, quantity, min, supplier], i) => {
      const itemId = `${prefix}-item-${i + 1}`
      const supplierRow = plan.suppliers[supplier]
      put(COLLECTIONS.inventoryItems, itemId, {
        branchId,
        name,
        category,
        unit,
        quantity,
        minQuantity: min,
        supplierId: `${prefix}-supplier-${supplier + 1}`,
        supplierName: supplierRow?.[0] ?? null,
        status: stockStatus(quantity, min, DEFAULT_BRANCH_RULES.inventory.criticalRatio),
        createdAt: at(-40, '09:00'),
        updatedAt: at(-1, '17:00'),
      })
      // A fortnight of use, a delivery and one wasted lot, so the item has a history.
      let left = quantity
      const lot = Math.max(1, Math.round(min * 0.12))
      const rows: { back: number; delta: number; reason: string }[] = [
        { back: 1, delta: -lot, reason: 'usage' },
        { back: 3, delta: -lot, reason: 'usage' },
        { back: 5, delta: -Math.max(1, Math.round(lot / 2)), reason: 'waste' },
        { back: 8, delta: Math.round(min * 1.2), reason: 'delivery' },
        { back: 10, delta: -lot, reason: 'usage' },
        { back: 13, delta: -lot, reason: 'usage' },
      ]
      for (const r of rows) left -= r.delta
      rows.push({ back: 20, delta: Math.max(0, left), reason: 'correction' })
      let running = 0
      rows
        .sort((a, b) => b.back - a.back)
        .forEach((r, n) => {
          running = Math.max(0, money(running + r.delta))
          put(COLLECTIONS.stockMovements, `${itemId}-m${n + 1}`, {
            branchId,
            itemId,
            itemName: name,
            delta: r.delta,
            quantityAfter: running,
            reason: r.reason,
            by: OWNER.uid,
            byName: OWNER.name,
            createdAt: at(-r.back, '12:00'),
          })
        })
    })

    // ---- Tasks: some open, one overdue, one done ----
    plan.open.forEach(([title, assignee, hours, priority], i) => {
      const person = plan.people[assignee % plan.people.length]
      if (!person) return
      const deadline = new Date(now.getTime() + hours * 3_600_000)
      put(COLLECTIONS.tasks, `${prefix}-task-${i + 1}`, {
        branchId,
        title,
        description: 'Assigned by the owner.',
        category: DEFAULT_TASK_CATEGORIES[i % DEFAULT_TASK_CATEGORIES.length] ?? 'General',
        assigneeId: uid(person.key),
        assigneeName: person.name,
        priority,
        deadline,
        status: hours < 0 ? 'overdue' : 'pending',
        completedAt: null,
        createdBy: OWNER.uid,
        createdAt: at(-2, '10:00'),
        updatedAt: at(-2, '10:00'),
      })
    })
    const doneBy = plan.people[1]
    if (doneBy)
      put(COLLECTIONS.tasks, `${prefix}-task-done`, {
        branchId,
        title: 'Restock the napkin dispensers',
        description: 'Routine opening task.',
        category: DEFAULT_TASK_CATEGORIES[0] ?? 'General',
        assigneeId: uid(doneBy.key),
        assigneeName: doneBy.name,
        priority: 'low',
        deadline: new Date(now.getTime() - 6 * 3_600_000),
        status: 'completed',
        completedAt: new Date(now.getTime() - 8 * 3_600_000),
        createdBy: OWNER.uid,
        createdAt: at(-2, '10:00'),
        updatedAt: new Date(now.getTime() - 8 * 3_600_000),
      })

    // ---- Leave waiting for a decision ----
    plan.leave.forEach(([who, from, days], i) => {
      const person = plan.people[who]
      if (!person) return
      const dates = Array.from({ length: days }, (_, d) => day(from + d))
      put(COLLECTIONS.leaveRequests, `${prefix}-leave-${i + 1}`, {
        branchId,
        employeeId: uid(person.key),
        employeeName: person.name,
        typeId: 'annual',
        typeName: 'Annual leave',
        from: dates[0],
        to: dates.at(-1),
        dates,
        reason: 'Family trip',
        status: 'pending',
        paidDays: null,
        decidedBy: null,
        decidedByName: null,
        decidedAt: null,
        managerComment: null,
        createdAt: at(-1, '09:00'),
        updatedAt: at(-1, '09:00'),
      })
    })
  }

  writer.close()
}
