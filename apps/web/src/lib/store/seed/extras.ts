/**
 * Demo documents (licences, certificates, insurance, staff papers) with their expiry dates, so the
 * Documents page, the calendar and the dashboard's "Needs your attention" have something to show.
 * Runs after the main seed.
 */
import { addDays, COLLECTIONS } from '@cityreach/shared'
import { bytesOf, type SeedDb } from './adapter'

export function seedExtras(
  db: SeedDb,
  branchId: string,
  today: string,
  names: Record<string, string>,
) {
  const now = new Date()
  const writer = db.bulkWriter()

  const document = (
    id: string,
    name: string,
    category: string,
    expiresIn: number | null,
    uploadedDaysAgo: number,
    note: string,
    employee?: string,
  ) => {
    const text = `Sample document: ${name}`
    const data = bytesOf(text)
    const uploaded = new Date(now.getTime() - uploadedDaysAgo * 86_400_000)
    const expiresOn = expiresIn === null ? null : addDays(today, expiresIn)
    // Documents already inside their reminder window are marked as notified, so the daily check
    // doesn't repeat the notification the seed already shows.
    const soon = expiresIn !== null && expiresIn <= 30
    writer.set(db.collection(COLLECTIONS.documents).doc(id), {
      branchId,
      name,
      category,
      note,
      fileName: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
      mimeType: 'text/plain',
      originalSize: text.length,
      storedSize: text.length,
      encoding: 'none',
      chunkCount: 1,
      uploadedBy: 'amara',
      uploadedByName: 'Amara Okafor',
      employeeId: employee ?? null,
      employeeName: employee ? names[employee] : null,
      expiresOn,
      remindDaysBefore: 30,
      remindedFor: soon ? expiresOn : null,
      expiredNotifiedFor: null,
      createdAt: uploaded,
      updatedAt: uploaded,
    })
    writer.set(db.collection(COLLECTIONS.documentChunks).doc(`${id}_0`), {
      branchId,
      documentId: id,
      index: 0,
      data,
    })
  }
  document('seed-doc-1', 'Food hygiene certificate (Level 2)', 'Certificate', 95, 270, 'Renew through the local council.')
  document('seed-doc-2', 'Public liability insurance', 'Insurance', 24, 340, 'Policy renews automatically; check the cover limit.')
  document('seed-doc-3', 'Gas safety certificate', 'Certificate', 17, 348, 'Book the annual check with the registered engineer.')
  document('seed-doc-4', 'Lease agreement: 22 Albion Street', 'Contract', 900, 600, 'Rent review due at the end of year two.')
  document('seed-doc-5', 'Premises licence', 'Licence', 330, 400, '')
  document('seed-doc-6', 'Passport', 'Passport', 1400, 210, '', 'maya')
  document('seed-doc-7', 'Right to work check', 'Right to work', 260, 60, 'Share code verified.', 'tomas')
  document('seed-doc-8', 'DBS check', 'DBS check', null, 500, 'Enhanced check, cleared.', 'liam')

  writer.close()
}
