import { z } from 'zod'

/**
 * Domain schemas use plain `Date` for instants so this package stays free of any
 * Firebase SDK. Repositories (server) and api.ts files (web) convert Timestamps.
 */

export const idSchema = z.string().min(1)
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm')

export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
})

/** Reference to another document, used by notifications and activity. */
export const entityRefSchema = z.object({
  collection: z.string(),
  id: idSchema,
})
export type EntityRef = z.infer<typeof entityRefSchema>
