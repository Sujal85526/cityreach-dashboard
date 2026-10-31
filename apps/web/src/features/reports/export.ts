import {
  COLLECTIONS,
  periodRange,
  resolveAttendance,
  type Attendance,
  shiftDate,
  zonedDateTime,
  type Activity,
  type Branch,
  type PeriodType,
  type StockMovement,
} from '@cityreach/shared'
import { collection, getDocs, orderBy, query, Timestamp, where } from '@/lib/store'
import { loadPeriodData } from '@/features/performance/api'
import { downloadCsv, toCsv } from '@/lib/csv'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/firestore'

export const EXPORTS = {
  attendance: 'Attendance records',
  tasks: 'Tasks',
  stock: 'Stock movements',
  activity: 'Activity log',
} as const
export type ExportKind = keyof typeof EXPORTS

/** "2026-10-07 13:22" in the shop's timezone (sortable, spreadsheet-friendly). */
const stamp = (d: Date | null, tz: string) =>
  d
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    : ''

async function inRange<T>(
  collectionName: string,
  branch: Branch,
  from: string,
  to: string,
): Promise<T[]> {
  const tz = branch.rules.timeZone
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      where('branchId', '==', branch.id),
      where('createdAt', '>=', Timestamp.fromDate(zonedDateTime(from, '00:00', tz))),
      where('createdAt', '<', Timestamp.fromDate(zonedDateTime(shiftDate(to, 1), '00:00', tz))),
      orderBy('createdAt', 'desc'),
    ),
  )
  return snap.docs.map((d) => fromDoc<T>(d))
}

/** Clock-in location verdict for the CSV: at_shop / away / located / not_shared, or blank (not recorded). */
const locationVerdict = (l: Attendance['clockInLocation']) =>
  l === undefined
    ? ''
    : l === null
      ? 'not_shared'
      : l.inside === null
        ? 'located'
        : l.inside
          ? 'at_shop'
          : 'away'

/**
 * Raw records for the period as CSV, for the Capstone evaluation (attendance accuracy, task
 * completion rate, inventory monitoring…). Every row has its timestamps.
 */
export async function exportCsv(kind: ExportKind, type: PeriodType, key: string, branch: Branch) {
  const tz = branch.rules.timeZone
  const { from, to } = periodRange(type, key)
  const file = (name: string) => `digital-manager_${name}_${key}.csv`

  if (kind === 'attendance' || kind === 'tasks') {
    const data = await loadPeriodData(branch, from, to)
    if (kind === 'attendance') {
      const rows = [...data.attendance]
        .sort(
          (a, b) =>
            a.dateKey.localeCompare(b.dateKey) || a.employeeName.localeCompare(b.employeeName),
        )
        .map((a) => {
          const r = resolveAttendance(a, branch.rules.attendance)
          return [
            a.dateKey,
            a.employeeName,
            a.shiftStart,
            a.shiftEnd,
            stamp(a.clockInAt, tz),
            stamp(a.clockOutAt, tz),
            r.lateMinutes,
            r.workedMinutes,
            r.status,
            a.source,
            a.correctedBy ? 'yes' : 'no',
            a.earlyLeaveMinutes ?? 0,
            a.earlyLeaveReason ?? '',
            locationVerdict(a.clockInLocation),
            a.clockInLocation?.distance ?? '',
            a.photo === undefined ? '' : a.photo ? 'yes' : 'no',
            stamp(a.createdAt, tz),
          ]
        })
      return downloadCsv(
        file('attendance'),
        toCsv(
          [
            'date',
            'employee',
            'shift_start',
            'shift_end',
            'clock_in',
            'clock_out',
            'minutes_late',
            'worked_minutes',
            'status',
            'source',
            'corrected_by_manager',
            'left_early_minutes',
            'left_early_reason',
            'clock_in_location',
            'clock_in_distance_m',
            'clock_in_photo',
            'recorded_at',
          ],
          rows,
        ),
      )
    }
    const rows = [...data.tasks]
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .map((t) => [
        t.title,
        t.category,
        t.assigneeName,
        t.priority,
        stamp(t.deadline, tz),
        t.status,
        stamp(t.completedAt, tz),
        t.completedAt ? (t.completedAt <= t.deadline ? 'yes' : 'no') : '',
        stamp(t.createdAt, tz),
      ])
    return downloadCsv(
      file('tasks'),
      toCsv(
        [
          'task',
          'category',
          'assigned_to',
          'priority',
          'deadline',
          'status',
          'completed_at',
          'completed_on_time',
          'created_at',
        ],
        rows,
      ),
    )
  }

  if (kind === 'stock') {
    const moves = await inRange<StockMovement>(COLLECTIONS.stockMovements, branch, from, to)
    const rows = moves.map((m) => [
      stamp(m.createdAt, tz),
      m.itemName,
      m.delta,
      m.quantityAfter,
      m.reason,
      m.byName ?? m.by,
    ])
    return downloadCsv(
      file('stock-movements'),
      toCsv(['time', 'item', 'change', 'quantity_after', 'reason', 'by'], rows),
    )
  }

  const log = await inRange<Activity>(COLLECTIONS.activity, branch, from, to)
  const rows = log.map((a) => [stamp(a.createdAt, tz), a.actorName, a.action, a.summary])
  return downloadCsv(file('activity'), toCsv(['time', 'who', 'action', 'summary'], rows))
}
