# Prototype (UI reference)

The UI must stay close to the Lovable prototype. It is a static mockup: all data is hard-coded and buttons do nothing. We have the preview only, not its source code, so screens are rebuilt from this spec.

- **Share preview link:** https://lovable.dev/preview/9DDmVFOWNIFOs0aiJntaSptGL5A5kjli
  (opens the app inside a Lovable frame; routes: `/`, `/employees`, `/attendance`, `/tasks`, `/inventory`, `/reports`, `/notifications`, `/settings`, `/login`)
- Reviewed: 2026-09-25. Credentials for the Lovable account are **not** stored in this repo; ask the project owner.

## Visual style

- **Layout:** fixed left sidebar (deep green, `--sidebar`), light warm off-white page, white cards with `rounded-xl`, thin borders, subtle shadow. Top bar per page: breadcrumb (`Digital Manager / Dashboard`), page title, global search ("Search employees, tasks, items…"), dark-mode toggle, bell with unread count, user chip (avatar initials, name, "Owner · Downtown").
- **Sidebar:** logo + "Digital Manager / Coffee ops platform"; items with lucide icons: Dashboard, Employees, Attendance, Tasks, Inventory, Performance Reports, Notifications, Settings; Logout at the bottom. Active item has a lighter green background.
- **Stat cards:** label, big number (e.g. `6 / 8`), small caption, icon in a rounded square top-right, and a soft status pill (e.g. green `+1 vs. yesterday`, amber `1 flagged`, red `Reorder today`, blue `1 overdue`).
- **Status pills:** soft background + coloured text. Green = On Time / Active / In Stock / Completed. Amber = Late / Low / Medium. Red = Absent / Critical / Overdue / High. Blue = info / Pending counts. Grey = Off Shift / Low priority.
- **Avatars:** circles with initials, colour per person.
- **Tables:** uppercase small grey headers, rows with avatar + name + email, progress bar for performance (bar + number), `…` actions menu.
- Font: Inter-like sans. Dark mode exists.
- **Built app differs on purpose (client feedback):** light sidebar with an espresso-brown accent instead of deep green; brown primary buttons and login panel; collapsible on desktop to an icon rail (panel button in the sidebar's top corner, remembered per browser; the same button closes the phone menu, no ✕); light theme by default (dark only when chosen with the top-bar toggle, remembered per browser). Green is kept only as the "good" status colour.

## Screens

### Login (`/login`)

Split screen. Left: dark green panel, "The smart operations platform for small coffee shops", subtext, three mini stat tiles (8 Employees, 94% Attendance, +3 pts This week), footer "© 2025 Digital Manager". Right: "Welcome back / Sign in to your workspace to continue", Email, Password, "Remember me", "Forgot password?", dark green **Sign in** button, "New to Digital Manager? Start a demo".

### Dashboard (`/`)

- 8 stat cards (2 per row on tablet, 4 on desktop): Employees Present `6 / 8`, Late Employees `2` (avg 14 min late), Tasks Completed `14` of 22, Pending Tasks `6` (2 high priority, 1 overdue), Low Stock Items `5` (2 critical), Staff Performance `88 / 100`, Revenue Today (**drop — POS is out of scope**), Live Activity `12 events` (last hour).
- Charts: Attendance Summary (bar, past 7 days), Performance Trend (line, last 8 weeks), Task Completion (bar, completed vs pending, 7 days).
- Inventory Alerts card: item, `6L · min 20L`, pill Critical/Low.
- Upcoming Tasks card: avatar, title, "Sara Mostafa · Today · 2:00 PM", priority pill.
- Recent Activity: "Sara Mostafa completed Deep clean espresso machines · 5 min ago", "Ahmed Hassan clocked in 18 min late · 1h ago", "System flagged low stock Whole Milk (6L)"…, "View all".
- Notifications card: type label (warning/success/danger/info), time, title, message.

### Employees (`/employees`)

Search box + **Add employee** button. Table: EMPLOYEE (avatar, name, email) · ROLE (Barista, Shift Lead, Cashier, Cleaner) · SHIFT ("Morning · 7am–3pm", "Evening · 3pm–11pm", "Night · 11pm–7am") · STATUS (Active / On Leave / Off Shift) · PERFORMANCE (bar + number) · ATTENDANCE (%) · ACTIONS (`…`).
**Missing in prototype, must add:** add/edit dialog, row click → profile page, deactivate action.

### Attendance (`/attendance`)

- Stat cards: Present Today `6` (75%), Late Arrivals `2` (Avg 14 min), Absent `1` (Requires follow-up), Avg. Hours / Day `7.9h` (Target 8h).
- Banner card: "Fingerprint / digital check-in · Connected" with a **Live** pill (keep as "Digital check-in" status).
- Table: EMPLOYEE · CLOCK IN · CLOCK OUT · HOURS · LATE (MIN) · STATUS. Sample: Ahmed 07:18–15:04, 7.77h, 18, Late; Nour —, Leave; Youssef —, Absent.
- Attendance chart (past 7 days) and a monthly calendar with legend On time / Late / Absent / Off.
  **Missing:** employee clock-in screen (phone), date picker, manager correction / mark leave.

### Tasks (`/tasks`)

"Task management — Assign, prioritize and track work across your team." Toggle **Kanban / List**, **New task** button. Four columns with counts and `+`: Pending, In Progress, Completed, Overdue. Card: priority pill + category tag, title, one-line description, assignee avatar + first name, due time.
**Missing:** create/edit dialog, drag or status change, employee "My tasks".

### Inventory (`/inventory`)

- Stat cards: Total SKUs 10, In Stock 5, Low Stock 3, Critical 2 (Reorder today).
- Alerts section "Items below minimum threshold" with **Create order** (optional, not in requirements): cards with category, status pill, name, `6L`, `Min. 20L`, supplier, "Updated 2h ago".
- All items table: ITEM · CATEGORY · QUANTITY · MINIMUM · SUPPLIER · UPDATED · STATUS, plus **Add item**.
  **Missing:** add/edit item dialog, stock adjust dialog, suppliers page.

### Performance Reports (`/reports`)

"Automated insights across employees and branches." Tabs **Weekly Report / Monthly Report**. Stat cards: Performance Score 88/100, Attendance % 94%, Tasks Completed 132, Tasks Missed 9. Highlight cards: Top performer, Most improved, Needs improvement (with reason text). Charts: Performance trend, Task completion (drop the Revenue chart). Employee report card table: EMPLOYEE · PERFORMANCE · ATTENDANCE · TASKS DONE · LATE ARRIVALS · MANAGER COMMENT.
**Missing:** period picker, PDF download.

### Notifications (`/notifications`)

"All notifications — 7 recent events", **Mark all as read**. Rows: title, type pill (warning/success/danger/info), message, relative time. Types seen: Late arrival, Task completed, Inventory critical, Weekly report ready, Reorder recommended, New top performer, Shift change.

### Settings (`/settings`)

Grid of 8 cards: Coffee shop information, Branches, Business hours, Attendance settings (grace periods, late thresholds, check-in device pairing), Task categories, Notification preferences, User permissions, Theme. Below: Branches list (Downtown, Riverside, Airport) with Active pills.
**Missing:** every settings page behind the cards. v1 builds: shop info, business hours & shifts, attendance rules, task categories, notification preferences, performance weights, theme. "User permissions" and multi-branch management are later.

## Sample data (use for the seed script)

Employees (email `@dm.cafe`): Ahmed Hassan (Barista, Morning), Sara Mostafa (Shift Lead, Morning), Omar Khaled (Barista, Evening), Nour El-Din (Cashier, Morning, On Leave), Layla Ibrahim (Barista, Evening), Youssef Adel (Cleaner, Night), Mariam Fathy (Cashier, Evening), Karim Tarek (Barista, Morning). Manager: Hana Malek (Owner, Downtown).
Inventory: Whole Milk 6/20 L, Oat Milk 14/15 L, Espresso Beans House Blend 32/10 kg, Single Origin 8/5 kg, 12oz Paper Cups 240/500 pcs, 16oz Paper Cups 780/500 pcs, Vanilla Syrup 4/6 btl, Caramel Syrup 9/6 btl, Chocolate Powder 2/4 kg, Napkins 1200/500 pcs.
Suppliers: Green Valley (dairy), Andes Roasters (coffee), PackPro (packaging), Sweetline (syrups, toppings).
Task categories: Cleaning, Service, Finance, Marketing, Training, Inventory.
