# Features

| Role     | Screens                                                                                                                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner    | Everything a manager has, plus Branches                                                                                                                                                                                                                                     |
| Manager  | Dashboard, calendar, notifications, employees, attendance, rota, leave & pay, recruitment, tasks board, checklists & logs, food safety, equipment, customer feedback, inventory, suppliers, purchasing, sales & finance, performance reports (PDF/CSV), documents, settings |
| Employee | Clock in (selfie + location), my tasks, shop checklists & logs, my rota, my attendance, leave & pay, training & goals, notifications                                                                                                                                        |

The business rules behind them live in `packages/shared/src/rules` (each with unit tests):
attendance and lateness, shifts and the rota, task status and overdue, stock status, leave and
payroll, performance scores, expiry reminders and the finance helpers.
