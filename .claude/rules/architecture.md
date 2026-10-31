# Architecture rules

Modular monolith on Firebase's free plan: React app + shared rules + Firestore security rules.

## No backend code (free Spark plan)

There are no Cloud Functions. The web app writes directly to Firestore and `firestore.rules` is the server-side guard. See `docs/ARCHITECTURE.md` → "Why no server code" and "Where writes happen".

- **One action = one batch/transaction** in `features/<domain>/api.ts`: the main write plus its activity entry and notification. Never several sequential writes.
- **Server time only** for instants that matter (clock-in/out, completedAt): `serverTimestamp()`, enforced in rules with `== request.time`.
- **Every write path has a rule** in the same commit: who (role from `users/{uid}`), which branch, which fields may change.
- **Time-based automation** (overdue, absences, performance, weekly report) lives in `features/automation/api.ts`, runs when a manager opens the app, and is idempotent (deterministic IDs, `set(..., { merge: true })`). Screens also derive time-based state on read.
- `tools/seed.ts` is the only code using the Admin SDK, and only against the emulators.

## Frontend (`apps/web/src`)

```
app/                    providers, router, route guards
components/ui/          shadcn primitives (generated; edit sparingly)
components/layout/      AppShell, Sidebar, Topbar, MobileNav
components/common/      StatCard, StatusPill, PageHeader, EmptyState, DataTable, EmployeeAvatar, PasswordInput, SuggestInput
features/<domain>/
  api.ts                Firestore reads and batched writes (only place importing @/lib/firebase)
  queries.ts            TanStack Query hooks using qk; mutations invalidate qk keys
  components/           domain components
  pages/                route pages (thin: compose components + hooks)
hooks/                  cross-cutting hooks (useSession, useMediaQuery)
lib/                    firebase, utils, query-keys, format (dates, numbers, durations)
```

- UI → queries → api → Firebase. Pages never call `api.ts` or Firebase directly.
- Server state in TanStack Query only; UI state local (`useState`) or URL params (filters, tabs, period). No global store unless a real need appears.
- Types and zod schemas come from `@cityreach/shared`; forms use `zodResolver` with the shared schema, and `api.ts` parses again before writing.

## Shared (`packages/shared/src`)

- `rules/` pure functions, no I/O, 100 % unit-tested for the documented examples.
- `schemas/` zod schemas + `z.infer` types per domain.
- `constants/` collection names, roles, default settings.
