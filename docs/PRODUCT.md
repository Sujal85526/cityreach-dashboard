# Product requirements

Digital Manager is a web app that lets a small coffee shop manager run staff, attendance, tasks and stock in one place. The system does the checks and calculations itself. It is a university Capstone 2 project for the client (a student); it starts with one shop and must be ready to support more branches later.

Version 1 is **web only** (desktop for the manager, phone-friendly for employees). An iPhone app via Capacitor comes later from the same code.

## Roles

| Role     | Access                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner    | Everything a manager can do, plus **several branches**: open a new branch and switch between the ones they own (Settings → Branches). Only an owner can make someone else an owner.                     |
| Manager  | Everything in their branch: dashboard, staff, rota, attendance, leave & pay, tasks, operations, stock, purchasing, finance, reports, documents, settings                                                |
| Employee | Their own data: clock in/out, their rota (and swap requests), attendance, tasks, leave, payslips, training & goals, notifications; plus the shop's checklists, temperature log, incidents and handovers |

A manager of a branch nobody owns becomes its owner with **Settings → Branches → Become the owner** (one-way; rules allow it only while the branch has no owner).

Login is email + password (an eye button shows or hides the typed password). The app recognises the role after login and shows only the allowed pages. Fine-grained permissions (custom roles, per-feature toggles) are **out of scope** for v1.

## Modules

### 1. Dashboard (manager)

All numbers come from the database, never typed in:

- Employees present today, late, absent
- Tasks completed today, pending, overdue
- Low-stock and critical items
- Average staff performance
- Recent activity feed and latest notifications
- Charts: attendance (7 days), task completion (7 days), performance trend (8 weeks)

### 2. Employees (manager)

- Add, edit, deactivate employees (deactivate, never hard-delete)
- Assign role (manager / employee), position (Barista, Cashier…), shift
- List shows status, attendance %, performance score
- Profile page: basic info, attendance history, assigned/completed tasks, warnings, achievements, manager notes

### 3. Attendance

Each record stores: employee, date, scheduled shift, clock-in, clock-out, worked hours, minutes late, status.

- Employee clocks in/out from their phone (digital check-in). Server time is used, never the device clock.
- While clocked in, the clock-in screen shows a live "Working for 01:37:12" counter and "Shift ends at 3:00 PM · 2:15:04 left" with a progress bar.
- **Location and live photo at clock-in** (added 2026-10-08 at the client's request): the phone's location is read and compared with the shop location (Settings → Shop location, radius default 100 m); the front camera takes a live photo (no gallery). Neither blocks the clock-in: the manager sees "At shop" / "2.3 km away" / "No location" and the photo or "No photo" on the Attendance page, and gets a notification when someone clocks in away from the shop. Location is also read at clock-out. A website can't track during the shift, only at these two moments. Photos are deleted after 90 days. No face recognition (no AI).
- **Leaving early** (Keka-style): clocking out more than the grace period (default 10 min, a setting) before the shift ends asks "Leave before your shift ends? 2h 15m remaining" with an optional reason; the record shows "Left 2h 15m early" and the manager is notified. Example: shift ends 15:00, clock-out 12:45 → Left 2h 15m early. Leaving early does not change On Time / Late or the performance score.
- A clock-in left open more than 6 h after its shift ended is a forgotten clock-out: it no longer blocks the next clock-in, and the manager fixes it with the pencil on the Attendance page.
- Status is automatic: **On Time, Late, Absent, Leave, Off**.
  - Example: shift 07:00, clock-in 07:18 → **Late – 18 min**.
  - Grace period (default 5 min) and absent threshold (default 60 min after shift start) are settings.
- Manager can mark Leave / Off and correct records (corrections are logged).
- Architecture must allow a fingerprint device later: all clock-ins go through one service function with a `source` field (`web` now, `fingerprint` later).

### 4. Tasks

Fields: title, description, category, assigned employee, priority (Low / Medium / High), deadline, status (Pending / In Progress / Completed / Overdue).

- Manager creates and assigns tasks. Kanban board (like the prototype) plus list view.
- Employee sees own tasks and can move them to In Progress / Completed.
- A task past its deadline and not completed becomes **Overdue** automatically.

### 5. Inventory and suppliers

Item fields: name, category, current quantity, unit, minimum quantity, supplier, last updated, status.

- Manager adds items and updates stock (every change is logged as a stock movement).
- Status is automatic: quantity below minimum → **Low**; at or below the critical ratio (default 50 % of minimum) → **Critical**.
  - Example: oat milk 14 L, minimum 15 L → **Low**.
- Low / critical items appear on the dashboard and create a notification (only when the status gets worse, no spam).
- Suppliers: name, contact person, phone, email, items supplied.

### 6. Performance

Transparent, rule-based score out of 100 (no AI):

```
score = 0.30 × attendance + 0.25 × punctuality + 0.30 × task completion + 0.15 × manager rating
```

- attendance = attended ÷ scheduled shifts (leave/off excluded); punctuality = on-time ÷ attended; task completion = completed by the deadline ÷ tasks due (late completions count as missed); manager rating = 1–5 ÷ 5 (weekly).
- A period with no scheduled shifts and no tasks due gives no score.
- Weights are editable in Settings. If the manager hasn't rated, that weight is spread over the others.
- Manager can view one employee's breakdown and compare employees (report card table).

### 7. Reports

- Weekly and monthly reports for a chosen period: attendance, lateness, absences, task completion, missed tasks, performance per employee, inventory alerts.
- Viewable on screen and downloadable as **PDF**.
- Weekly report is generated automatically and triggers a "report ready" notification.

### 8. Notifications (rule-based)

Created automatically, e.g.:

- "Ahmed arrived 18 minutes late."
- "Sara completed the espresso machine cleaning task."
- "Whole Milk has fallen below its minimum stock level."
- "Weekly performance report is ready."
- "Task deadline has passed and the task is still incomplete."
- "Hana assigned you 'Clean the grinder'." (to the employee)

In-app only in v1 (bell icon + notifications page, mark as read). Preferences per event type in Settings.

### 8b. Leave & pay (added 2026-10-17 at the client's request)

- **Leave types** (Settings → Leave types): name, days per year (blank = no limit), paid or unpaid. Defaults: Annual 30, Sick 15, Emergency 5, Maternity 60, Paternity 5, Bereavement 5 (paid), Unpaid (no limit). The manager can override any type's yearly days per employee on the profile. Leave year = calendar year.
- **Employee** (phone, `/me/leave`): balances per type, **Request leave** (type, from–to, reason). Only the employee's working days (their shift's days) count. The form shows how many days will be paid and unpaid before sending. Pending requests can be withdrawn.
- **Manager** (`/leave`, "Leave & pay"): pending requests with Approve / Reject and a comment; the dialog shows the paid / unpaid split and the pay impact. Both sides get a notification.
- **Approving** marks each working day as **Leave** on Attendance (days already clocked in stay as they are). Paid types use the balance first; days beyond it are **unpaid**. Example: 3 days of annual leave with 2 left → 2 paid, 1 unpaid.
- **Pay estimate**: monthly salary (set on the profile) − (unpaid leave days + absent days) × salary ÷ 30. Example: AED 3,000, 1 unpaid day + 1 absence → − AED 200 → AED 2,800. Shown on the profile, to the employee (their own only) and in the manager's monthly table with CSV export. It is an estimate, not payroll (no allowances, overtime or payslips).

### 8c. Documents (added 2026-10-19 at the client's request)

- The manager's private store for licenses, contracts, insurance, invoices and other paperwork (`/documents`). **Managers only**; employees can't see or open anything (enforced by `firestore.rules`).
- Upload any file with a name, category (License, Contract, Insurance, Invoice, Staff, Other) and an optional note; search and filter; open, download, rename, delete.
- Files are **compressed in the browser** before saving: photos and scans are re-saved as a JPEG (longest side 2,400 px), other files (PDF, Word…) are gzipped; a file that doesn't shrink is kept as it is. Up to **5 MB after compression** (files over 25 MB are refused before compressing). Example: a 306 KB phone photo → 105 KB; a 53 KB text PDF → 13 KB.
- **Expiry dates** (optional, e.g. trade license, insurance, permits) with **Remind me 7 / 14 / 30 / 60 / 90 days before** (default 30). The list shows Valid / Expires in N days / Expired, the counts sit at the top, and the filter "Expired or expiring soon" lists what needs renewing. The manager gets one notification when a document enters its reminder window and one when it expires (sent once per expiry date; entering a new date after renewing starts over). Example: expires 15 Jan, remind 30 days before → "expires on 15 Jan" from 16 Dec, "expired" on 16 Jan.
- Free plan: there's no file storage, so files live in the database in pieces (see `docs/ARCHITECTURE.md`); together with the app's data they share the free 1 GB. Moving to Firebase Storage later needs the Blaze plan.

### 8d. Payslips, employee documents, attention box, calendar (added 2026-10-19 at the client's request)

- **Employee documents**: passport, Emirates ID, visa, labour contract (and other staff papers) are linked to an employee, listed on their profile (Documents tab) and on the Documents page, with the same expiry reminders ("Ahmed Hassan's Visa expires on 13 Nov 2026"). Managers only.
- **Payslips** (Leave & pay → Pay & payslips): per employee and month, basic salary + monthly allowances (set on the profile) + overtime + bonus − unpaid leave and absences (salary ÷ 30 a day) − other deductions (with a reason). Overtime = minutes worked beyond the shift length, counted on days with 30 min or more, paid at 125 % of the hourly basic (salary ÷ 30 ÷ 8). Example: 3,000 basic + 500 allowances + 200 bonus − 1 absence (100) → net 3,600. Save as draft or mark paid; saving again recalculates. PDF download; employees see and download their own under Leave & pay.
- **Needs your attention** (dashboard): most urgent first: fridge readings out of range today, expired documents, stock to reorder, overdue tasks, overdue supplier invoices, broken machines, open incidents, leave and shift swaps waiting for a decision, absences today, documents expiring, machines due for a service (7 days), supplier invoices due this week, the VAT return (14 days ahead), probations ending (14 days), interviews today, and from the 25th the payslips still to prepare. Each line links to where it's handled.
- **Calendar** (`/calendar`): month view of approved and pending leave, document and certificate expiries, salary day (last day of the month), expected deliveries, supplier payments due, machine services and warranty ends, the VAT return, interviews and probation ends; click a day for its list.

### 8e. Operations, finance and HR (added 2026-10-21 at the client's request)

Everything is entered by hand (no POS, bank or government integration) and each record keeps who created it and when. Staff can add the shop logs; everything else is managers only.

- **Rota** (`/rota`): a week grid; each cell is that person's shift that day (or Off) and overrides their usual shift. **Publish week** writes the whole week so staff can see who works with them. **Clock-in and the automatic absence check follow the rota**: on a rota day off the clock-in is refused (also by `firestore.rules`), and a rota shift is the one lateness is measured against. Example: Ahmed's usual shift is Morning 07:00, the rota gives him Evening 15:00 on Wednesday → clocking in 15:20 is Late 20 min.
- **Shift swaps**: an employee (`/me/rota`) asks to swap a day with a colleague; the manager approves or rejects on the rota page; approving exchanges both people's shifts that day and tells both.
- **Checklists & logs** (`/operations`, staff: `/me/shop`): opening / closing / cleaning checklists (the manager edits the items), ticked by staff each day with who ticked what; complete when every item is ticked. **Handovers** (notes and cash count between shifts) and **incidents** (type, severity, action taken, open / closed); a new incident from staff notifies the manager.
- **Food safety** (`/food-safety`): **temperature log** for fridges and freezers (the allowed range is set on the machine). Example: milk fridge 1 to 5 °C, reading 7.2 °C → Out of range, the manager is notified at once. Plus inspections (authority or internal: result, score, findings, corrective actions).
- **Equipment** (`/equipment`): machines with serial, purchase date, warranty end, service interval and status. Next service = last service (or purchase) + interval; reminded 7 days before (warranty: 30 days). A service or repair entry updates the machine's last service and status.
- **Purchasing** (`/purchasing`): purchase orders with a price per line: Draft → Ordered (expected delivery date) → **Received** (stock goes up by every line, each as a stock movement, in one transaction; it can't be received twice) → Paid (supplier invoice number, payment due date). Overdue and due-this-week invoices show on the dashboard.
- **Sales & finance** (`/finance`): daily takings (cash, card, online; one entry per day) and expenses (category, VAT, payment method). The month shows sales, expenses, payroll (net pay of the month's payslips) and **profit** = sales − expenses − payroll. **VAT** (UAE, 5 %): set the period (monthly or quarterly) and one period end; the next return is due 28 days after the period ends (example: quarter ending 30 Sep → due 28 Oct). The estimate is VAT in sales (5/105 of the takings) − VAT on expenses. An estimate for the accountant, not a tax filing.
- **Recruitment** (`/recruitment`): candidates (position, source, stage Applied → Interview → Offer → Hired / Rejected, interview date, notes); the CV is a document with the category CV. **Probation**: an end date on the employee, reminded 14 days before.
- **Customer feedback** (`/feedback`): channel, 1–5 stars, topic, comment and how it was resolved; average rating, % happy (4–5 stars) and open complaints.
- **Training & goals** (profile tab; employees see their own at `/me/growth`): courses with certificate expiry (reminded 30 days before) and goals with progress.
- **End of service** (profile → Final settlement): UAE gratuity on the basic salary: 21 days' pay for each of the first 5 years, 30 days after that, nothing under 1 year, capped at 2 years' pay; plus unused annual leave (salary ÷ 30 a day, basic + allowances), salary for the days worked in the last month, minus other deductions. Example: basic 3,000 (AED 100 a day), 1.64 years → 21 × 1.64 × 100 = AED 3,446.30. Downloadable as PDF. A calculation to check, not a payment.
- **WPS tracking**: a paid payslip records how it was paid (WPS, bank transfer or cash) and the reference; both show on the PDF. The app does not create or send the WPS salary file (that's the bank's / exchange house's job).
- **Reminders** run once a day when a manager opens the app and are sent once per date (servicing the machine, renewing the certificate or extending the probation starts a new reminder).

### 9. Settings (manager)

- Business / branch information and timezone
- Working hours and shifts
- Attendance rules (grace period, absent threshold)
- Inventory rules (critical ratio; minimums are per item)
- Notification preferences
- Performance weights

## How the modules connect (the core of the project)

```
Employee clocks in → attendance record created → lateness calculated
  → performance updated → dashboard updated → notification created

Stock updated → compared with minimum → status set (Low / Critical)
  → dashboard updated → manager notified
```

## Capstone evaluation needs

Every record carries `createdAt` / `updatedAt` timestamps, and important actions are written to an `activity` log, so the student can later measure attendance accuracy, task completion rate, inventory monitoring, report preparation time and usability.

## Non-functional

- Responsive: desktop (main), tablet, phone (employee screens must be easy on a phone).
- Multi-branch: every document has `branchId`; the app shows one branch at a time and owners switch between their branches.
- Ownership: code and Firebase project end up on the student's accounts (repo transfer + deploy to their Firebase project at handover).
- Documentation good enough for the student to explain the architecture in their presentation.

## Out of scope for v1

Fingerprint hardware, iPhone/Android app, email/SMS alerts, POS / bank / accounting integrations (sales and expenses are typed in), creating or submitting the WPS salary file, VAT filing (the app estimates it), cross-branch reports (an owner switches branch to see each one), AI suggestions, custom roles/permissions.
