# Data model

Collections (see `packages/shared/src/constants/collections.ts`; schemas in
`packages/shared/src/schemas`). Every document carries `createdAt` / `updatedAt`, and most carry
`branchId`.

| Area       | Collections                                                                          |
| ---------- | ------------------------------------------------------------------------------------ |
| Business   | `branches`, `users`, `shifts`                                                         |
| Attendance | `attendance` (id `{uid}_{date}`), `attendancePhotos`, `rota`, `swapRequests`          |
| People     | `leaveRequests`, `payslips`, `candidates`, `training`, `goals`, `performance`         |
| Operations | `tasks`, `checklistTemplates`, `checklistRuns`, `handovers`, `incidents`, `feedback`  |
| Food/kit   | `temperatureLogs`, `inspections`, `equipment`, `maintenance`                          |
| Stock      | `inventoryItems`, `stockMovements`, `suppliers`, `purchaseOrders`                     |
| Finance    | `salesDays`, `expenses`                                                               |
| Files      | `documents`, `documentChunks` (compressed bytes in pieces)                            |
| System     | `notifications`, `activity` (audit log), `reports`                                    |

Conventions: dates are local `YYYY-MM-DD` keys in the branch time zone; instants are timestamps;
natural keys use deterministic ids so writes are idempotent; display fields that lists need are
copied onto the document (assignee name, supplier name) and updated in the same batch.
