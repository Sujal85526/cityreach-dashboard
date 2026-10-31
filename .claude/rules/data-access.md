# Data access and efficiency

Firestore bills per document read/write, and every round trip adds latency on a phone. Design for few round trips and few reads.

- **Round trips:** one user action = one network call. Multi-document writes go in one `WriteBatch` or `runTransaction` in `api.ts`, never several writes in sequence.
- **Don't wait for refetches:** after a write call `refreshLists(queryClient, ...keys)` from `onSuccess` and return nothing. A promise returned from `onSuccess` keeps the Save button, toast and dialog pending until every list on screen has reloaded.
- **Parallel reads:** independent reads with `Promise.all`; multiple known IDs with `db.getAll(...refs)`. Never `await` inside a `for` loop over documents.
- **Batch limits:** ≤ 500 operations per batch (chunk larger jobs); `in` / `array-contains-any` ≤ 30 values.
- **Deterministic IDs** for natural keys (`{uid}_{dateKey}`, `{uid}_{period}`) → idempotent upserts with `set(..., { merge: true })`, no existence query.
- **Denormalise** display fields that lists need (assigneeName, employeeName, supplierName, user.stats). Update copies in the same batch when the source changes (renaming an employee updates open tasks).
- **Counts** with `count()` aggregation queries; sums with `sum()` where possible. Don't fetch documents to count them.
- **Pagination:** cursor-based (`orderBy` + `startAfter`), page size ≤ 50. No offset.
- **Indexes:** every query with more than one filter, an `in` filter, or a range without an explicit `orderBy` gets its index in `firestore.indexes.json` in the same commit. **The emulator does not enforce indexes**, so tests pass without them; only the real project fails ("The query requires an index"). Deploy with `firebase deploy --project prod --only firestore:indexes` and wait until the console shows them Enabled.
- **Real-time listeners** (`onSnapshot`) only where live updates matter: notification bell unread count, employee's own clock-in status, Kanban board. Everything else is a cached query (staleTime 30 s).
- **Automation on open** (`features/automation`) queries narrowly (status + deadline range, since the last run) and writes in chunks of ≤ 500.
- **External API calls:** none in v1. If one is added, call it from a service, with timeout and retry, never from the client.
- **Time:** store instants as UTC Timestamps; convert with `@cityreach/shared` time helpers using the branch `timeZone`. Clock-in time always comes from the server (`serverTimestamp()`, checked in rules).
