import type { QueryClient } from '@tanstack/react-query'

/**
 * Reloads cached lists after a write, in the background. Call it from `onSuccess` without returning
 * anything: a promise returned from `onSuccess` keeps the mutation (and its Save button, toast and
 * dialog) pending until every list on screen has reloaded, which is a second network wait on top of
 * the write itself.
 */
export function refreshLists(client: QueryClient, ...keys: readonly (readonly unknown[])[]) {
  for (const queryKey of keys) void client.invalidateQueries({ queryKey })
}

/**
 * TanStack Query key factory. Every query key comes from here so invalidation
 * after a mutation can target a whole domain (e.g. `qk.employees`).
 */
export const qk = {
  branch: (branchId: string) => ['branch', branchId] as const,
  shifts: (branchId: string) => ['shifts', branchId] as const,
  employees: ['employees'] as const,
  employeeList: (branchId: string) => ['employees', 'list', branchId] as const,
  employee: (uid: string) => ['employees', uid] as const,
  employeeAttendance: (uid: string) => ['employees', uid, 'attendance'] as const,
  employeeTasks: (uid: string) => ['employees', uid, 'tasks'] as const,
  attendance: ['attendance'] as const,
  attendanceRange: (branchId: string, from: string, to: string) =>
    ['attendance', 'range', branchId, from, to] as const,
  myAttendance: (uid: string) => ['attendance', 'me', uid] as const,
  attendanceRecord: (uid: string, dateKey: string) => ['attendance', 'record', uid, dateKey] as const,
  attendancePhoto: (recordId: string | null) => ['attendancePhoto', recordId] as const,
  leave: ['leave'] as const,
  myLeave: (uid: string) => ['leave', 'me', uid] as const,
  branchLeave: (branchId: string) => ['leave', 'branch', branchId] as const,
  employeeLeave: (uid: string) => ['leave', 'employee', uid] as const,
  myAttendanceRange: (uid: string, from: string, to: string) =>
    ['attendance', 'me', uid, from, to] as const,
  documents: (branchId: string) => ['documents', branchId] as const,
  payslips: ['payslips'] as const,
  monthPayslips: (branchId: string, month: string) => ['payslips', branchId, month] as const,
  myPayslips: (uid: string) => ['payslips', 'me', uid] as const,
  checklistRuns: (branchId: string, date: string) => ['checklistRuns', branchId, date] as const,
  rota: (branchId: string, from: string, to: string) => ['rota', branchId, from, to] as const,
  recordsOf: (coll: string) => ['records', coll] as const,
  records: (coll: string, branchId: string, key: string) => ['records', coll, branchId, key] as const,
  inventory: ['inventory'] as const,
  inventoryItems: (branchId: string) => ['inventory', 'items', branchId] as const,
  stockMovements: (itemId: string) => ['inventory', 'movements', itemId] as const,
  movementsBetween: (branchId: string, from: string, to: string) =>
    ['inventory', 'between', branchId, from, to] as const,
  myBranches: (uid: string) => ['branches', 'mine', uid] as const,
  branchSummary: (branchId: string) => ['branches', 'summary', branchId] as const,
  suppliers: (branchId: string) => ['suppliers', branchId] as const,
}
