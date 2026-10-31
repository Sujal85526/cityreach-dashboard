# Digital Manager

Staff, attendance, tasks and inventory management for a small coffee shop. Capstone 2 project for a client (a student). Web v1 first; iPhone app later via Capacitor.

Read what's relevant before working:

- `docs/PRODUCT.md`: requirements and rules (the source of truth for behaviour)
- `docs/PROTOTYPE.md`: the Lovable UI to match, screen by screen, plus seed data
- `docs/ARCHITECTURE.md`: layers, where each write happens, efficiency rules
- `docs/DATA_MODEL.md`: Firestore collections, IDs, indexes
- `docs/BUILD_PLAN.md`: stages and checkboxes; **resume from the first unchecked box**
- `docs/DEPLOYMENT.md`: the real Firebase project, env files, deploy log, handover

Engineering rules (follow them; they are short):

- @.claude/rules/architecture.md
- @.claude/rules/code-quality.md
- @.claude/rules/data-access.md
- @.claude/rules/ui.md
- @.claude/rules/workflow.md

## Stack

pnpm monorepo · `apps/web` React 19 + Vite 8 + TypeScript 6 + Tailwind 4 + shadcn/ui + TanStack Query + React Router + React Hook Form + Zod + Recharts + jsPDF · `packages/shared` pure rules and schemas · `tools` emulator seed · Firestore + Firebase Auth on the **free Spark plan (no Cloud Functions)**, website on Vercel (`managr.me`, auto-deploys from `main`): the app writes Firestore directly and `firestore.rules` guards it. Local dev runs entirely on emulators (`demo-digital-manager`), so no Firebase account is needed.

## Commands

```
pnpm install
pnpm emulators          # Auth, Firestore, UI at :4000 (needs Java 21: brew install openjdk@21)
pnpm seed               # sample data into the emulators
pnpm dev                # web at :5173
pnpm check              # format, lint, typecheck, tests (must pass before commit)
pnpm test:rules         # firestore.rules tests against the running emulator
pnpm test:flows         # end-to-end flows (apps/web/src/__flows__) against the running emulator
```

## Non-negotiables

- Business rules live only in `packages/shared/src/rules` and are unit-tested.
- Role checks exist in two places: route guards (UX) and `firestore.rules` (server). Every new write path gets its rule in the same commit. Never only in the UI.
- No Cloud Functions (Spark plan). Time-based automation runs in `features/automation` when a manager opens the app; important instants use `serverTimestamp()` enforced by rules.
- Never store secrets or the client's Lovable credentials in the repo.
- Docs are part of every change: update the affected `docs/*.md`, `README.md` and the `BUILD_PLAN.md` checkboxes in the same commit; log every production deploy in `docs/DEPLOYMENT.md`.
- Code, Firebase project, Vercel project and domain end up on the student's accounts: nothing may depend on a personal account.
