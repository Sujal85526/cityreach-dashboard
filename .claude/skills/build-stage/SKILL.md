---
name: build-stage
description: Build the next unfinished stage of Digital Manager end to end (code, tests, browser verification, docs, commit). Use when the user says "continue", "next stage", "build stage N", "keep building", or asks to implement any module from docs/BUILD_PLAN.md.
---

# Build the next stage

You are building Digital Manager, a real product (not a prototype) for a coffee shop, from the Lovable design. Work like a senior engineer on the SwishX team: small layered modules, few round trips, tested rules, verified in the browser.

## 1. Load context (every time)

1. Read `CLAUDE.md` and the rule files it imports.
2. Read `docs/BUILD_PLAN.md`. The stage to build is the one the user named, or the first stage with an unchecked box.
3. Read the sections of `docs/PRODUCT.md`, `docs/PROTOTYPE.md`, `docs/DATA_MODEL.md` and `docs/ARCHITECTURE.md` that cover that stage.
4. Check `git status` and `git log --oneline -10` to see where the last session stopped.

## 2. Plan briefly

State in 3–6 lines: the files you will add/change per layer (shared schema/rules → firestore.rules → api.ts → queries.ts → components/pages), new indexes, and how you will verify. Don't ask for approval unless a product decision is genuinely missing from the docs; if so, pick the option the product doc implies, note it in the commit and in `docs/BUILD_PLAN.md` under "Decisions".

## 3. Build in this order

1. Shared: zod schema + types; any new rule as a pure function with unit tests (use the examples from PRODUCT.md as test cases).
2. Data layer (no server code, Spark plan): `firestore.rules` for every new collection or write path (role, branch, allowed fields, `request.time` for instants), then `features/<domain>/api.ts` with one batch/transaction per action, per `.claude/rules/architecture.md` and `data-access.md`. Add composite indexes to `firestore.indexes.json`. Time-based automation goes in `features/automation`.
3. Seed: extend `tools/seed.ts` so the screen has realistic data.
4. Frontend: api.ts → queries.ts (qk keys, invalidate on mutation) → components → page → route + nav. Match the prototype screen described in PROTOTYPE.md. Loading, empty and error states. Phone-first for employee screens.

## 4. Verify (don't skip)

1. `pnpm check` must pass.
2. Emulators running (`pnpm emulators`), seeded (`pnpm seed`), web running (`pnpm dev`). Use the browser tools to open http://localhost:5173, log in as `hana@dm.cafe` (manager) and as an employee (`ahmed@dm.cafe`), password `password123`, and exercise the stage's flows. Check desktop and 375 px width. Take a screenshot of each new screen and compare with PROTOTYPE.md.
3. Confirm the automatic rules fire (e.g. late clock-in → attendance status + notification + activity).
4. Glance at the Emulator UI Requests tab: no per-row reads, no unexpected writes.

## 5. Finish

1. Tick the stage's boxes in `docs/BUILD_PLAN.md`; update other docs if behaviour or data model changed. If rules changed, deploy them: `npx firebase deploy --project prod --only firestore` and log it in `docs/DEPLOYMENT.md`.
2. Commit with Conventional Commits (`feat(<domain>): …`) and push to `origin main` (or a `feat/` branch if the user prefers PRs).
3. Report to the user in a few lines: what works now, what you verified, any decisions made, what's next.

Then continue with the next stage unless the user asked for only one.
