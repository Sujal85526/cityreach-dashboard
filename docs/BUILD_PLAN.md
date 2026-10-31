# Build plan (web v1)

Build in this order. Each stage ends with: `pnpm check` green, the feature verified in the browser against the emulators, and one commit (Conventional Commits). Tick boxes as you go so a new session can resume.

Status legend: `[ ]` todo · `[x]` done

## Stage 0 — Setup (done)

- [x] pnpm monorepo: `apps/web`, `packages/shared`, `tools` (was `functions`; removed 2026-10-07 for the Spark plan)
- [x] Shared rules with tests: lateness, absence, stock status, overdue, performance score, timezone helpers
- [x] Firebase config for emulators (`demo-digital-manager`), security rules skeleton
- [x] Web: Vite + React 19 + Tailwind 4 + shadcn/ui, theme tokens from the prototype, Firebase client with emulator wiring, TanStack Query provider, query-key factory
- [x] Docs and engineering rules
- [x] Production Firebase project `digital-manager-f916d` (Firestore `me-central1`, Email/Password auth, web app), `prod` alias, rules deployed — see `docs/DEPLOYMENT.md`
- [x] Switched to the free Spark plan: no Cloud Functions; roles from `users/{uid}`; rules enforce server time and per-field writes; seed moved to `tools/`

## Stage 1 — Foundation

- [x] Zod schemas + inferred types for every entity in `packages/shared/src/schemas/` (one file per domain)
- [x] Seed script (`tools/seed.ts`) against emulators: 1 branch, Hana (manager, `hana@dm.cafe`), 8 employees, shifts, suppliers, inventory, tasks, 14 days of attendance history — data from `docs/PROTOTYPE.md`. Password for all seed users: `password123` (emulator only)
- [x] Auth: login page (prototype design), `useSession` hook (role/branch/status from `users/{uid}`), logout
- [x] Router with role guards: `/` manager dashboard, `/me` employee home; unknown role → login
- [x] App shell: sidebar (manager nav vs employee nav), top bar (breadcrumb, search placeholder, theme toggle, bell with unread count, user chip), mobile sheet sidebar
- [x] Reusable: `StatCard`, `StatusPill`, `PageHeader`, `EmptyState`, `DataTable`, `EmployeeAvatar`

## Stage 2 — Employees & settings

- [x] Create / update / deactivate employee in `employees/api.ts` (Auth account via a secondary Firebase app so the manager stays signed in, then `users` doc batch); password reset email
- [x] Employees list (prototype table), search, add/edit dialog, deactivate (in-app confirm), password reset
- [x] Employee profile page: info, attendance history, tasks, warnings, achievements, notes (manager can add notes/warnings/achievements)
- [x] Shifts CRUD (Settings → Business hours & shifts; delete refused while employees are assigned)
- [x] Production first-run: if the signed-in manager's branch document is missing, a setup screen creates it with default settings (`BranchGate`)
- [x] Settings pages: shop info & timezone, business hours & shifts, attendance & stock rules, task categories, notification preferences, performance weights, theme (Branches / User permissions shown as "Later")

## Stage 3 — Attendance

- [x] Clock in / out in `attendance/api.ts` (`serverTimestamp()` enforced by rules, shared lateness rule, batch: attendance + activity + late notification)
- [x] Employee home (phone-first): today's shift, big Clock in / Clock out button, status after clock-in ("Late – 18 min"), my week
- [x] Manager attendance page: stat cards, daily table, date picker, 7-day chart, month calendar
- [x] Manager correction / mark Leave or Off (batch with activity entry)
- [x] Absences: `features/automation` marks no-shows when a manager opens the app; attendance screens derive Absent on read

## Stage 4 — Tasks

- [x] Kanban (4 columns, live) + list view, filters by assignee/priority and search
- [x] Create/edit/delete task dialog (manager), status changes (drag or card menu)
- [x] Employee "My tasks" (phone-first, live) with Start / Complete
- [x] Completing a task writes task + activity + notification in one batch; assigning notifies the employee
- [x] Overdue: derived on read everywhere; saved by `features/automation` on manager open (rules allow `overdue` only after the deadline)

## Stage 5 — Inventory & suppliers

- [x] Items table + alert cards + stat cards (prototype), search and category filter
- [x] Add/edit/delete item; adjust stock (delivery / used / wasted / stock count) in `inventory/api.ts` (transaction: quantity + status + stock movement + alert only when worse)
- [x] Suppliers page (CRUD; rename updates items; delete refused while items use it); stock history per item

## Stage 6 — Notifications & dashboard

- [x] Notifications page (All / Unread) + bell dropdown, mark read / mark all read, live unread count; employee view at `/me/notifications`; clicking opens the related page
- [x] Dashboard: 8 stat cards, attendance and task-completion charts, inventory alerts, upcoming tasks, recent activity, notifications — all from Firestore (parallel queries, `count()` for live activity)
- [x] Dashboard performance-trend chart (8 weeks) from the weekly snapshots

## Stage 7 — Performance & reports

- [x] Performance snapshots (`performance/{uid}_{week}`, last 8 weeks) + rolling 28-day stats on users, computed on the first manager open each day and by "Recalculate"; weekly manager rating (1–5 + comment)
- [x] Reports page: weekly / monthly tabs, period picker, stat cards, highlight cards (top / most improved / needs improvement), trend + task charts, report card table
- [x] PDF export (jsPDF + autotable, loaded on demand) with the same sections and the formula
- [x] Last week's report saved on the first manager open of the week + "report ready" and "top performer" notifications

## Stage 8 — Hardening & handover

- [x] Security rules tests (`tools/rules.test.ts`, 33 cases): attendance, tasks, inventory, notifications, performance
- [x] Flow tests (`apps/web/src/__flows__`, `pnpm test:flows`): clock-in → lateness → notification, automatic absence, stock → status → alert only when worse, overdue → completion
- [x] Responsive pass at 375 / 768 / 1024 / 1280 px for every manager and employee screen and dialog (no sideways scrolling)
- [x] README + `docs/HANDOVER.md` (how it works, demo script, Capstone data, making changes, deploy, handover); docs updated
- [x] Production build: pages load on demand (first load ~410 kB gzipped, libraries cached across deploys); Firebase Hosting live with caching and security headers
- [x] CSV export of attendance, tasks, stock movements and activity for the Capstone evaluation
- [x] First production manager account (demo manager); first-sign-in profile completion; Settings → Load / Remove sample data (shared demo café used by the seed too)
- [x] Requested extras (2026-10-08): location + live photo at clock-in, shift countdown, Keka-style early clock-out (reason, "Left early", notification), Settings → Shop location and early-leave grace; 90-day photo cleanup; CSV columns
- [x] Requested extras (2026-10-17): leave types (Settings), salary and per-employee allowances (profile), leave requests with approve / reject, Leave days on Attendance, monthly pay estimate with unpaid-leave and absence deductions (manager table + CSV, employee's own)
- [x] Requested extra (2026-10-19): manager-only Documents (upload, compress in the browser, store in pieces, open / download / rename / delete, search and categories)
- [x] Documents: expiry dates, reminder window, Expired / Expiring soon badges and counts, reminder notifications (2026-10-19)
- [x] Requested extras (2026-10-19): employee documents on profiles, payslips (allowances, overtime 125 %, bonus, deductions, paid status, PDF, employee's own list), dashboard "Needs your attention", Calendar page; local seed for all of them (`tools/seed-extras.ts`)
- [x] Requested extras (2026-10-21): owner role and several branches, shift rota + swaps (clock-in and absences follow the rota), checklists / handovers / incidents, food safety (temperature log with alerts, inspections), equipment & maintenance (service and warranty reminders), purchasing (purchase orders, receive into stock, supplier invoices), sales & finance (daily takings, expenses, profit, VAT estimate and due date), recruitment and probation, customer feedback, training & goals, end-of-service settlement (PDF), WPS payment tracking on payslips; "Needs your attention" and calendar cover them; local seed (`tools/seed-business.ts`); 12 new end-to-end flows and rules tests; libraries split into cacheable chunks
- [x] Custom domain `managr.me` (Tasjeel.ae): website on Vercel with auto-deploy from `main`, Firebase Auth authorised domains — see `docs/DEPLOYMENT.md`
- [ ] Handover (`docs/HANDOVER.md` §8): client as Firebase Owner, remove developer, transfer the GitHub repo, transfer the Vercel project

## Decisions

- **UI palette (after client review):** light sidebar and espresso-brown primary replace the prototype's deep green; the app opens in light mode regardless of the OS setting.

- Stage 1: employees keep one `status` field (`active` / `on_leave` / `inactive`) instead of a separate `active` flag. Inactive users are also disabled in Auth.
- Stage 1: suppliers get their own page (`/suppliers`) in the sidebar under Inventory; the prototype had no suppliers screen.
- Stage 1: the login page drops "Start a demo" (not in requirements); "Forgot password" tells employees to ask the manager (manager resets in stage 2).
- 2026-10-07: Firestore runs in `me-central1` (Doha), the closest region to the client in the UAE.
- 2026-10-07: Free Spark plan instead of Blaze, so the client needs no card. Cloud Functions removed; their jobs moved to the web app (batched writes guarded by `firestore.rules`, server time via `request.time`, time-based automation on manager open). Trade-off: nothing is written while nobody has the app open; screens derive time-based states on read. Details in `docs/ARCHITECTURE.md`.
- 2026-10-07: Hosting emulator moved to port 5050 (macOS AirPlay uses 5000).
- 2026-10-07: `.gitignore` ignored every `lib/` folder, so `apps/web/src/lib` (firebase, firestore, utils, query-keys) was never committed; the `lib/` ignore line is removed and the files are restored.
- 2026-10-07: Default branch timezone is `Asia/Dubai` (client in the UAE). Times are always shown in the branch timezone, not the viewer's device timezone (`lib/format.ts`).
- 2026-10-07: Manager list queries also filter by `branchId`, because `firestore.rules` can only allow a list it can prove stays inside the manager's branch.
- 2026-10-07: Renaming an employee copies the new name onto their open tasks only; completed tasks keep the name they had.
- 2026-10-07: Settings saves are per page (each page writes only its own fields) and log one activity entry each. Rule changes apply to new records; past attendance/stock statuses are not recalculated.
- 2026-10-07: Clock-in is two checked writes (create with server time, then the classification that rules recompute exactly). See `docs/ARCHITECTURE.md` → "Clock-in: why two writes".
- 2026-10-07: Clock-in opens 3 hours before a shift and closes when it ends; a night-shift clock-in after midnight belongs to the previous day's shift. Employees without a shift may clock in any time (always On Time).
- 2026-10-07: A clock-in after the absence window replaces the automatic Absent and counts as Late. Manager-entered records are never replaced by employees or by the automatic check.
- 2026-10-07: The automatic absence check looks back 7 days and only notifies for no-shows from the last 24 hours, so a quiet weekend doesn't flood the bell.
- 2026-10-07: New notification type `task_assigned` (to the employee). Employees may start, put back or complete their own tasks (also overdue ones); only managers reopen completed work. Completion time is the server's.
- 2026-10-07: The board shows open tasks plus tasks completed in the last 14 days; older ones live in profiles and reports. Dropping onto "Overdue" is not possible (it follows the deadline); editing an overdue task's deadline into the future reopens it as Pending.
- 2026-10-07: Inventory stays manager-only (docs/PRODUCT.md §5). Item quantity is set when adding; after that every change goes through Adjust stock (delivery, used, wasted, stock count) so it is logged in `stockMovements`. Stock never goes below 0.
- 2026-10-07: `firestore.rules` recompute Low / Critical from quantity, minimum and the branch's critical ratio, so a wrong status can't be stored. Screens also recompute it on read, so changing the ratio in Settings re-grades every item immediately.
- 2026-10-07: Low/critical alerts fire only when the status gets worse, including when adding an item that starts below its minimum or when raising an item's minimum.
- 2026-10-07: Dashboard drops the prototype's "Revenue Today" (POS out of scope) and adds "Absent" to keep eight cards. "Tasks completed" = completed today of (completed today + still open and due today). "Staff performance" averages employees' latest scores until stage 7 adds weekly snapshots.
- 2026-10-07: Managers' bell shows branch-wide alerts (`recipientId == null`); employees' bell shows only notifications addressed to them. Lists keep the latest 50.
- 2026-10-07: Report periods are ISO weeks (Mon–Sun, "2026-W41") and calendar months, in the branch timezone. A week or month in which someone had no scheduled shifts and no tasks due gets **no** score (not a neutral 100), and is left out of averages and the trend.
- 2026-10-07: Task completion counts only tasks completed **by** their deadline; a late completion counts as missed. Tasks not yet due are not counted. Leave and Off don't count as scheduled shifts.
- 2026-10-07: Reports are always computed live from the records (so they can't go stale); the saved weekly report document is the archived copy behind the "report ready" notification. Monthly manager rating = average of that month's weekly ratings.
- 2026-10-07: Live lists read documents with `serverTimestamps: 'estimate'`, so our own just-written records (e.g. a new notification) never show a missing time.
- 2026-10-07: Fixed sidebar from 1024 px; phones and tablets use the slide-in menu so tables get the full width. The widest table columns (performance bar, manager comment) appear from 1280 px.
- 2026-10-07: Hosting caching: pages `no-cache` (updates show immediately), `/assets/**` cached for a year (file names change on every build).
- 2026-10-07: The demo café lives in `packages/shared/src/demo/sampleShop.ts`, used by the emulator seed and by Settings → "Load sample data". Sample records carry `sample: true` and `sample-` ids; rules let a manager delete only those (plus performance snapshots).
- 2026-10-07: Clickable elements (buttons, tabs, menu items, options, switches) show a pointer cursor; Tailwind v4 removed it by default. Removing sample data moves real staff on a sample shift to "No fixed shift".
- 2026-10-07: Production showed "The query requires an index" on Reports (`performance` by branch + period). The emulator never enforces indexes, so tests passed. Audited every query and added 18 indexes (30 total); rule added to `.claude/rules/data-access.md`.
- 2026-10-08: Client asked for location + photo at clock-in and Keka-style early clock-out. Both checks **flag, never block** (indoor GPS is often 50–100 m off; a denied camera shouldn't stop an honest clock-in). Photo only at clock-in; location at clock-in and clock-out. No face recognition (no AI). Photos in Firestore (Storage needs Blaze), 320 px JPEG, deleted after 90 days. "At shop" gives the GPS accuracy circle credit, capped at the radius. Leaving early doesn't change the attendance status or the performance score.
- 2026-10-08: A clock-in still open 6 h after its shift ended counts as a forgotten clock-out and no longer blocks the next clock-in (found while testing: a seed record from the day before locked an employee out).
- 2026-10-17: Leave & pay (client request). Leave types and default days per year are set in Settings; the manager can override per employee. Leave year = calendar year; only the employee's shift days count. Paid types use the balance first, extra days are unpaid. Unexcused absences are deducted like unpaid days (client's choice). Day rate = salary ÷ 30 (UAE practice). Employees see their own salary and deduction (salary lives on `users/{uid}`, which they can already read). It's an estimate, not payroll.
- 2026-10-19: Documents (client request) are the manager's private paperwork store, not linked to employees, managers only. Free plan: files are compressed in the browser and stored in Firestore pieces, max 5 MB after compression. Expiry dates and reminders added the same day.
- 2026-10-19: Payslips follow UAE practice: day = basic ÷ 30, hour = day ÷ 8, overtime at 125 % (counted on days with ≥ 30 min beyond the shift). Allowances are one monthly amount per employee. A saved payslip keeps its figures; "Recalculate & save" refreshes them. Salary day on the calendar is the last day of the month. Employee documents stay manager-only (employees don't see them yet).
- 2026-10-21: Operations, finance and HR modules (client request). Sales and expenses are typed in (no POS / bank integration); VAT is an estimate with the due date (28 days after the period), not a filing; WPS is tracked (payment method + reference on the paid payslip), the salary file is not generated. Gratuity follows UAE rules on the basic salary (21 / 30 days per year, cap 2 years, none under 1 year; service years counted by anniversaries so leap days don't overpay). One generic records engine (`features/records`) serves all the list-and-form modules, with three rule blocks in `firestore.rules` (manager records, staff logs, personal records).
- 2026-10-21: Owners: a branch gets `ownerId`; the app shows one branch at a time and an owner switches by changing their own `branchId` (rules: only to a branch they own). A manager of an unowned branch can claim it once. No cross-branch reports yet.
- 2026-10-21: The rota overrides the usual shift per day (`rota/{uid}_{date}`, `shiftId: null` = day off). Employees can't read other users, so a rota entry carries the employee's name; "Publish week" writes the whole week so staff see their team. Clock-in rules check the rota day too.
- 2026-10-21: Found by the new flow test: the first checklist tick of the day failed, because its transaction reads a run that doesn't exist yet and the read rule needed `resource.data`. Rule fixed (a missing run is readable by any active user; it reveals nothing).
- 2026-10-21: Finance month totals sort by date ascending to match the `(branchId, date ASC)` index (the emulator doesn't check index direction).
- 2026-10-29: Website moved from Firebase Hosting to Vercel: Firebase verified `managr.me` but never issued its HTTPS certificate ("Minting certificate" for over a day, also after re-adding the domain; ticket raised). Firestore, Auth and rules stay on Firebase; only the static site moved. Vercel builds every push to `main` with pnpm via Corepack and the `VITE_*` values as project env vars, so pushing to `main` is a production deploy; rules and indexes still deploy with the Firebase CLI, first.
- 2026-10-29: Approving leave failed in production ("The query requires an index"): the approval and an employee's month-pay attendance query filtered a `dateKey` range with no `orderBy`, which needs an ascending index; production only had `dateKey desc` ones and the emulator ignores index direction, so tests passed. Both queries now sort `dateKey desc` and use the existing indexes. Every query shape in the app (69) was then run against production with dummy values: no other one is missing an index.
- 2026-10-29: Free-text fields with suggestions (position, item category, unit) use `SuggestInput` instead of a native `<datalist>`, whose grey browser popup can't be themed.
- 2026-10-31: Speed, measured on production before changing anything. Saves took 3.4–4.4 s, a reload 4.4 s, login 4.8 s to open the app. Causes found: every mutation returned its list refresh from `onSuccess` (the button waited for all lists), login read the profile twice, each start blocked on the profile read, and `useAutomation` restarted all checks after any refetch (its dependencies were rebuilt objects). Fixed all four; adding an employee also drops an unneeded Auth profile update, and rating an employee no longer waits for the recalculation. Result: reload 0.9 s, a save on an open write connection 0.8 s. The first save after an idle minute stays about 3–4 s: Firestore takes about 2.5 s for the first request on a connection from the test network, and no client setting tested changes it (see `docs/ARCHITECTURE.md`). Not yet measured from the UAE, where the database is closer.
- 2026-10-31: Deactivated accounts: rules deny them their own profile, so `permission-denied` on that read means "no access" (not a network error), even with a saved session on the device.
