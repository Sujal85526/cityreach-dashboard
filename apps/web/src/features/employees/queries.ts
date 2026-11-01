import type {
  EmployeeForm,
  LoginUpdate,
  EmploymentStatus,
  NewEmployee,
  NoteKind,
  User,
} from '@cityreach/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  addEmployeeNote,
  createEmployee,
  getEmployee,
  listEmployeeAttendance,
  listEmployees,
  listEmployeeTasks,
  sendPasswordReset,
  setEmployeeStatus,
  updateEmployee,
} from './api'

export function useEmployees() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.employeeList(branchId), queryFn: () => listEmployees(branchId) })
}

export const useEmployee = (uid: string) =>
  useQuery({ queryKey: qk.employee(uid), queryFn: () => getEmployee(uid) })

export function useEmployeeAttendance(uid: string) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.employeeAttendance(uid),
    queryFn: () => listEmployeeAttendance(branchId, uid),
  })
}

export function useEmployeeTasks(uid: string) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.employeeTasks(uid),
    queryFn: () => listEmployeeTasks(branchId, uid),
  })
}

/** Every employee mutation refreshes the list and the profile (`qk.employees` prefix). */
function useEmployeeMutation<TInput>(fn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.employees),
  })
}

export function useCreateEmployee() {
  const actor = useCurrentUser()
  return useEmployeeMutation((input: NewEmployee) => createEmployee(input, actor))
}

export function useUpdateEmployee() {
  const actor = useCurrentUser()
  return useEmployeeMutation(
    ({ current, input, login }: { current: User; input: EmployeeForm; login?: LoginUpdate }) =>
      updateEmployee(current, input, actor, login),
  )
}

export function useSetEmployeeStatus() {
  const actor = useCurrentUser()
  return useEmployeeMutation(({ employee, status }: { employee: User; status: EmploymentStatus }) =>
    setEmployeeStatus(employee, status, actor),
  )
}

export function useAddEmployeeNote() {
  const actor = useCurrentUser()
  return useEmployeeMutation(
    ({ employee, kind, text }: { employee: User; kind: NoteKind; text: string }) =>
      addEmployeeNote(employee, kind, text, actor),
  )
}

export const useSendPasswordReset = () => useMutation({ mutationFn: sendPasswordReset })
