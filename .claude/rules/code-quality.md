# Code quality

- **KISS first.** Pick the simplest design that meets `docs/PRODUCT.md`. No speculative abstractions, no generic "base repository" frameworks, no features not in the product doc.
- **DRY where it matters:** rules, schemas, query keys, collection names, status→colour mapping each exist once. Two similar JSX blocks are fine; three means extract a component.
- **SOLID in practice:** one reason to change per file (page = composition, queries = caching, api = storage and batched writes); depend on the shared rules, not on copies.
- **Size limits:** files < 300 lines (hard max 500), functions < 50 lines. Split by responsibility, not arbitrarily.
- **Types:** `strict` + `noUncheckedIndexedAccess`. No `any`, no non-null `!` except on known DOM roots. Validate every external input with zod (forms, URL params, documents read from Firestore).
- **Enums:** string literal unions from `as const` arrays in `@cityreach/shared` (e.g. `TASK_STATUSES`). No TS `enum`.
- **Errors:** never swallow. `api.ts` throws `Error` with a user-readable message; UI shows a toast from the error message; unexpected errors are logged once at the boundary.
- **Logging:** the `activity` collection is the audit log. No `console` left in committed code.
- **Naming:** files `kebab-case.ts`, components `PascalCase.tsx`, hooks `useThing`. Booleans read as questions (`isOverdue`).
- **Comments:** explain _why_ and business rules with the example from the product doc; no comments restating code.
- **Tests:** critical paths only, testing behaviour: shared rules (unit), `firestore.rules` (emulator: who may write what, server time), clock-in / stock / overdue flows. Test names state the behaviour.
- **Dependencies:** add a package only if it removes real code; prefer what's already installed (date-fns, zod, recharts, jspdf).

## Before calling a task done

1. `pnpm check` passes.
2. Feature verified in the browser against seeded emulators, as manager **and** as employee where relevant, at desktop and 375 px width.
3. Firestore reads per screen are what you expect (Emulator UI → Requests tab); no query in a loop.
4. Docs updated if behaviour, data model or commands changed; BUILD_PLAN box ticked.
