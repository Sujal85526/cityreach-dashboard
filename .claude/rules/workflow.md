# Workflow

- **Branches:** `main` is always green. Work on `feat/<stage>-<slug>` (e.g. `feat/3-attendance`), `fix/<slug>`, `chore/<slug>`; squash-merge.
- **Commits:** Conventional Commits, imperative: `feat(attendance): add clock-in with lateness rule`. Scopes = domains (`attendance`, `tasks`, `inventory`, `employees`, `reports`, `notifications`, `settings`, `auth`, `shared`, `web`, `rules`, `tools`, `docs`).
- **Per stage:** implement → `pnpm check` → verify in browser (manager + employee, desktop + 375 px) → tick `docs/BUILD_PLAN.md` → commit → push.
- **Never commit:** `.env*` (except `.env.example`), emulator data, service-account keys, the client's Lovable credentials.
- **PR description** (when using PRs): Problem · Work · Environment changes · Breaking changes · Proof of work (screenshots).
- **Local run:** `pnpm emulators` (terminal 1), `pnpm seed` once, `pnpm dev` (terminal 2). Seed users: `hana@dm.cafe` (manager), `ahmed@dm.cafe` etc. (employees), password `password123` (emulator only).
- **Docs:** every commit keeps docs true: behaviour → `PRODUCT.md`, structure → `ARCHITECTURE.md`, collections/indexes → `DATA_MODEL.md`, progress → `BUILD_PLAN.md`, Firebase/deploys → `DEPLOYMENT.md`, commands → `README.md`.
- **Deploy:** rules/indexes changed → `firebase deploy --project prod --only firestore` → **`pnpm indexes:wait`** (new indexes take minutes; pages that need them fail until READY). Website: **pushing to `main` deploys it** (Vercel, `managr.me`), so push only when it may go live, and after the rules/indexes. Check the Vercel deployment is READY → only then call it live → add a row to the deploy log in `docs/DEPLOYMENT.md`.
