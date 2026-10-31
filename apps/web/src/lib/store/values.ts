/**
 * Value types of the local document store: timestamps, binary data and the "field transform"
 * sentinels (server time, array union, increment). They mirror what the UI and the feature
 * `api.ts` files already expect from a document database.
 */

export class Timestamp {
  readonly seconds: number
  readonly nanoseconds: number
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }
  static now() {
    return Timestamp.fromMillis(Date.now())
  }
  static fromDate(date: Date) {
    return Timestamp.fromMillis(date.getTime())
  }
  static fromMillis(ms: number) {
    const seconds = Math.floor(ms / 1000)
    return new Timestamp(seconds, Math.round((ms - seconds * 1000) * 1e6))
  }
  toMillis() {
    return this.seconds * 1000 + Math.round(this.nanoseconds / 1e6)
  }
  toDate() {
    return new Date(this.toMillis())
  }
}

export class Bytes {
  private readonly data: Uint8Array
  private constructor(data: Uint8Array) {
    this.data = data
  }
  static fromUint8Array(data: Uint8Array) {
    return new Bytes(data.slice())
  }
  toUint8Array() {
    return this.data.slice()
  }
}

/** Markers resolved when a write is applied. */
export type FieldTransform =
  | { kind: 'serverTimestamp' }
  | { kind: 'arrayUnion'; items: unknown[] }
  | { kind: 'increment'; by: number }
  | { kind: 'delete' }

class Sentinel {
  readonly transform: FieldTransform
  constructor(transform: FieldTransform) {
    this.transform = transform
  }
}

export const serverTimestamp = () => new Sentinel({ kind: 'serverTimestamp' })
export const arrayUnion = (...items: unknown[]) => new Sentinel({ kind: 'arrayUnion', items })
export const increment = (by: number) => new Sentinel({ kind: 'increment', by })
export const deleteField = () => new Sentinel({ kind: 'delete' })

export const isSentinel = (v: unknown): v is Sentinel => v instanceof Sentinel
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  Object.getPrototypeOf(v) === Object.prototype

/** Deep copy that keeps Timestamp and Bytes instances intact and turns Dates into Timestamps. */
export function clone<T>(value: T): T {
  if (value instanceof Date) return Timestamp.fromDate(value) as T
  if (value instanceof Timestamp || value instanceof Bytes) return value
  if (Array.isArray(value)) return value.map(clone) as T
  if (isPlainObject(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) as T
  return value
}

const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** JSON form used for localStorage. */
export function serialize(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key, v: unknown) {
    const original = this[key]
    if (original instanceof Timestamp) return { __ts: original.toMillis() }
    if (original instanceof Bytes) return { __bytes: toBase64(original.toUint8Array()) }
    return v
  })
}

export function deserialize<T>(text: string): T {
  return JSON.parse(text, (_key, v: unknown) => {
    if (isPlainObject(v) && typeof v.__ts === 'number') return Timestamp.fromMillis(v.__ts)
    if (isPlainObject(v) && typeof v.__bytes === 'string')
      return Bytes.fromUint8Array(fromBase64(v.__bytes))
    return v
  }) as T
}

/** Orders two stored values the way a document database does (numbers, strings, times). */
export function compareValues(a: unknown, b: unknown): number {
  const x = a instanceof Timestamp ? a.toMillis() : a
  const y = b instanceof Timestamp ? b.toMillis() : b
  if (x === y) return 0
  if (x === null || x === undefined) return -1
  if (y === null || y === undefined) return 1
  if (typeof x === 'boolean' && typeof y === 'boolean') return Number(x) - Number(y)
  return (x as number | string) < (y as number | string) ? -1 : 1
}
