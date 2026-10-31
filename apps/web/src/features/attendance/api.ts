import {
  classifyClockIn,
  COLLECTIONS,
  currentPlannedShift,
  plannedShiftOn,
  earlyLeaveMinutes,
  resolveAttendance,
  shiftEndFrom,
  toClockLocation,
  toDateKey,
  workedMinutes,
  type Attendance,
  type AttendancePhoto,
  type AttendanceStatus,
  type Branch,
  type RotaEntry,
  type GeoFix,
  type Shift,
  type User,
} from '@cityreach/shared'
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/firebase'
import { fromDoc } from '@/lib/firestore'
import { formatMinutes, formatTimeOfDay } from '@/lib/format'
import { addNotification } from '@/lib/notify'

const attendance = collection(db, COLLECTIONS.attendance)
const photos = collection(db, COLLECTIONS.attendancePhotos)
export const recordId = (uid: string, dateKey: string) => `${uid}_${dateKey}`
const entity = (id: string) => ({ collection: COLLECTIONS.attendance, id })

export async function getRecord(uid: string, dateKey: string): Promise<Attendance | null> {
  const snap = await getDoc(doc(attendance, recordId(uid, dateKey)))
  return snap.exists() ? fromDoc<Attendance>(snap) : null
}

/** The employee's own history, newest first. */
export async function listMyAttendance(uid: string, count = 31): Promise<Attendance[]> {
  const snap = await getDocs(
    query(attendance, where('employeeId', '==', uid), orderBy('dateKey', 'desc'), limit(count)),
  )
  return snap.docs.map((d) => fromDoc<Attendance>(d))
}

/** All records in the branch between two local dates (inclusive). */
export async function listAttendanceRange(
  branchId: string,
  fromKey: string,
  toKey: string,
): Promise<Attendance[]> {
  const snap = await getDocs(
    query(
      attendance,
      where('branchId', '==', branchId),
      where('dateKey', '>=', fromKey),
      where('dateKey', '<=', toKey),
    ),
  )
  return snap.docs.map((d) => fromDoc<Attendance>(d))
}

export interface ClockContext {
  me: User
  /** The branch's shifts, to resolve the planned one. */
  shifts: Shift[]
  /** The employee's rota entries around today (yesterday–tomorrow is enough). */
  rota: RotaEntry[]
  branch: Branch
}

/**
 * Which date and shift a clock-in right now belongs to: the planned shift (rota entry, else the
 * usual shift) whose window is open. `scheduled` without an `instance` means the employee works
 * shifts but none is open now (or the rota gives them the day off), so the button explains why.
 * Staff without any shift may clock in at any time.
 */
export function clockInTarget({ me, shifts, rota, branch }: ClockContext, now = new Date()) {
  const tz = branch.rules.timeZone
  const today = toDateKey(now, tz)
  const planFor = (dk: string) =>
    plannedShiftOn(
      me.shiftId,
      rota.find((r) => r.employeeId === me.id && r.date === dk),
      shifts,
      dk,
      tz,
    )
  const plan = currentPlannedShift(planFor, now, tz)
  if (plan)
    return {
      dateKey: plan.instance.dateKey,
      instance: plan.instance,
      shift: plan.shift,
      scheduled: true,
    }
  const todays = rota.find((r) => r.employeeId === me.id && r.date === today)
  const shift = planFor(today)?.shift ?? shifts.find((s) => s.id === me.shiftId) ?? null
  return {
    dateKey: today,
    instance: null,
    shift,
    scheduled: Boolean(me.shiftId) || Boolean(todays),
    dayOff: todays?.shiftId === null,
  }
}

/**
 * Clock in, in two writes that firestore.rules check:
 * 1. create the record with the server's time (`clockInAt == request.time`), status 'pending';
 * 2. read that time back, classify On Time / Late with the shared rule, and save the result
 *    together with the activity entry and the late-arrival notification.
 */
/** What the phone captured at clock-in. Either may be missing (permission denied, no camera). */
export interface ClockInCapture {
  location: GeoFix | null
  /** JPEG data URL from the live camera. */
  photo: string | null
}

const awayText = (km: number) => (km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`)

export async function clockIn(
  ctx: ClockContext,
  actor: SessionUser,
  capture: ClockInCapture,
): Promise<Attendance> {
  const { me, branch } = ctx
  const target = clockInTarget(ctx)
  const shift = target.instance ? target.shift : null
  if (target.scheduled && !target.instance)
    throw new Error(
      'dayOff' in target && target.dayOff
        ? "You're off today on the rota."
        : `You can clock in from 3 hours before your ${target.shift?.name ?? ''} shift (${formatTimeOfDay(target.shift?.start ?? '')}) until it ends.`,
    )
  const ref = doc(attendance, recordId(me.id, target.dateKey))
  const existing = await getDoc(ref)
  // An automatic "Absent" (no clock-in within the window) may be replaced by a late clock-in.
  if (
    existing.exists() &&
    !(existing.get('source') === 'system' && existing.get('status') === 'absent')
  )
    throw new Error('You have already clocked in for this shift.')

  const startAt = target.instance?.startAt ?? null
  const location = capture.location ? toClockLocation(capture.location, branch.location) : null
  // Step 1 is one batch: the record and its photo share the server's clock-in instant (rules check it).
  const first = writeBatch(db)
  first.set(ref, {
    branchId: me.branchId,
    employeeId: me.id,
    employeeName: me.name,
    dateKey: target.dateKey,
    shiftId: shift?.id ?? null,
    shiftStart: shift?.start ?? null,
    shiftEnd: shift?.end ?? null,
    shiftStartAt: startAt ? Timestamp.fromDate(startAt) : null,
    shiftEndAt:
      startAt && shift ? Timestamp.fromDate(shiftEndFrom(startAt, shift.start, shift.end)) : null,
    clockInAt: serverTimestamp(),
    clockOutAt: null,
    workedMinutes: null,
    lateMinutes: 0,
    status: 'pending',
    source: 'web',
    correctedBy: null,
    clockInLocation: location,
    photo: capture.photo !== null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (capture.photo)
    first.set(doc(photos, ref.id), {
      branchId: me.branchId,
      employeeId: me.id,
      dateKey: target.dateKey,
      image: capture.photo,
      takenAt: serverTimestamp(),
    })
  await first.commit()

  const saved = fromDoc<Attendance>(await getDocFromServer(ref))
  const { status, lateMinutes } = resolveAttendance(saved, branch.rules.attendance)
  const batch = writeBatch(db)
  batch.update(ref, { status, lateMinutes, updatedAt: serverTimestamp() })
  addActivity(batch, actor, {
    action: 'clock_in',
    summary:
      status === 'late'
        ? `${me.name} clocked in ${lateMinutes} min late`
        : `${me.name} clocked in on time`,
    entity: entity(ref.id),
  })
  if (status === 'late')
    addNotification(batch, actor, branch, {
      type: 'late_arrival',
      tone: 'warning',
      title: 'Late arrival',
      body: `${me.name} arrived ${lateMinutes} minutes late.`,
      entity: entity(ref.id),
    })
  if (location?.inside === false && location.distance !== null)
    addNotification(batch, actor, branch, {
      type: 'clock_in_away',
      tone: 'warning',
      title: 'Clock-in away from the shop',
      body: `${me.name} clocked in ${awayText(location.distance / 1000)} from the shop.`,
      entity: entity(ref.id),
    })
  await batch.commit()
  return { ...saved, status, lateMinutes }
}

export interface ClockOutCapture {
  location: GeoFix | null
  /** Optional, when leaving before the shift ends ("feeling unwell"). */
  reason: string | null
}

/**
 * Clock out, in two checked writes: server time (+ location, reason) first, then the worked
 * minutes and early-leave minutes that rules recompute exactly, with the activity entry and,
 * when leaving early, the manager's notification.
 */
export async function clockOut(
  record: Attendance,
  branch: Branch,
  actor: SessionUser,
  capture: ClockOutCapture,
): Promise<{ earlyLeaveMinutes: number }> {
  const ref = doc(attendance, record.id)
  const reason = capture.reason?.trim().slice(0, 200) || null
  await updateDoc(ref, {
    clockOutAt: serverTimestamp(),
    clockOutLocation: capture.location ? toClockLocation(capture.location, branch.location) : null,
    earlyLeaveReason: reason,
    updatedAt: serverTimestamp(),
  })
  const saved = fromDoc<Attendance>(await getDocFromServer(ref))
  const out = saved.clockOutAt ?? new Date()
  const worked = saved.clockInAt ? workedMinutes(saved.clockInAt, out) : 0
  const early = earlyLeaveMinutes(saved.shiftEndAt, out, branch.rules.attendance)
  const batch = writeBatch(db)
  batch.update(ref, {
    workedMinutes: worked,
    earlyLeaveMinutes: early,
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'clock_out',
    summary: `${record.employeeName} clocked out after ${formatMinutes(worked)}${early ? ` (${formatMinutes(early)} early)` : ''}`,
    entity: entity(ref.id),
  })
  if (early > 0)
    addNotification(batch, actor, branch, {
      type: 'early_leave',
      tone: 'warning',
      title: 'Left early',
      body: `${record.employeeName} clocked out ${formatMinutes(early)} before the shift ended${reason ? ` (${reason})` : ''}.`,
      entity: entity(ref.id),
    })
  await batch.commit()
  return { earlyLeaveMinutes: early }
}

/** The live photo taken at clock-in (one read, when the manager opens it). */
export async function getAttendancePhoto(recordId: string): Promise<AttendancePhoto | null> {
  const snap = await getDoc(doc(photos, recordId))
  return snap.exists() ? fromDoc<AttendancePhoto>(snap) : null
}

export const PHOTO_RETENTION_DAYS = 90

/** Daily automation: deletes clock-in photos older than 90 days (privacy; keeps storage free). */
export async function deleteOldPhotos(branchId: string): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - PHOTO_RETENTION_DAYS * 86_400_000)
  const snap = await getDocs(
    query(photos, where('branchId', '==', branchId), where('takenAt', '<', cutoff), limit(450)),
  )
  if (snap.empty) return 0
  const batch = writeBatch(db)
  for (const d of snap.docs) batch.delete(d.ref)
  await batch.commit()
  return snap.size
}

export interface Correction {
  employee: User
  dateKey: string
  shift: Shift | null
  shiftStartAt: Date | null
  status: AttendanceStatus
  clockInAt: Date | null
  clockOutAt: Date | null
  /** True when a record already exists for that day (keeps its createdAt). */
  existing: boolean
}

/**
 * Manager records leave / off / absent or fixes times. Late minutes and worked time are
 * recalculated with the shared rules; the change is logged in the activity feed.
 */
export async function saveCorrection(
  c: Correction,
  branch: Branch,
  actor: SessionUser,
): Promise<void> {
  const present = c.status === 'on_time' || c.status === 'late'
  if (present && !c.clockInAt) throw new Error('Enter the clock-in time.')
  if (c.clockInAt && c.clockOutAt && c.clockOutAt <= c.clockInAt)
    throw new Error('Clock-out must be after clock-in.')

  const classified =
    present && c.clockInAt && c.shiftStartAt
      ? classifyClockIn(c.shiftStartAt, c.clockInAt, branch.rules.attendance)
      : { status: c.status, lateMinutes: 0 }
  const shiftEndAt =
    c.shiftStartAt && c.shift ? shiftEndFrom(c.shiftStartAt, c.shift.start, c.shift.end) : null
  const early =
    present && c.clockOutAt
      ? earlyLeaveMinutes(shiftEndAt, c.clockOutAt, branch.rules.attendance)
      : 0
  const ref = doc(attendance, recordId(c.employee.id, c.dateKey))
  const batch = writeBatch(db)
  batch.set(
    ref,
    {
      branchId: c.employee.branchId,
      employeeId: c.employee.id,
      employeeName: c.employee.name,
      dateKey: c.dateKey,
      shiftId: c.shift?.id ?? null,
      shiftStart: c.shift?.start ?? null,
      shiftEnd: c.shift?.end ?? null,
      shiftStartAt: c.shiftStartAt ? Timestamp.fromDate(c.shiftStartAt) : null,
      shiftEndAt: shiftEndAt ? Timestamp.fromDate(shiftEndAt) : null,
      earlyLeaveMinutes: early,
      clockInAt: present && c.clockInAt ? Timestamp.fromDate(c.clockInAt) : null,
      clockOutAt: present && c.clockOutAt ? Timestamp.fromDate(c.clockOutAt) : null,
      workedMinutes:
        present && c.clockInAt && c.clockOutAt ? workedMinutes(c.clockInAt, c.clockOutAt) : null,
      lateMinutes: classified.lateMinutes,
      status: present ? classified.status : c.status,
      source: 'manager',
      correctedBy: actor.uid,
      updatedAt: serverTimestamp(),
      ...(c.existing ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
  addActivity(batch, actor, {
    action: 'attendance_corrected',
    summary: `${actor.name} set ${c.employee.name}'s attendance on ${c.dateKey} to ${(present ? classified.status : c.status).replace('_', ' ')}`,
    entity: entity(ref.id),
  })
  await batch.commit()
}
