import { DocumentSnapshot, Timestamp } from '@/lib/store'

/** Recursively turns stored Timestamps into Dates (shared schemas use plain `Date`). */
function toDates(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate()
  if (Array.isArray(value)) return value.map(toDates)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toDates(v)]))
  }
  return value
}

/** Reads a snapshot as a domain object: `{ id, ...data }` with Timestamps converted to Dates. */
export function fromDoc<T>(snap: DocumentSnapshot): T {
  return { id: snap.id, ...(toDates(snap.data()) as object) } as T
}
