# Architecture

City Reach is a static single-page app. There is no backend: the "database" is an in-memory
document store that is saved to `localStorage`, so every write in the demo really works and survives
a reload.

```
UI (pages, components)
  -> features/<domain>/queries.ts   TanStack Query hooks, cache keys from lib/query-keys.ts
    -> features/<domain>/api.ts     reads and batched writes
      -> lib/store                  in-memory document store (+ localStorage)
        <- lib/store/seed           demo business, generated relative to today
packages/shared                     zod schemas, types and the business rules (pure, unit-tested)
```

## Layers

- **Pages** compose components and hooks. They never call `api.ts` directly.
- **Queries** own caching and invalidation. Server state lives only in TanStack Query; UI state is
  local or in the URL.
- **api.ts** is the only place that touches the store. One user action is one batch or
  transaction: the main write, its activity-log entry and any notification are saved together.
- **packages/shared** holds the rules that drive calculations (lateness, payroll, stock status,
  leave pay, performance scores, rota, expiry reminders). They have no I/O and are covered by
  unit tests, so the UI and the demo data agree.

## The local store (`apps/web/src/lib/store`)

A small document-database API (`collection`, `doc`, `query`, `where`, `orderBy`, `limit`,
`writeBatch`, `runTransaction`, `onSnapshot`, `serverTimestamp`, `arrayUnion`, aggregate counts)
implemented over plain objects:

- `engine.ts` keeps the data, applies batches atomically, notifies live listeners and persists to
  `localStorage` (key `cityreach-demo-data`). If the saved data is from a previous day it is
  re-seeded, so the sample dates always look current.
- `seed/` builds the demo business: staff, shifts, two weeks of attendance, tasks, stock,
  suppliers, purchase orders, sales and expenses, payslips, feedback, documents, rota and more.
- Settings -> Reset data wipes everything and re-seeds.

## Demo mocks for server-side things

| Real-world need | Demo behaviour                                                       |
| --------------- | -------------------------------------------------------------------- |
| Login           | Role switcher on the landing screen (Owner / Manager / Employee)     |
| Camera selfie   | Simulated viewfinder; "Take photo" generates a portrait placeholder  |
| GPS location    | A reading a few metres from the demo branch after a short delay      |
| File storage    | Compressed in the browser and stored in the local store (up to 1 MB) |
| Password emails | A toast; nothing is sent                                             |
| Scheduled jobs  | `features/automation` runs when a manager opens the app (idempotent) |

## Frontend

`apps/web/src`: `app/` (providers, router, route guards), `components/` (ui primitives, layout,
common, charts, brand), `features/<domain>/`, `hooks/`, `lib/`. Pages are lazy-loaded per route.

Design tokens live in `src/index.css` (colours, radius, shadows, fonts). Components use tokens
only (`bg-card`, `text-muted-foreground`, `bg-success-soft`...), never raw colours.
