/**
 * Seeds the Firebase emulators with the coffee shop from the prototype (docs/PROTOTYPE.md).
 * Emulator only: refuses to run against a real project.
 *
 *   pnpm emulators   (terminal 1)
 *   pnpm seed        (terminal 2)
 */
import {
  buildSampleShop,
  COLLECTIONS,
  DEFAULT_BRANCH_RULES,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TASK_CATEGORIES,
  SAMPLE_PEOPLE,
  toDateKey,
} from '@dm/shared'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { seedBusiness } from './seed-business'
import { seedExtras } from './seed-extras'

const PROJECT_ID = 'demo-digital-manager'
const FIRESTORE_HOST = '127.0.0.1:8080'
const AUTH_HOST = '127.0.0.1:9099'
const PASSWORD = 'password123'
const BRANCH_ID = 'downtown'

process.env.FIRESTORE_EMULATOR_HOST ??= FIRESTORE_HOST
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST
process.env.GCLOUD_PROJECT = PROJECT_ID

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Seed must run against the emulators')
}

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()
const auth = getAuth()
const tz = DEFAULT_BRANCH_RULES.timeZone
const now = new Date()
const today = toDateKey(now, tz)

const MANAGER = { uid: 'hana', name: 'Hana Malek', position: 'Owner' }
const PEOPLE = SAMPLE_PEOPLE.map((p) => ({ uid: p.key, name: p.name }))
const personName = (uid: string) => PEOPLE.find((p) => p.uid === uid)?.name ?? uid

const email = (uid: string) => `${uid}@dm.cafe`

async function clearEmulators() {
  const base = `projects/${PROJECT_ID}`
  await Promise.all([
    fetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/${base}/databases/(default)/documents`,
      { method: 'DELETE' },
    ),
    fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/${base}/accounts`, {
      method: 'DELETE',
    }),
  ])
}

async function createAuthUsers() {
  const everyone = [MANAGER, ...PEOPLE]
  await Promise.all(
    // Role and branch live on users/{uid} (written below); the app and security rules read them from there.
    everyone.map((p) =>
      auth.createUser({ uid: p.uid, email: email(p.uid), password: PASSWORD, displayName: p.name }),
    ),
  )
}

async function seed() {
  console.info('Clearing emulators…')
  await clearEmulators()
  await createAuthUsers()

  const writer = db.bulkWriter()
  const put = (collection: string, id: string, data: Record<string, unknown>) =>
    void writer.set(db.collection(collection).doc(id), data)
  const stamp = { createdAt: now, updatedAt: now }

  put(COLLECTIONS.branches, BRANCH_ID, {
    name: 'Downtown',
    address: 'Jumeirah Beach Rd, Dubai',
    phone: '+971 4 000 0000',
    rules: DEFAULT_BRANCH_RULES,
    businessHours: DEFAULT_BUSINESS_HOURS,
    taskCategories: DEFAULT_TASK_CATEGORIES,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    ...stamp,
  })

  put(COLLECTIONS.users, MANAGER.uid, {
    branchId: BRANCH_ID,
    role: 'manager',
    status: 'active',
    name: MANAGER.name,
    email: email(MANAGER.uid),
    phone: '',
    position: MANAGER.position,
    shiftId: null,
    hiredAt: new Date('2025-03-01T00:00:00Z'),
    stats: { attendancePct: 100, performanceScore: 100, updatedAt: now },
    notes: [],
    warnings: [],
    achievements: [],
    ...stamp,
  })

  // The demo café itself (staff, shifts, attendance, suppliers, stock, tasks) is shared with
  // Settings → "Load sample data": packages/shared/src/demo/sampleShop.ts.
  for (const d of buildSampleShop({
    branchId: BRANCH_ID,
    manager: { uid: MANAGER.uid, name: MANAGER.name },
    now,
    timeZone: tz,
    criticalRatio: DEFAULT_BRANCH_RULES.inventory.criticalRatio,
    idPrefix: '',
    emailDomain: 'dm.cafe',
    tag: false,
  }))
    put(d.collection, d.id, d.data)

  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
  const notifications = [
    [
      'late_arrival',
      'warning',
      'Late arrival',
      'Ahmed arrived 18 minutes late this morning.',
      8,
      { collection: COLLECTIONS.attendance, id: `ahmed_${today}` },
    ],
    [
      'task_completed',
      'success',
      'Task completed',
      'Ahmed completed Restock milk fridge.',
      22,
      { collection: COLLECTIONS.tasks, id: 'task-6' },
    ],
    [
      'stock_critical',
      'danger',
      'Inventory critical',
      'Whole Milk is at 6L — below minimum of 20L.',
      60,
      { collection: COLLECTIONS.inventoryItems, id: 'item-1' },
    ],
    [
      'report_ready',
      'info',
      'Weekly report ready',
      'Your weekly performance report for Downtown is available.',
      180,
      null,
    ],
    [
      'task_overdue',
      'danger',
      'Task overdue',
      'Sanitize bathrooms (Youssef) passed its deadline and is still incomplete.',
      300,
      { collection: COLLECTIONS.tasks, id: 'task-8' },
    ],
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
    ['ahmed', 'task_completed', 'Ahmed Hassan completed Restock milk fridge', 22],
    ['ahmed', 'clock_in', 'Ahmed Hassan clocked in 18 min late', 60],
    ['karim', 'stock_delivery', 'Karim Tarek received delivery from Green Valley (Oat Milk)', 120],
    ['hana', 'task_created', 'Hana Malek assigned Post evening social update to Layla', 180],
    [null, 'stock_critical', 'System flagged low stock Whole Milk (6L)', 185],
  ] as const
  activity.forEach(([actorId, action, summary, minutesAgo], i) =>
    put(COLLECTIONS.activity, `seed-activity-${i + 1}`, {
      branchId: BRANCH_ID,
      actorId,
      actorName: actorId ? (actorId === 'hana' ? MANAGER.name : personName(actorId)) : 'System',
      action,
      summary,
      entity: null,
      createdAt: ago(minutesAgo),
    }),
  )

  await writer.close()
  const names = Object.fromEntries(PEOPLE.map((p) => [p.uid, p.name]))
  await seedExtras(db, BRANCH_ID, today, names)
  await seedBusiness(db, BRANCH_ID, today, names)
  console.info(
    `Seeded branch "${BRANCH_ID}" with ${PEOPLE.length + 1} users. Log in as ${email(MANAGER.uid)} / ${PASSWORD}`,
  )
}

seed().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
