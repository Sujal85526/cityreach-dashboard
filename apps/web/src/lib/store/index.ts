/**
 * A small document-database API (collections, documents, queries, batches, transactions, live
 * listeners) backed by the in-memory demo store. Feature `api.ts` files use it the way they
 * would use any document database, so UI -> queries -> api stays as is while nothing leaves the
 * browser.
 */
import {
  commit,
  latency,
  readCollection,
  readDoc,
  reset as resetEngine,
  subscribe,
  type Doc,
  type WriteOp,
} from './engine'
import { clone, compareValues, Timestamp } from './values'

export { arrayUnion, Bytes, deleteField, increment, serverTimestamp, Timestamp } from './values'
export { registerSeed } from './engine'

export const db = { kind: 'local-store' } as const
type Db = typeof db

export interface CollectionReference {
  readonly type: 'collection'
  readonly id: string
}
export interface DocumentReference {
  readonly type: 'document'
  readonly id: string
  readonly parent: CollectionReference
  readonly path: string
}

export function collection(_db: Db, name: string): CollectionReference {
  return { type: 'collection', id: name }
}

let counter = 0
const newId = () =>
  `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function doc(parent: Db | CollectionReference, ...path: string[]): DocumentReference {
  const [col, id] = 'type' in parent ? [parent, path[0]] : [collection(parent, path[0] as string), path[1]]
  const docId = id ?? newId()
  return { type: 'document', id: docId, parent: col, path: `${col.id}/${docId}` }
}

/* ---------- snapshots ---------- */

export class DocumentSnapshot {
  readonly ref: DocumentReference
  private readonly value: Doc | undefined
  constructor(ref: DocumentReference, value: Doc | undefined) {
    this.ref = ref
    this.value = value
  }
  get id() {
    return this.ref.id
  }
  exists() {
    return this.value !== undefined
  }
  data(_options?: { serverTimestamps?: 'estimate' | 'previous' | 'none' }): Doc | undefined {
    return this.value ? clone(this.value) : undefined
  }
  get(field: string): unknown {
    return field.split('.').reduce<unknown>((node, key) => (node as Doc | undefined)?.[key], this.value)
  }
}

export class QuerySnapshot {
  readonly docs: DocumentSnapshot[]
  constructor(docs: DocumentSnapshot[]) {
    this.docs = docs
  }
  get empty() {
    return this.docs.length === 0
  }
  get size() {
    return this.docs.length
  }
  forEach(fn: (d: DocumentSnapshot) => void) {
    this.docs.forEach(fn)
  }
}

/* ---------- queries ---------- */

type Op = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains' | 'array-contains-any'
export type QueryConstraint =
  | { type: 'where'; field: string; op: Op; value: unknown }
  | { type: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { type: 'limit'; n: number }
export interface Query {
  readonly type: 'query'
  readonly collection: CollectionReference
  readonly constraints: QueryConstraint[]
}

export const where = (field: string, op: Op, value: unknown): QueryConstraint => ({
  type: 'where',
  field,
  op,
  value,
})
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint => ({
  type: 'orderBy',
  field,
  dir,
})
export const limit = (n: number): QueryConstraint => ({ type: 'limit', n })

export function query(source: CollectionReference | Query, ...constraints: QueryConstraint[]): Query {
  return source.type === 'query'
    ? { ...source, constraints: [...source.constraints, ...constraints] }
    : { type: 'query', collection: source, constraints }
}

const fieldOf = (d: Doc, field: string) =>
  field.split('.').reduce<unknown>((node, key) => (node as Doc | undefined)?.[key], d)
// Query values may be Dates; stored values are Timestamps.
const norm = (v: unknown) => (v instanceof Date ? Timestamp.fromDate(v) : v)

function matches(d: Doc, c: Extract<QueryConstraint, { type: 'where' }>) {
  const actual = fieldOf(d, c.field)
  const expected = norm(c.value)
  const cmp = () => compareValues(actual, expected)
  switch (c.op) {
    case '==':
      return actual !== undefined && cmp() === 0
    case '!=':
      return actual !== undefined && cmp() !== 0
    case '<':
      return actual != null && cmp() < 0
    case '<=':
      return actual != null && cmp() <= 0
    case '>':
      return actual != null && cmp() > 0
    case '>=':
      return actual != null && cmp() >= 0
    case 'in':
      return (expected as unknown[]).some((v) => compareValues(actual, norm(v)) === 0 && actual !== undefined)
    case 'not-in':
      return !(expected as unknown[]).some((v) => compareValues(actual, norm(v)) === 0)
    case 'array-contains':
      return Array.isArray(actual) && actual.some((v) => compareValues(v, expected) === 0)
    case 'array-contains-any':
      return (
        Array.isArray(actual) &&
        (expected as unknown[]).some((e) => actual.some((v) => compareValues(v, norm(e)) === 0))
      )
  }
}

function run(q: Query): DocumentSnapshot[] {
  let rows = readCollection(q.collection.id)
  const orders = q.constraints.filter((c) => c.type === 'orderBy')
  for (const c of q.constraints) if (c.type === 'where') rows = rows.filter(([, d]) => matches(d, c))
  // Documents missing an ordered field are left out, as in a document database.
  for (const o of orders) rows = rows.filter(([, d]) => fieldOf(d, o.field) !== undefined)
  rows.sort(([ia, a], [ib, b]) => {
    for (const o of orders) {
      const r = compareValues(fieldOf(a, o.field), fieldOf(b, o.field))
      if (r !== 0) return o.dir === 'desc' ? -r : r
    }
    return ia < ib ? -1 : ia > ib ? 1 : 0
  })
  const cap = q.constraints.find((c) => c.type === 'limit')
  if (cap) rows = rows.slice(0, cap.n)
  return rows.map(([id, d]) => new DocumentSnapshot(doc(q.collection, id), d))
}

/* ---------- reads ---------- */

export async function getDoc(ref: DocumentReference) {
  await latency()
  return new DocumentSnapshot(ref, readDoc(ref.parent.id, ref.id))
}
export const getDocFromServer = getDoc

export async function getDocs(q: Query | CollectionReference) {
  await latency()
  return new QuerySnapshot(run(query(q)))
}

export async function getCountFromServer(q: Query) {
  await latency(30)
  return { data: () => ({ count: run(q).length }) }
}

/** Live listener: calls back now and after every write to the collection. */
export function onSnapshot(
  source: Query | CollectionReference,
  onNext: (snap: QuerySnapshot) => void,
  onError?: (error: Error) => void,
) {
  const q = query(source)
  const emit = () => {
    try {
      onNext(new QuerySnapshot(run(q)))
    } catch (error) {
      onError?.(error as Error)
    }
  }
  const timer = setTimeout(emit, 40)
  const stop = subscribe((changed) => {
    if (changed.has(q.collection.id)) emit()
  })
  return () => {
    clearTimeout(timer)
    stop()
  }
}

/* ---------- writes ---------- */

export interface WriteBatch {
  set(ref: DocumentReference, data: Doc, options?: { merge?: boolean }): WriteBatch
  update(ref: DocumentReference, data: Doc): WriteBatch
  delete(ref: DocumentReference): WriteBatch
  commit(): Promise<void>
}

export function writeBatch(_db: Db): WriteBatch {
  const ops: WriteOp[] = []
  const batch: WriteBatch = {
    set(ref, data, options) {
      ops.push({ type: 'set', collection: ref.parent.id, id: ref.id, data, merge: options?.merge ?? false })
      return batch
    },
    update(ref, data) {
      ops.push({ type: 'update', collection: ref.parent.id, id: ref.id, data })
      return batch
    },
    delete(ref) {
      ops.push({ type: 'delete', collection: ref.parent.id, id: ref.id })
      return batch
    },
    async commit() {
      await latency(40)
      commit(ops)
    },
  }
  return batch
}

export const updateDoc = (ref: DocumentReference, data: Doc) => writeBatch(db).update(ref, data).commit()
export const setDoc = (ref: DocumentReference, data: Doc, options?: { merge?: boolean }) =>
  writeBatch(db).set(ref, data, options).commit()
export const deleteDoc = (ref: DocumentReference) => writeBatch(db).delete(ref).commit()

export interface Transaction {
  get(ref: DocumentReference): Promise<DocumentSnapshot>
  set(ref: DocumentReference, data: Doc, options?: { merge?: boolean }): Transaction
  update(ref: DocumentReference, data: Doc): Transaction
  delete(ref: DocumentReference): Transaction
}

/** Runs `fn`, then applies its writes together. The store is single-threaded, so no retries. */
export async function runTransaction<T>(_db: Db, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  await latency(40)
  const batch = writeBatch(db)
  const tx: Transaction = {
    get: async (ref) => new DocumentSnapshot(ref, readDoc(ref.parent.id, ref.id)),
    set: (ref, data, options) => (batch.set(ref, data, options), tx),
    update: (ref, data) => (batch.update(ref, data), tx),
    delete: (ref) => (batch.delete(ref), tx),
  }
  const result = await fn(tx)
  await batch.commit()
  return result
}

/** Wipes the demo and writes the seed again. */
export const resetDemoData = () => resetEngine(true)
