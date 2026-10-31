import type { Branch, LeaveRequestInput, PayAndLeave, User } from '@cityreach/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  cancelLeave,
  decideLeave,
  listBranchLeave,
  listEmployeeLeave,
  listMyAttendanceRange,
  listMyLeave,
  requestLeave,
  savePayAndLeave,
  type Decision,
  type LeaveContext,
} from './api'

export function useMyLeave() {
  const { uid } = useCurrentUser()
  return useQuery({ queryKey: qk.myLeave(uid), queryFn: () => listMyLeave(uid) })
}

export function useBranchLeave() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.branchLeave(branchId), queryFn: () => listBranchLeave(branchId) })
}

export function useEmployeeLeave(uid: string) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.employeeLeave(uid),
    queryFn: () => listEmployeeLeave(branchId, uid),
  })
}

export function useMyAttendanceRange(from: string, to: string) {
  const { uid } = useCurrentUser()
  return useQuery({
    queryKey: qk.myAttendanceRange(uid, from, to),
    queryFn: () => listMyAttendanceRange(uid, from, to),
  })
}

/** Leave decisions change attendance and pay too, so those caches refresh as well. */
function useLeaveMutation<TInput>(fn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.leave, qk.attendance, qk.employees),
  })
}

export function useRequestLeave() {
  const actor = useCurrentUser()
  return useLeaveMutation(({ input, ctx }: { input: LeaveRequestInput; ctx: LeaveContext }) =>
    requestLeave(input, ctx, actor),
  )
}

export const useCancelLeave = () => useLeaveMutation(cancelLeave)

export function useDecideLeave() {
  const actor = useCurrentUser()
  return useLeaveMutation(({ decision, branch }: { decision: Decision; branch: Branch }) =>
    decideLeave(decision, branch, actor),
  )
}

export function useSavePayAndLeave() {
  const actor = useCurrentUser()
  return useLeaveMutation(({ employee, input }: { employee: User; input: PayAndLeave }) =>
    savePayAndLeave(employee, input, actor),
  )
}
