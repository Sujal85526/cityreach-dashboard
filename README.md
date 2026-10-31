# Digital Manager

Staff, attendance, tasks and inventory management for small coffee shops: one system instead of paper, chat groups and spreadsheets.

**Live:** https://managr.me · **Start here:** [docs/HANDOVER.md](docs/HANDOVER.md) (how it works, demo script, Capstone data, making changes, handover).

- Managers see who's in, who's late, open tasks, low stock, performance and reports.
- Employees clock in/out and manage their tasks from their phone.
- Running the shop: shift rota and swaps, opening / closing checklists, handovers, incidents, food-safety temperature log, equipment servicing, purchase orders, customer feedback.
- Business and HR: daily sales, expenses, profit and VAT estimate; payslips with WPS tracking; recruitment, probation, training & goals, end-of-service settlement; owners can run several branches.
- Rules run automatically: lateness, absences, overdue tasks, low-stock and temperature alerts, service / certificate / probation reminders, performance scores, weekly reports.

## Tech

React 19 · Vite · TypeScript · Tailwind CSS · shadcn/ui · TanStack Query · Firebase (Auth, Firestore) on the **free Spark plan** · Vercel (website) · pnpm monorepo.

```
apps/web/          React web app (reads and writes Firestore directly)
packages/shared/   business rules, schemas, constants
tools/             emulator seed script
firestore.rules    server-side security: roles, branches, server time
docs/              product, prototype, architecture, data model, build plan, deployment
```

## Run locally

Requirements: Node 22+, pnpm, Java 21 for the Firebase emulators (`brew install openjdk@21`, then add `/opt/homebrew/opt/openjdk@21/bin` to `PATH`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm emulators     # terminal 1: Auth + Firestore; Emulator UI at http://localhost:4000
pnpm seed          # once: sample coffee shop data
pnpm dev           # terminal 2: web app at http://localhost:5173
```

Sample logins (emulator only): `hana@dm.cafe` (manager), `ahmed@dm.cafe` (employee), password `password123`.

## Quality

```bash
pnpm check         # format, lint, typecheck, business-rule unit tests
pnpm test:rules    # security-rule tests (needs `pnpm emulators` running)
pnpm test:flows    # end-to-end flows through the app code (needs `pnpm emulators` running)
```

## Deploy

Production project: `digital-manager-f916d` (Firestore in `me-central1`, Doha). Full details, env files and handover steps: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
npx firebase login
npx firebase deploy --project prod --only firestore   # security rules + indexes (first, when changed)
git push origin main                                  # website: Vercel deploys every push to main
```

Everything runs on the free Spark plan; no card is needed.

## Docs

- [Handover guide](docs/HANDOVER.md) ← start here
- [Product requirements](docs/PRODUCT.md)
- [Prototype / UI reference](docs/PROTOTYPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Build plan](docs/BUILD_PLAN.md)
- [Firebase project & deployment](docs/DEPLOYMENT.md)
- [Scope & estimate](docs/SCOPE_ESTIMATE.md)
