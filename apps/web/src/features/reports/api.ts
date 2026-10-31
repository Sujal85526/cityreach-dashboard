import {
  COLLECTIONS,
  lastWeeks,
  periodLabel,
  periodRange,
  previousPeriod,
  shiftDate,
  toDateKey,
  weekKeyOf,
  zonedDateTime,
  type Branch,
  type Notification,
  type PeriodType,
  type User,
} from '@dm/shared'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { listSnapshots, loadPeriodData } from '@/features/performance/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'
import { addNotification } from '@/lib/notify'
import { buildReport, type ReportView } from './model'

export const reportId = (branchId: string, type: PeriodType, key: string) =>
  `${branchId}_${type}_${key}`

/** Low / critical stock alerts raised during the period (from the notification log). */
async function countStockAlerts(branch: Branch, from: string, to: string): Promise<number> {
  const tz = branch.rules.timeZone
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.notifications),
      where('branchId', '==', branch.id),
      where('recipientId', '==', null),
      where('createdAt', '>=', Timestamp.fromDate(zonedDateTime(from, '00:00', tz))),
      where('createdAt', '<', Timestamp.fromDate(zonedDateTime(shiftDate(to, 1), '00:00', tz))),
    ),
  )
  return snap.docs
    .map((d) => fromDoc<Notification>(d))
    .filter((n) => n.type === 'stock_low' || n.type === 'stock_critical').length
}

/**
 * Everything a report needs, loaded in parallel: the period's records, the previous period's
 * (for "most improved"), weekly snapshots (ratings and the 8-week trend) and stock alerts.
 */
export async function loadReport(
  type: PeriodType,
  key: string,
  branch: Branch,
  employees: User[],
  now = new Date(),
): Promise<ReportView> {
  const range = periodRange(type, key)
  const previousKey = previousPeriod(type, key)
  const prevRange = periodRange(type, previousKey)
  const weeks = [
    ...new Set([
      ...lastWeeks(range.to, 8),
      weekKeyOf(prevRange.from),
      ...weeksBetween(prevRange.from, range.to),
    ]),
  ]
  const [data, previous, snapshots, inventoryAlerts] = await Promise.all([
    loadPeriodData(branch, range.from, range.to),
    loadPeriodData(branch, prevRange.from, prevRange.to),
    listSnapshots(branch.id, weeks),
    countStockAlerts(branch, range.from, range.to),
  ])
  return buildReport({
    type,
    key,
    branch,
    employees,
    data,
    previous,
    previousKey,
    snapshots,
    inventoryAlerts,
    now,
  })
}

function weeksBetween(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to; d = shiftDate(d, 7)) out.push(weekKeyOf(d))
  return out
}

/**
 * Weekly job (free-plan replacement for a Monday-morning function): on the first manager open
 * of a new week, saves last week's report and notifies "Weekly performance report is ready"
 * plus the week's top performer.
 */
export async function saveLastWeekReport(
  branch: Branch,
  employees: User[],
  actor: SessionUser,
  now = new Date(),
) {
  const thisWeek = weekKeyOf(toDateKey(now, branch.rules.timeZone))
  const lastWeek = previousPeriod('weekly', thisWeek)
  if (branch.automation?.weeklyReport === lastWeek) return false
  const report = await loadReport('weekly', lastWeek, branch, employees, now)
  const { from, to } = periodRange('weekly', lastWeek)
  const id = reportId(branch.id, 'weekly', lastWeek)
  const batch = writeBatch(db)
  batch.set(doc(db, COLLECTIONS.reports, id), {
    branchId: branch.id,
    type: 'weekly',
    period: lastWeek,
    from: Timestamp.fromDate(zonedDateTime(from, '00:00', branch.rules.timeZone)),
    to: Timestamp.fromDate(zonedDateTime(shiftDate(to, 1), '00:00', branch.rules.timeZone)),
    summary: { ...report.summary, averageScore: report.summary.averageScore ?? 0 },
    employees: report.rows.map((r) => ({
      employeeId: r.employee.id,
      name: r.employee.name,
      position: r.employee.position,
      score: r.score,
      attendancePct: r.attendancePct,
      tasksDone: r.tasksDone,
      tasksMissed: r.tasksMissed,
      lateArrivals: r.lateArrivals,
      managerComment: r.comment,
    })),
    createdAt: serverTimestamp(),
  })
  batch.update(doc(db, COLLECTIONS.branches, branch.id), { 'automation.weeklyReport': lastWeek })
  const entity = { collection: COLLECTIONS.reports, id }
  addNotification(batch, actor, branch, {
    type: 'report_ready',
    tone: 'info',
    title: 'Weekly report ready',
    body: `Weekly performance report for ${periodLabel('weekly', lastWeek)} is ready.`,
    entity,
  })
  const top = report.highlights.top
  if (top && top.score > 0)
    addNotification(batch, actor, branch, {
      type: 'top_performer',
      tone: 'success',
      title: 'Top performer',
      body: `${top.employee.name} was last week's top performer with ${top.score}/100.`,
      entity,
    })
  addActivity(batch, actor, {
    action: 'report_generated',
    summary: `Weekly report for ${lastWeek} generated`,
    entity,
  })
  await batch.commit()
  return true
}
