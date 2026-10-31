/**
 * Emulator seed for the later modules (leave & pay, documents), so the dashboard's "Needs your
 * attention", the calendar, payslips and employee documents have something to show locally.
 * Runs after the main seed; emulator only.
 */
import { addDays, COLLECTIONS, DEFAULT_LEAVE_TYPES } from '@cityreach/shared'
import { bytesOf, type SeedDb } from './adapter'

const SALARIES: Record<string, [salary: number, allowances: number]> = {
  maya: [3000, 500],
  jamal: [3200, 500],
  sofia: [3000, 400],
  ella: [2800, 400],
  priya: [2800, 400],
  noah: [3000, 500],
  liam: [4200, 800],
  tomas: [2500, 300],
}

const typeName = (id: string) => DEFAULT_LEAVE_TYPES.find((t) => t.id === id)?.name ?? id
const range = (from: string, days: number) =>
  Array.from({ length: days }, (_, i) => addDays(from, i))

export function seedExtras(
  db: SeedDb,
  branchId: string,
  today: string,
  names: Record<string, string>,
) {
  const now = new Date()
  const stamp = { createdAt: now, updatedAt: now }
  const writer = db.bulkWriter()

  for (const [uid, [salary, allowances]] of Object.entries(SALARIES))
    writer.update(db.collection(COLLECTIONS.users).doc(uid), { salary, allowances })

  const leave = (
    id: string,
    uid: string,
    typeId: string,
    dates: string[],
    status: 'pending' | 'approved',
    reason: string,
  ) => {
    writer.set(db.collection(COLLECTIONS.leaveRequests).doc(id), {
      branchId,
      employeeId: uid,
      employeeName: names[uid],
      typeId,
      typeName: typeName(typeId),
      from: dates[0],
      to: dates.at(-1),
      dates,
      reason,
      status,
      paidDays: status === 'approved' ? dates.length : null,
      decidedBy: status === 'approved' ? 'amara' : null,
      decidedByName: status === 'approved' ? 'Amara Okafor' : null,
      decidedAt: status === 'approved' ? now : null,
      managerComment: null,
      ...stamp,
    })
    if (status === 'approved')
      for (const dateKey of dates)
        writer.set(db.collection(COLLECTIONS.attendance).doc(`${uid}_${dateKey}`), {
          branchId,
          employeeId: uid,
          employeeName: names[uid],
          dateKey,
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
          correctedBy: 'amara',
          leaveTypeId: typeId,
          leavePaid: true,
          leaveRequestId: id,
          ...stamp,
        })
  }
  leave('seed-leave-1', 'noah', 'annual', range(addDays(today, 5), 3), 'pending', 'Family visit')
  leave('seed-leave-2', 'ella', 'emergency', [addDays(today, 1)], 'pending', 'Family matter')
  leave('seed-leave-3', 'jamal', 'annual', range(addDays(today, 9), 4), 'approved', 'Holiday')
  leave('seed-leave-4', 'sofia', 'sick', [addDays(today, 2)], 'approved', 'Doctor appointment')

  const document = (
    id: string,
    name: string,
    category: string,
    expiresIn: number | null,
    employee?: string,
  ) => {
    const text = `Sample document: ${name}`
    const data = bytesOf(text)
    writer.set(db.collection(COLLECTIONS.documents).doc(id), {
      branchId,
      name,
      category,
      note: '',
      fileName: 'sample.txt',
      mimeType: 'text/plain',
      originalSize: text.length,
      storedSize: text.length,
      encoding: 'none',
      chunkCount: 1,
      uploadedBy: 'amara',
      uploadedByName: 'Amara Okafor',
      employeeId: employee ?? null,
      employeeName: employee ? names[employee] : null,
      expiresOn: expiresIn === null ? null : addDays(today, expiresIn),
      remindDaysBefore: 30,
      remindedFor: null,
      expiredNotifiedFor: null,
      ...stamp,
    })
    writer.set(db.collection(COLLECTIONS.documentChunks).doc(`${id}_0`), {
      branchId,
      documentId: id,
      index: 0,
      data,
    })
  }
  document('seed-doc-1', 'Trade license', 'License', 18)
  document('seed-doc-2', 'Shop insurance', 'Insurance', 200)
  document('seed-doc-3', 'Tenancy contract', 'Contract', 120)
  document('seed-doc-4', 'Visa', 'Visa', 25, 'maya')
  document('seed-doc-5', 'Passport', 'Passport', -2, 'liam')
  document('seed-doc-6', 'Emirates ID', 'Emirates ID', 400, 'tomas')

  writer.close()
}
