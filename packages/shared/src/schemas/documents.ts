import { z } from 'zod'
import { dateKeySchema, idSchema, timestampsSchema } from './common'

/**
 * The manager's private document store (licences, certificates, contracts, paperwork). There is no
 * file server in the demo, so a file is compressed in the browser and kept in the local store in pieces:
 * documents/{id} holds the details, documentChunks/{id}_{n} the bytes (each under 1 MiB).
 */
export const DOCUMENT_CATEGORIES = [
  'Licence',
  'Certificate',
  'Contract',
  'Insurance',
  'Invoice',
  'Passport',
  'Right to work',
  'DBS check',
  'Employment contract',
  'Staff',
  'CV',
  'Other',
] as const

/** Categories that belong to a person; the upload form asks which employee. */
export const EMPLOYEE_DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  'Passport',
  'Right to work',
  'DBS check',
  'Employment contract',
  'Staff',
]
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

/** Largest file after compression. */
export const MAX_DOCUMENT_BYTES = 1024 * 1024
/** Largest file accepted before compression (keeps the phone's memory safe). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
/** Bytes per piece; well under the 1 MiB document limit. */
export const DOCUMENT_CHUNK_BYTES = 750_000

/** How the stored bytes were packed: gzip (any file), jpeg (photo re-saved smaller) or as is. */
export const DOCUMENT_ENCODINGS = ['gzip', 'jpeg', 'none'] as const

export const documentSchema = z
  .object({
    id: idSchema,
    branchId: idSchema,
    name: z.string().min(1).max(120),
    category: z.enum(DOCUMENT_CATEGORIES),
    note: z.string().max(300),
    /** File name and type as downloaded (a re-saved photo becomes .jpg / image/jpeg). */
    fileName: z.string().min(1).max(200),
    mimeType: z.string().max(100),
    /** Size of the file the manager picked, and of what is stored. */
    originalSize: z.number().int().min(0),
    storedSize: z.number().int().min(0).max(MAX_DOCUMENT_BYTES),
    encoding: z.enum(DOCUMENT_ENCODINGS),
    chunkCount: z
      .number()
      .int()
      .min(1)
      .max(Math.ceil(MAX_DOCUMENT_BYTES / DOCUMENT_CHUNK_BYTES)),
    uploadedBy: idSchema,
    uploadedByName: z.string(),
    /** The employee this document belongs to (passport, right to work…); null = a shop document. */
    employeeId: idSchema.nullable().optional(),
    employeeName: z.string().nullable().optional(),
    /** Last valid day (local date); null = doesn't expire. */
    expiresOn: dateKeySchema.nullable().optional(),
    /** Remind the manager this many days before it expires. */
    remindDaysBefore: z.number().int().min(1).max(365).optional(),
    /** The expiry date the "expiring soon" / "expired" notification was already sent for. */
    remindedFor: dateKeySchema.nullable().optional(),
    expiredNotifiedFor: dateKeySchema.nullable().optional(),
  })
  .extend(timestampsSchema.shape)
export type StoredDocument = z.infer<typeof documentSchema>

/** What the manager can change after upload. */
export const documentDetailsSchema = documentSchema
  .pick({ name: true, category: true, note: true })
  .extend({
    employeeId: idSchema.nullable(),
    expiresOn: dateKeySchema.nullable(),
    remindDaysBefore: z.number().int().min(1).max(365),
  })
export type DocumentDetails = z.infer<typeof documentDetailsSchema>
