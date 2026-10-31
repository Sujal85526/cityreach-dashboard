import {
  addDays,
  COLLECTIONS,
  DEFAULT_REMIND_DAYS,
  expiryState,
  REMIND_DAYS_OPTIONS,
  toDateKey,
  type Branch,
  DOCUMENT_CHUNK_BYTES,
  documentDetailsSchema,
  MAX_DOCUMENT_BYTES,
  MAX_UPLOAD_BYTES,
  type DocumentDetails,
  type StoredDocument,
} from '@cityreach/shared'
import {
  Bytes,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@/lib/store'
import type { SessionUser } from '@/features/auth/api'
import { addActivity } from '@/lib/activity'
import { db } from '@/lib/store'
import { fromDoc } from '@/lib/firestore'
import { formatDate } from '@/lib/format'
import { addNotification } from '@/lib/notify'
import { formatBytes, pack, unpack } from './compress'

const documents = collection(db, COLLECTIONS.documents)
const chunks = collection(db, COLLECTIONS.documentChunks)
const chunkId = (documentId: string, index: number) => `${documentId}_${index}`
const entity = (id: string) => ({ collection: COLLECTIONS.documents, id })

/** Every document in the branch, newest first (details only; files load when opened). */
export async function listDocuments(branchId: string): Promise<StoredDocument[]> {
  const snap = await getDocs(
    query(documents, where('branchId', '==', branchId), orderBy('createdAt', 'desc'), limit(500)),
  )
  return snap.docs.map((d) => fromDoc<StoredDocument>(d))
}

/** Details as entered, plus the linked employee's name (copied so lists don't need a lookup). */
export type DocumentInput = DocumentDetails & { employeeName: string | null }

export interface Upload extends DocumentInput {
  file: File
}

/**
 * Compresses the file in the browser and stores it in pieces, together with its details and the
 * activity entry, in one batch. Refuses files still over 1 MB after compression (the demo keeps files in browser storage).
 */
export async function uploadDocument(
  input: Upload,
  actor: SessionUser,
): Promise<{ originalSize: number; storedSize: number }> {
  const details = documentDetailsSchema.parse(input)
  if (input.file.size > MAX_UPLOAD_BYTES)
    throw new Error(`That file is ${formatBytes(input.file.size)}. Pick one under 8 MB.`)
  const packed = await pack(input.file)
  if (packed.bytes.length > MAX_DOCUMENT_BYTES)
    throw new Error(
      `Even compressed it's ${formatBytes(packed.bytes.length)}; the demo limit is 1 MB. Try a smaller file.`,
    )

  const ref = doc(documents)
  const chunkCount = Math.max(1, Math.ceil(packed.bytes.length / DOCUMENT_CHUNK_BYTES))
  const batch = writeBatch(db)
  batch.set(ref, {
    branchId: actor.access.branchId,
    ...details,
    employeeName: details.employeeId ? input.employeeName : null,
    fileName: packed.fileName,
    mimeType: packed.mimeType,
    originalSize: input.file.size,
    storedSize: packed.bytes.length,
    encoding: packed.encoding,
    chunkCount,
    uploadedBy: actor.uid,
    uploadedByName: actor.name,
    remindedFor: null,
    expiredNotifiedFor: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  for (let i = 0; i < chunkCount; i++)
    batch.set(doc(chunks, chunkId(ref.id, i)), {
      branchId: actor.access.branchId,
      documentId: ref.id,
      index: i,
      data: Bytes.fromUint8Array(
        packed.bytes.subarray(i * DOCUMENT_CHUNK_BYTES, (i + 1) * DOCUMENT_CHUNK_BYTES),
      ),
    })
  addActivity(batch, actor, {
    action: 'document_uploaded',
    summary: `${actor.name} added the document "${details.name}"`,
    entity: entity(ref.id),
  })
  await batch.commit()
  return { originalSize: input.file.size, storedSize: packed.bytes.length }
}

/** Fetches the pieces in parallel and rebuilds the original file. */
export async function loadDocumentFile(d: StoredDocument): Promise<Blob> {
  const parts = await Promise.all(
    Array.from({ length: d.chunkCount }, (_, i) => getDoc(doc(chunks, chunkId(d.id, i)))),
  )
  const bytes = new Uint8Array(d.storedSize)
  let at = 0
  for (const part of parts) {
    if (!part.exists()) throw new Error('Part of this file is missing. Upload it again.')
    const piece = (part.get('data') as Bytes).toUint8Array()
    bytes.set(piece, at)
    at += piece.length
  }
  return unpack(bytes, d)
}

export async function updateDocumentDetails(
  d: StoredDocument,
  input: DocumentInput,
  actor: SessionUser,
): Promise<void> {
  const details = documentDetailsSchema.parse(input)
  const batch = writeBatch(db)
  // A new expiry date (e.g. the license was renewed) gets its own reminders.
  const renewed = (details.expiresOn ?? null) !== (d.expiresOn ?? null)
  batch.update(doc(documents, d.id), {
    ...details,
    employeeName: details.employeeId ? input.employeeName : null,
    ...(renewed ? { remindedFor: null, expiredNotifiedFor: null } : {}),
    updatedAt: serverTimestamp(),
  })
  addActivity(batch, actor, {
    action: 'document_updated',
    summary: `${actor.name} updated the document "${details.name}"`,
    entity: entity(d.id),
  })
  await batch.commit()
}

/** Deletes the details and every piece of the file in one batch. */
export async function deleteDocument(d: StoredDocument, actor: SessionUser): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(documents, d.id))
  for (let i = 0; i < d.chunkCount; i++) batch.delete(doc(chunks, chunkId(d.id, i)))
  addActivity(batch, actor, {
    action: 'document_deleted',
    summary: `${actor.name} deleted the document "${d.name}"`,
    entity: null,
  })
  await batch.commit()
}

const longestWindow = Math.max(...REMIND_DAYS_OPTIONS)
/** "Ahmed Hassan's " for staff papers, nothing for shop documents. */
const whose = (d: StoredDocument) => (d.employeeName ? `${d.employeeName}'s ` : '')
const localDate = (dateKey: string) => formatDate(new Date(`${dateKey}T12:00:00`))

/**
 * Automation (manager's app): one notification when a document enters its reminder window and one
 * when it expires, each sent once per expiry date (the marker is saved on the document).
 * Example: premises licence expires 15 Jan, remind 30 days before → "expires in 30 days" on 16 Dec,
 * "has expired" on 16 Jan.
 */
export async function checkDocumentExpiry(branch: Branch, actor: SessionUser): Promise<number> {
  const today = toDateKey(new Date(), branch.rules.timeZone)
  const snap = await getDocs(
    query(
      documents,
      where('branchId', '==', branch.id),
      where('expiresOn', '<=', addDays(today, longestWindow)),
    ),
  )
  const batch = writeBatch(db)
  let sent = 0
  for (const s of snap.docs) {
    const d = fromDoc<StoredDocument>(s)
    if (!d.expiresOn) continue
    const state = expiryState(d.expiresOn, today, d.remindDaysBefore ?? DEFAULT_REMIND_DAYS)
    if (state === 'expired' && d.expiredNotifiedFor !== d.expiresOn) {
      batch.update(s.ref, { expiredNotifiedFor: d.expiresOn, remindedFor: d.expiresOn })
      addNotification(batch, actor, branch, {
        type: 'document_expiry',
        tone: 'danger',
        title: 'Document expired',
        body: `${whose(d)}${d.name} expired on ${localDate(d.expiresOn)}.`,
        entity: entity(d.id),
      })
      sent++
    } else if (state === 'expiring_soon' && d.remindedFor !== d.expiresOn) {
      batch.update(s.ref, { remindedFor: d.expiresOn })
      addNotification(batch, actor, branch, {
        type: 'document_expiry',
        tone: 'warning',
        title: 'Document expiring soon',
        body: `${whose(d)}${d.name} expires on ${localDate(d.expiresOn)}.`,
        entity: entity(d.id),
      })
      sent++
    }
  }
  if (sent) await batch.commit()
  return sent
}
