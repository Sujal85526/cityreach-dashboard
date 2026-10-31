import {
  DEFAULT_BRANCH_RULES,
  type BranchInfo,
  type Shift,
  type ShiftInput,
} from '@cityreach/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  createBranch,
  deleteShift,
  getBranch,
  listShifts,
  saveShift,
  updateBranch,
  type BranchPatch,
} from './api'

export function useBranch() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.branch(branchId), queryFn: () => getBranch(branchId) })
}

/** The shop's timezone for displaying times (falls back to the default while loading). */
export const useTimeZone = () => useBranch().data?.rules.timeZone ?? DEFAULT_BRANCH_RULES.timeZone

export function useShifts() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.shifts(branchId), queryFn: () => listShifts(branchId) })
}

function useBranchMutation<TInput>(fn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient()
  const { branchId } = useCurrentUser().access
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.branch(branchId)),
  })
}

export function useCreateBranch() {
  const actor = useCurrentUser()
  return useBranchMutation((info: BranchInfo) => createBranch(info, actor))
}

/** `what` is the human label for the activity log, e.g. "attendance rules". */
export function useUpdateBranch() {
  const actor = useCurrentUser()
  return useBranchMutation(({ patch, what }: { patch: BranchPatch; what: string }) =>
    updateBranch(patch, what, actor),
  )
}

function useShiftMutation<TInput>(fn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient()
  const { branchId } = useCurrentUser().access
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.shifts(branchId)),
  })
}

export function useSaveShift() {
  const actor = useCurrentUser()
  return useShiftMutation(({ id, input }: { id: string | null; input: ShiftInput }) =>
    saveShift(id, input, actor),
  )
}

export function useDeleteShift() {
  const actor = useCurrentUser()
  return useShiftMutation((shift: Shift) => deleteShift(shift, actor))
}
