import {
  buildSampleShop,
  COLLECTIONS,
  DEFAULT_BRANCH_RULES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TASK_CATEGORIES,
  SAMPLE_PEOPLE,
  toDateKey,
} from '@cityreach/shared'
import { registerSeed } from '../engine'
import { SeedDb, type SeedCollections } from './adapter'
import { seedBranches } from './branches'
import { seedBusiness } from './business'
import { seedCredentials } from './credentials'
import { seedExtras } from './extras'

export const BRANCH_ID = 'central'
export const OWNER = { uid: 'amara', name: 'Amara Okafor', position: 'Owner' }
export const MANAGER = { uid: 'daniel', name: 'Daniel Brooks', position: 'General Manager' }
const EMAIL_DOMAIN = 'cityreach.co.uk'
const email = (uid: string) => `${uid}@${EMAIL_DOMAIN}`

/** Builds the whole demo business, with dates relative to today. Pure: no I/O. */
export function buildSeed(now = new Date()): SeedCollections {
  const db = new SeedDb()
  const writer = db.bulkWriter()
  const tz = DEFAULT_BRANCH_RULES.timeZone
  const today = toDateKey(now, tz)
  const stamp = { createdAt: now, updatedAt: now }
  const put = (collection: string, id: string, data: Record<string, unknown>) =>
    writer.set(db.collection(collection).doc(id), data)
  const names: Record<string, string> = Object.fromEntries(SAMPLE_PEOPLE.map((p) => [p.key, p.name]))
  names[OWNER.uid] = OWNER.name
  names[MANAGER.uid] = MANAGER.name

  put(COLLECTIONS.branches, BRANCH_ID, {
    name: 'Central',
    address: '22 Albion Street, Manchester',
    phone: '+44 161 555 0142',
    location: { lat: 53.4808, lng: -2.2426, radiusMeters: 150 },
    rules: DEFAULT_BRANCH_RULES,
    businessHours: DEFAULT_BUSINESS_HOURS,
    taskCategories: DEFAULT_TASK_CATEGORIES,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    ...stamp,
  })

  for (const [person, role, hiredAt, score] of [
    [OWNER, 'manager', '2024-03-01', 100],
    [MANAGER, 'manager', '2024-09-16', 96],
  ] as const)
    put(COLLECTIONS.users, person.uid, {
      branchId: BRANCH_ID,
      role,
      status: 'active',
      name: person.name,
      email: email(person.uid),
      phone: '+44 7700 900 1' + (person.uid === 'amara' ? '01' : '02'),
      position: person.position,
      shiftId: null,
      hiredAt: new Date(`${hiredAt}T00:00:00Z`),
      ...(person.uid === 'daniel' ? { salary: 3400, allowances: 100 } : {}),
      stats: { attendancePct: 100, performanceScore: score, updatedAt: now },
      notes: [],
      warnings: [],
      achievements: [],
      ...stamp,
    })

  const sample = buildSampleShop({
    branchId: BRANCH_ID,
    manager: { uid: OWNER.uid, name: OWNER.name },
    now,
    timeZone: tz,
    criticalRatio: DEFAULT_BRANCH_RULES.inventory.criticalRatio,
    idPrefix: '',
    emailDomain: EMAIL_DOMAIN,
    tag: false,
  })
  for (const d of sample) put(d.collection, d.id, d.data)

  const idWhere = (collection: string, field: string, value: string) => {
    const found = sample.find((d) => d.collection === collection && d.data[field] === value)
    if (!found) throw new Error(`Seed refers to a missing ${collection} record: ${value}`)
    return found.id
  }
  const task = (title: string) => ({
    collection: COLLECTIONS.tasks,
    id: idWhere(COLLECTIONS.tasks, 'title', title),
  })
  const item = (name: string) => ({
    collection: COLLECTIONS.inventoryItems,
    id: idWhere(COLLECTIONS.inventoryItems, 'name', name),
  })
  const lateToday = sample.find(
    (d) =>
      d.collection === COLLECTIONS.attendance &&
      d.data.dateKey === today &&
      d.data.status === 'late',
  )

  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
  type Entry = readonly [
    type: string,
    tone: 'success' | 'warning' | 'danger' | 'info',
    title: string,
    body: string,
    minutesAgo: number,
    entity: { collection: string; id: string } | null,
  ]
  const notifications: Entry[] = [
    ['task_completed', 'success', 'Task completed', 'Maya completed Restock milk fridge.', 100, task('Restock milk fridge')],
    ['task_completed', 'success', 'Task completed', 'Jamal completed Check oat milk delivery against the order.', 190, task('Check oat milk delivery against the order')],
    ...(lateToday
      ? [
          [
            'late_arrival',
            'warning',
            'Late arrival',
            `${String(lateToday.data.employeeName)} arrived ${String(lateToday.data.lateMinutes)} minutes late.`,
            Math.max(5, Math.round((now.getTime() - (lateToday.data.clockInAt as Date).getTime()) / 60_000)),
            { collection: COLLECTIONS.attendance, id: lateToday.id },
          ] as Entry,
        ]
      : []),
    ['leave_requested', 'info', 'Leave request', 'Maya asked for 3 days of annual leave.', 150, { collection: COLLECTIONS.leaveRequests, id: 'seed-leave-1' }],
    ['swap_requested', 'info', 'Shift swap request', 'Ella asked to swap a shift with Jamal.', 210, { collection: COLLECTIONS.swapRequests, id: 'seed-swap-1' }],
    ['stock_critical', 'danger', 'Critical stock', 'Vanilla Syrup is critically low (2 btl left, minimum 6 btl). Reorder today.', 240, item('Vanilla Syrup')],
    ['stock_low', 'warning', 'Low stock', 'Oat Milk has fallen below its minimum stock level (9 L left, minimum 15 L).', 330, item('Oat Milk')],
    ['stock_low', 'warning', 'Low stock', '12oz Paper Cups has fallen below its minimum stock level (480 pcs left, minimum 600 pcs).', 420, item('12oz Paper Cups')],
    ['document_expiry', 'warning', 'Document expiring soon', 'Gas safety certificate expires in 17 days.', 600, { collection: COLLECTIONS.documents, id: 'seed-doc-3' }],
    ['document_expiry', 'warning', 'Document expiring soon', 'Public liability insurance expires in 24 days.', 660, { collection: COLLECTIONS.documents, id: 'seed-doc-2' }],
    ['task_overdue', 'danger', 'Task overdue', 'Sanitise staff toilets (Tomás) passed its deadline and is still incomplete.', 780, task('Sanitise staff toilets')],
    ['report_ready', 'info', 'Weekly report ready', 'Your weekly performance report for Central is available.', 960, null],
    ['top_performer', 'success', 'Top performer', 'Liam Carter had the highest performance score last week.', 1200, null],
  ]
  notifications.forEach(([type, tone, title, body, minutesAgo, entity], i) =>
    put(COLLECTIONS.notifications, `seed-notification-${i + 1}`, {
      branchId: BRANCH_ID,
      recipientId: null,
      actorId: null,
      type,
      tone,
      title,
      body,
      entity,
      readAt: minutesAgo > 400 ? ago(minutesAgo - 20) : null,
      createdAt: ago(minutesAgo),
    }),
  )

  const activity = [
    ['maya', 'task_completed', 'Maya Patel completed Restock milk fridge', 100],
    ['jamal', 'task_completed', 'Jamal Reed completed Check oat milk delivery against the order', 190],
    ['liam', 'clock_in', 'Liam Carter clocked in on time', 200],
    ['maya', 'leave_requested', 'Maya Patel requested 3 days of annual leave', 150],
    ['ella', 'swap_requested', 'Ella Johansson asked to swap a shift with Jamal Reed', 210],
    [null, 'stock_critical', 'System flagged critical stock: Vanilla Syrup (2 btl)', 240],
    ['jamal', 'stock_delivery', 'Jamal Reed received a delivery from Green Valley Dairy (Whole Milk)', 330],
    ['amara', 'task_created', 'Amara Okafor assigned Post evening social update to Sofia', 420],
    ['sofia', 'incident_reported', 'Sofia Rossi logged a closed incident (customer complaint)', 540],
    ['daniel', 'payslip_paid', 'Daniel Brooks marked the payslips for last month as paid', 780],
    ['amara', 'purchase_ordered', 'Amara Okafor ordered from Green Valley Dairy (PO-0002)', 900],
    ['noah', 'clock_in', 'Noah Kim clocked in on time', 1100],
    ['liam', 'checklist_completed', 'Liam Carter completed the Opening checklist', 1300],
    ['jamal', 'stock_adjusted', 'Jamal Reed counted Oat Milk (9 L)', 18],
    ['sofia', 'task_started', 'Sofia Rossi started Post evening social update', 42],
  ] as const
  activity.forEach(([actorId, action, summary, minutesAgo], i) =>
    put(COLLECTIONS.activity, `seed-activity-${i + 1}`, {
      branchId: BRANCH_ID,
      actorId,
      actorName: actorId ? (names[actorId] ?? actorId) : 'System',
      action,
      summary,
      entity: null,
      createdAt: ago(minutesAgo),
    }),
  )

  seedExtras(db, BRANCH_ID, today, names)
  seedBusiness(db, BRANCH_ID, today, names)
  seedBranches(db, today)
  // The manager account used by the role switcher keeps its own role.
  writer.update(db.collection(COLLECTIONS.users).doc(MANAGER.uid), { role: 'manager' })
  seedCredentials(db, now)
  return db.data
}

registerSeed(() => buildSeed())
