import type { QueryClient } from '@tanstack/react-query'
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

/**
 * Keeps the signed-in user's query results on the device (IndexedDB), so pages show the last data
 * instantly on the next visit while fresh data loads. IndexedDB stores Dates as Dates (structured
 * clone), so nothing needs converting. One cache per user, wiped on sign-out; clock-in photos
 * (large, sensitive) are never kept. A new build starts with an empty cache.
 */
const BUSTER = import.meta.env.VITE_BUILD_ID ?? 'dev'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const NEVER_KEPT = new Set(['attendancePhoto'])

const persisterFor = (uid: string): Persister => {
  const key = `dm-cache-${uid}`
  return {
    persistClient: (client: PersistedClient) => set(key, client),
    restoreClient: () => get<PersistedClient>(key),
    removeClient: () => del(key),
  }
}

let stop: (() => void) | null = null

/** Restores the user's cache, then keeps it updated. Call once after sign-in. */
export async function startQueryCache(client: QueryClient, uid: string) {
  stopQueryCache()
  const options = {
    queryClient: client,
    persister: persisterFor(uid),
    maxAge: MAX_AGE_MS,
    buster: BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) =>
        q.state.status === 'success' && !NEVER_KEPT.has(String(q.queryKey[0])),
    },
  }
  try {
    await persistQueryClientRestore(options)
  } catch {
    // A broken or blocked cache (private mode) just means no head start.
  }
  stop = persistQueryClientSubscribe(options)
}

/** Stops saving and deletes the user's cache (sign-out, shared phones). */
export function stopQueryCache(uid?: string) {
  stop?.()
  stop = null
  if (uid) void del(`dm-cache-${uid}`).catch(() => undefined)
}
