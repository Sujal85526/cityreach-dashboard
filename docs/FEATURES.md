# Features

| Role     | Screens                                                                                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner    | Everything a manager has, plus Branches and All branches                                                                                                                                                                                                                    |
| Manager  | Dashboard, calendar, notifications, employees, attendance, rota, leave & pay, recruitment, tasks board, checklists & logs, food safety, equipment, customer feedback, inventory, suppliers, purchasing, sales & finance, performance reports (PDF/CSV), documents, settings |
| Employee | Clock in (selfie + location), my tasks, shop checklists & logs, my rota, my attendance, leave & pay, training & goals, notifications                                                                                                                                        |

The business rules behind them live in `packages/shared/src/rules` (each with unit tests):
attendance and lateness, shifts and the rota, task status and overdue, stock status, leave and
payroll, performance scores, expiry reminders and the finance helpers.

## Insights, all branches and the assistant

- **Insights** (managers and owners): staff cost against sales for a month (on target up to 30 %,
  watch up to 40 %, too high above), best and quietest days, the cost of wasted stock, and what to
  reorder per supplier with a button that opens the purchase order already filled in.
- **All branches** (owner only, in the screens and in the data layer): every branch side by side,
  with this month's sales, profit and staff cost and today's staff, tasks, stock and leave. One
  branch failing to load does not stop the others. **Switch to it** moves the app to that branch.
- **Assistant**: a round button on every screen opens a chat that answers from the shop's own
  records, with a link to the page. It is rule-based (no AI, no outside service): it fixes small
  typos, follows up ("and tomorrow?") and only answers staff questions from their own data.
  Questions only managers may ask are refused, and the data layer refuses them too.

The demo seed holds six months of sales, stock history (use, waste, stock counts, deliveries),
purchase orders with and without prices, staff without a salary, and two more branches (Salford
Quays and Didsbury) owned by the demo Owner.
