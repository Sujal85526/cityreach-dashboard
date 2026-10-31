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
import { seedBusiness } from './business'
import { seedExtras } from './extras'

export const BRANCH_ID = 'central'
export const OWNER = { uid: 'amara', name: 'Amara Okafor', position: 'Owner' }
export const MANAGER = { uid: 'daniel', name: 'Daniel Brooks', position: 'General Manager' }
const EMAIL_DOMAIN = 'cityreach.demo'
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
      stats: { attendancePct: 100, performanceScore: score, updatedAt: now },
      notes: [],
      warnings: [],
      achievements: [],
      ...stamp,
    })

  for (const d of buildSampleShop({
    branchId: BRANCH_ID,
    manager: { uid: OWNER.uid, name: OWNER.name },
    now,
    timeZone: tz,
    criticalRatio: DEFAULT_BRANCH_RULES.inventory.criticalRatio,
    idPrefix: '',
    emailDomain: EMAIL_DOMAIN,
    tag: false,
  }))
    put(d.collection, d.id, d.data)

  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
  const notifications = [
    ['late_arrival', 'warning', 'Late arrival', 'Maya arrived 18 minutes late this morning.', 8, { collection: COLLECTIONS.attendance, id: `maya_${today}` }],
    ['task_completed', 'success', 'Task completed', 'Maya completed Restock milk fridge.', 22, { collection: COLLECTIONS.tasks, id: 'task-6' }],
    ['stock_critical', 'danger', 'Inventory critical', 'Whole Milk is at 6L, below the minimum of 20L.', 60, { collection: COLLECTIONS.inventoryItems, id: 'item-1' }],
    ['report_ready', 'info', 'Weekly report ready', 'Your weekly performance report for Central is available.', 180, null],
    ['task_overdue', 'danger', 'Task overdue', 'Sanitise the prep area (Tomás) passed its deadline and is still incomplete.', 300, { collection: COLLECTIONS.tasks, id: 'task-8' }],
  ] as const
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
      readAt: i > 2 ? ago(minutesAgo - 5) : null,
      createdAt: ago(minutesAgo),
    }),
  )

  const activity = [
    ['maya', 'task_completed', 'Maya Patel completed Restock milk fridge', 22],
    ['maya', 'clock_in', 'Maya Patel clocked in 18 min late', 60],
    ['jamal', 'stock_delivery', 'Jamal Reed received delivery from Green Valley (Oat Milk)', 120],
    ['amara', 'task_created', 'Amara Okafor assigned Post evening social update to Sofia', 180],
    [null, 'stock_critical', 'System flagged low stock Whole Milk (6L)', 185],
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
  // The manager account used by the role switcher keeps its own role.
  writer.update(db.collection(COLLECTIONS.users).doc(MANAGER.uid), { role: 'manager' })
  return db.data
}

registerSeed(() => buildSeed())
