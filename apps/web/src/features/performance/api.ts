import {
  COLLECTIONS,
  lastWeeks,
  shiftDate,
  toDateKey,
  weekRange,
  zonedDateTime,
  type Branch,
  type PerformanceSnapshot,
  type Task,
  type User,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from '@/lib/store'
import { listAttendanceRange } from '@/features/attendance/api'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/from-doc'
import { attendancePct, hasData, measuredStaff, scoreFor, slice, type PeriodData } from './model'

const performance = collection(db, COLLECTIONS.performance)
export const snapshotId = (uid: string, week: string) => `${uid}_${week}`
/** Weeks kept up to date by the daily run (also the dashboard trend). */
export const TREND_WEEKS = 8
const ROLLING_DAYS = 28

/** All attendance and tasks (by deadline) for local dates `from`–`to`, in two parallel queries. */
export async function loadPeriodData(
  branch: Branch,
  from: string,
  to: string,
): Promise<PeriodData> {
  const tz = branch.rules.timeZone
  const [attendance, tasks] = await Promise.all([
    listAttendanceRange(branch.id, from, to),
    getDocs(
      query(
        collection(db, COLLECTIONS.tasks),
        where('branchId', '==', branch.id),
        where('deadline', '>=', Timestamp.fromDate(zonedDateTime(from, '00:00', tz))),
        where('deadline', '<', Timestamp.fromDate(zonedDateTime(shiftDate(to, 1), '00:00', tz))),
      ),
    ).then((snap) => snap.docs.map((d) => fromDoc<Task>(d))),
  ])
  return { attendance, tasks }
}

/** Snapshots for the given weeks (one query; `in` allows up to 30 values). */
export async function listSnapshots(
  branchId: string,
  weeks: string[],
): Promise<PerformanceSnapshot[]> {
  if (weeks.length === 0) return []
  const snap = await getDocs(
    query(
      performance,
      where('branchId', '==', branchId),
      where('period', 'in', weeks.slice(0, 30)),
    ),
  )
  return snap.docs.map((d) => fromDoc<PerformanceSnapshot>(d))
}

/**
 * Daily job (free-plan replacement for a nightly function), also behind "Recalculate now":
 * recomputes every measured employee's weekly snapshot for the last 8 weeks and their
 * rolling 28-day stats on the user document (shown in the employee list). Manager ratings
 * already saved on a snapshot are kept and used in the score.
 */
export async function refreshPerformance(
  branch: Branch,
  employees: User[],
  actor: SessionUser,
  now = new Date(),
): Promise<number> {
  const tz = branch.rules.timeZone
  const today = toDateKey(now, tz)
  const weeks = lastWeeks(today, TREND_WEEKS)
  const from = weekRange(weeks[0] ?? '').from
  const [data, existing] = await Promise.all([
    loadPeriodData(branch, from, today),
    listSnapshots(branch.id, weeks),
  ])
  const rated = new Map(existing.map((s) => [s.id, s]))
  const staff = measuredStaff(employees)
  const dateKey = (d: Date) => toDateKey(d, tz)

  const batch = writeBatch(db)
  let writes = 0
  for (const e of staff) {
    for (const week of weeks) {
      const { from: wFrom, to: wTo } = weekRange(week)
      if (wTo < toDateKey(e.hiredAt, tz)) continue
      const id = snapshotId(e.id, week)
      const prev = rated.get(id)
      const { facts, score, breakdown } = scoreFor(
        e.id,
        slice(data, wFrom, wTo, dateKey),
        branch,
        prev?.managerRating ?? null,
        now,
      )
      if (!hasData(facts)) continue
      const { managerRating: _r, ...inputs } = facts
      batch.set(
        doc(performance, id),
        {
          branchId: branch.id,
          employeeId: e.id,
          employeeName: e.name,
          period: week,
          inputs,
          managerRating: prev?.managerRating ?? null,
          managerComment: prev?.managerComment ?? null,
          breakdown,
          score,
          computedAt: serverTimestamp(),
        },
        { merge: true },
      )
      writes++
    }
    // Rolling 28-day numbers for the employee list and profile.
    const rolling = scoreFor(
      e.id,
      slice(data, shiftDate(today, -(ROLLING_DAYS - 1)), today, dateKey),
      branch,
      null,
      now,
    )
    if (hasData(rolling.facts)) {
      batch.update(doc(db, COLLECTIONS.users, e.id), {
        stats: {
          attendancePct: attendancePct(rolling.facts),
          performanceScore: rolling.score,
          updatedAt: serverTimestamp(),
        },
      })
      writes++
    }
  }
  batch.update(doc(db, COLLECTIONS.branches, branch.id), { 'automation.performanceDate': today })
  addActivity(batch, actor, {
    action: 'performance_recalculated',
    summary: `Performance scores recalculated for ${staff.length} employees (${TREND_WEEKS} weeks)`,
    entity: null,
  })
  await batch.commit() // ≤ ~10 staff × 9 writes; well under the 500-write batch limit
  return writes
}

/** Manager's weekly rating (1–5) and comment; the score updates on the next recalculation. */
export async function rateEmployee(
  employee: User,
  week: string,
  rating: number | null,
  comment: string,
  actor: SessionUser,
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(
    doc(performance, snapshotId(employee.id, week)),
    {
      branchId: employee.branchId,
      employeeId: employee.id,
      employeeName: employee.name,
      period: week,
      managerRating: rating,
      managerComment: comment.trim() || null,
    },
    { merge: true },
  )
  addActivity(batch, actor, {
    action: 'performance_rated',
    summary: `${actor.name} rated ${employee.name} ${rating ?? '–'}/5 for ${week}`,
    entity: { collection: COLLECTIONS.users, id: employee.id },
  })
  await batch.commit()
}
