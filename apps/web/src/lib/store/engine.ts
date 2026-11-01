import { clone, deserialize, isPlainObject, isSentinel, serialize, Timestamp } from './values'

/**
 * The in-memory data of the demo, persisted to localStorage. Collections are flat maps of
 * documents; every write goes through `commit`, which applies a whole batch at once and then
 * tells the live listeners.
 */
export type Doc = Record<string, unknown>
type Collections = Record<string, Record<string, Doc>>
export type WriteOp =
  | { type: 'set'; collection: string; id: string; data: Doc; merge: boolean }
  | { type: 'update'; collection: string; id: string; data: Doc }
  | { type: 'delete'; collection: string; id: string }

const STORAGE_KEY = 'cityreach-demo-data'
/** Bump when the seed or document shapes change, so browsers holding older demo data start fresh. */
const SEED_VERSION = 5

let data: Collections = {}
let loaded = false
let seeder: (() => Collections) | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<(changed: Set<string>) => void>()

/** The seed is registered once at start-up (see lib/store/seed) so this file has no data in it. */
export function registerSeed(build: () => Collections) {
  seeder = build
}

interface Persisted {
  version: number
  seededOn: string
  data: Collections
}
const today = () => new Date().toISOString().slice(0, 10)

function save() {
  try {
    const payload: Persisted = { version: SEED_VERSION, seededOn, data }
    localStorage.setItem(STORAGE_KEY, serialize(payload))
  } catch {
    // Storage full or blocked: the demo keeps working from memory until the tab closes.
  }
}

function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    save()
  }, 150)
}

/** Writes a save that is still waiting, so a reload or tab close right after a change loses nothing. */
function flush() {
  if (saveTimer === undefined) return
  clearTimeout(saveTimer)
  saveTimer = undefined
  save()
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
}

let seededOn = today()

function ensureLoaded() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = deserialize<Persisted>(raw)
      // Sample dates are relative to the day the data was created; refresh it daily.
      if (parsed.version === SEED_VERSION && parsed.seededOn === today()) {
        data = parsed.data
        seededOn = parsed.seededOn
        return
      }
    }
  } catch {
    // Corrupt or blocked storage: start from the seed.
  }
  reset(false)
}

/** Replaces everything with freshly seeded demo data. */
export function reset(notify = true) {
  if (!seeder) throw new Error('Demo data seed is not registered')
  data = seeder()
  seededOn = today()
  loaded = true
  persist()
  if (notify) for (const l of listeners) l(new Set(Object.keys(data)))
}

export function readDoc(collection: string, id: string): Doc | undefined {
  ensureLoaded()
  const found = data[collection]?.[id]
  return found ? clone(found) : undefined
}

export function readCollection(collection: string): [string, Doc][] {
  ensureLoaded()
  return Object.entries(data[collection] ?? {}).map(([id, d]) => [id, clone(d)])
}

export function subscribe(listener: (changed: Set<string>) => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

function setPath(target: Doc, path: string, value: unknown) {
  const keys = path.split('.')
  let node = target
  for (const key of keys.slice(0, -1)) {
    const next = node[key]
    if (!isPlainObject(next)) node[key] = {}
    node = node[key] as Doc
  }
  const last = keys[keys.length - 1] as string
  if (isSentinel(value) && value.transform.kind === 'delete') delete node[last]
  else node[last] = resolve(value, node[last])
}

/** Replaces transform markers (server time, array union, increment) with real values. */
function resolve(value: unknown, current: unknown): unknown {
  if (isSentinel(value)) {
    const t = value.transform
    if (t.kind === 'serverTimestamp') return Timestamp.now()
    if (t.kind === 'increment') return (typeof current === 'number' ? current : 0) + t.by
    if (t.kind === 'arrayUnion') {
      const base = Array.isArray(current) ? current : []
      const known = new Set(base.map((x) => JSON.stringify(x)))
      return [...base, ...t.items.filter((x) => !known.has(JSON.stringify(x))).map(clone)]
    }
    return undefined
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, undefined))
  if (isPlainObject(value))
    return Object.fromEntries(
      Object.entries(value)
        .map(([k, v]) => [k, resolve(v, isPlainObject(current) ? current[k] : undefined)] as const)
        .filter(([, v]) => v !== undefined),
    )
  return clone(value)
}

function apply(op: WriteOp) {
  const docs = (data[op.collection] ??= {})
  if (op.type === 'delete') {
    delete docs[op.id]
    return
  }
  const existing = docs[op.id]
  if (op.type === 'update') {
    if (!existing) throw new Error(`No document to update: ${op.collection}/${op.id}`)
    for (const [path, value] of Object.entries(op.data)) setPath(existing, path, value)
    return
  }
  const fresh = resolve(op.data, undefined) as Doc
  docs[op.id] = op.merge && existing ? mergeDeep(existing, op.data) : fresh
}

function mergeDeep(base: Doc, patch: Doc): Doc {
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    out[k] =
      isPlainObject(v) && isPlainObject(base[k]) ? mergeDeep(base[k], v) : resolve(v, base[k])
  }
  return out
}

/** Applies all writes together (all or nothing), saves, and notifies listeners once. */
export function commit(ops: WriteOp[]) {
  ensureLoaded()
  const snapshot = clone(data)
  try {
    for (const op of ops) apply(op)
  } catch (error) {
    data = snapshot
    throw error
  }
  persist()
  const changed = new Set(ops.map((o) => o.collection))
  for (const l of listeners) l(changed)
}

/** Small artificial delay so loading states are visible and writes feel like real requests. */
export const latency = (ms = 70) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms + Math.random() * 60))
