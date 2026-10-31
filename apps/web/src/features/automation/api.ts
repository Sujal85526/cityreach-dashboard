import {
  COLLECTIONS,
  isPastAbsenceWindow,
  plannedShiftOn,
  toDateKey,
  type Branch,
  type Shift,
  type User,
} from '@dm/shared'
import { doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { listAttendanceRange, recordId } from '@/features/attendance/api'
import type { SessionUser } from '@/features/auth/api'
import { listRota } from '@/features/rota/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { addNotification } from '@/lib/notify'

const DAY_MS = 86_400_000
/** How far back a missed check is caught up (e.g. after a weekend with nobody opening the app). */
export const ABSENCE_LOOKBACK_DAYS = 7
/** Only recent no-shows raise a notification; older catch-ups are recorded silently. */
const NOTIFY_WITHIN_MS = DAY_MS
const BATCH_LIMIT = 450

/**
 * Free-plan replacement for a scheduled "mark absences" job. Runs in the manager's browser
 * when they open the app: every scheduled shift in the last week whose absence window has
 * passed with no attendance record becomes Absent (or Leave for staff on leave).
 * Idempotent: records use the deterministic id `{uid}_{date}`, so a second run finds nothing.
 */
export async function markAbsences(
  { branch, shifts, employees }: { branch: Branch; shifts: Shift[]; employees: User[] },
  actor: SessionUser,
  now = new Date(),
): Promise<number> {
  const tz = branch.rules.timeZone
  const days = Array.from({ length: ABSENCE_LOOKBACK_DAYS + 1 }, (_, i) =>
    toDateKey(new Date(now.getTime() - (ABSENCE_LOOKBACK_DAYS - i) * DAY_MS), tz),
  )
  const [existing, rota] = await Promise.all([
    listAttendanceRange(branch.id, days[0] ?? '', days.at(-1) ?? ''),
    listRota(branch.id, days[0] ?? '', days.at(-1) ?? ''),
  ])
  const recorded = new Set(existing.map((r) => r.id))

  // The planned shift each day: the rota entry when there is one, else the usual shift.
  const missing = employees.flatMap((e) => {
    if (e.status === 'inactive') return []
    return days.flatMap((dateKey) => {
      const entry = rota.find((r) => r.employeeId === e.id && r.date === dateKey)
      const plan = plannedShiftOn(e.shiftId, entry, shifts, dateKey, tz)
      const due =
        plan &&
        plan.instance.startAt >= e.hiredAt &&
        isPastAbsenceWindow(plan.instance.startAt, now, branch.rules.attendance) &&
        !recorded.has(recordId(e.id, dateKey))
      return due
        ? [{ employee: e, shift: plan.shift, dateKey, startAt: plan.instance.startAt }]
        : []
    })
  })

  for (let i = 0; i < missing.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const { employee, shift, dateKey, startAt } of missing.slice(i, i + BATCH_LIMIT)) {
      const status = employee.status === 'on_leave' ? 'leave' : 'absent'
      const id = recordId(employee.id, dateKey)
      batch.set(doc(db, COLLECTIONS.attendance, id), {
        branchId: branch.id,
        employeeId: employee.id,
        employeeName: employee.name,
        dateKey,
        shiftId: shift.id,
        shiftStart: shift.start,
        shiftEnd: shift.end,
        shiftStartAt: Timestamp.fromDate(startAt),
        clockInAt: null,
        clockOutAt: null,
        workedMinutes: null,
        lateMinutes: 0,
        status,
        source: 'system',
        correctedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      if (status === 'absent' && now.getTime() - startAt.getTime() < NOTIFY_WITHIN_MS)
        addNotification(batch, actor, branch, {
          type: 'absence',
          tone: 'danger',
          title: 'Absence',
          body: `${employee.name} did not clock in for the ${shift.name} shift.`,
          entity: { collection: COLLECTIONS.attendance, id },
        })
    }
    addActivity(batch, actor, {
      action: 'absences_marked',
      summary: `Automatic check recorded ${Math.min(BATCH_LIMIT, missing.length - i)} missed shift(s)`,
      entity: null,
    })
    await batch.commit()
  }
  return missing.length
}
