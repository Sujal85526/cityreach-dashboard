import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  arrayUnion,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  registerSeed,
  resetDemoData,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from './index'

const tasks = collection(db, 'tasks')

async function put(id: string, data: Record<string, unknown>) {
  await writeBatch(db).set(doc(tasks, id), data).commit()
}

beforeEach(() => {
  registerSeed(() => ({}))
  resetDemoData()
})

describe('local document store', () => {
  it('reads back what a batch wrote, with server time filled in', async () => {
    await put('a', { title: 'Open up', createdAt: serverTimestamp() })
    const snap = await getDoc(doc(tasks, 'a'))
    expect(snap.exists()).toBe(true)
    expect(snap.get('title')).toBe('Open up')
    expect(snap.get('createdAt')).toBeInstanceOf(Timestamp)
  })

  it('filters, orders and limits like a document query', async () => {
    await put('a', { branchId: 'x', n: 3 })
    await put('b', { branchId: 'x', n: 1 })
    await put('c', { branchId: 'y', n: 2 })
    await put('d', { branchId: 'x', n: 2 })
    const snap = await getDocs(query(tasks, where('branchId', '==', 'x'), orderBy('n', 'desc'), limit(2)))
    expect(snap.docs.map((d) => d.id)).toEqual(['a', 'd'])
  })

  it('supports in-filters and range filters on date keys', async () => {
    await put('a', { status: 'pending', dateKey: '2026-10-30' })
    await put('b', { status: 'done', dateKey: '2026-10-31' })
    await put('c', { status: 'late', dateKey: '2026-11-01' })
    const open = await getDocs(query(tasks, where('status', 'in', ['pending', 'late'])))
    expect(open.docs.map((d) => d.id).sort()).toEqual(['a', 'c'])
    const range = await getDocs(
      query(tasks, where('dateKey', '>=', '2026-10-31'), where('dateKey', '<=', '2026-10-31')),
    )
    expect(range.docs.map((d) => d.id)).toEqual(['b'])
  })

  it('applies a batch all or nothing', async () => {
    await put('a', { n: 1 })
    const batch = writeBatch(db)
    batch.update(doc(tasks, 'a'), { n: 2 })
    batch.update(doc(tasks, 'missing'), { n: 9 })
    await expect(batch.commit()).rejects.toThrow()
    expect((await getDoc(doc(tasks, 'a'))).get('n')).toBe(1)
  })

  it('updates nested fields and unions arrays', async () => {
    await put('a', { stats: { score: 1, pct: 90 }, notes: ['x'] })
    await writeBatch(db)
      .update(doc(tasks, 'a'), { 'stats.score': 5, notes: arrayUnion('y', 'x') })
      .commit()
    const snap = await getDoc(doc(tasks, 'a'))
    expect(snap.get('stats')).toEqual({ score: 5, pct: 90 })
    expect(snap.get('notes')).toEqual(['x', 'y'])
  })

  it('runs transactions: read, then write', async () => {
    await put('a', { quantity: 10 })
    await runTransaction(db, async (tx) => {
      const current = await tx.get(doc(tasks, 'a'))
      tx.update(doc(tasks, 'a'), { quantity: (current.get('quantity') as number) - 4 })
    })
    expect((await getDoc(doc(tasks, 'a'))).get('quantity')).toBe(6)
  })

  it('tells live listeners about later writes and stops after unsubscribe', async () => {
    const seen: number[] = []
    const stop = onSnapshot(query(tasks), (s) => seen.push(s.size))
    await vi.waitFor(() => expect(seen).toEqual([0]))
    await put('a', { n: 1 })
    expect(seen.at(-1)).toBe(1)
    stop()
    await put('b', { n: 2 })
    expect(seen.at(-1)).toBe(1)
  })
})
