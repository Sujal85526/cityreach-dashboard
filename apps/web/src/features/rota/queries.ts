import {
  addDays,
  type Branch,
  type RotaEntry,
  type Shift,
  type SwapRequest,
  type User,
} from '@cityreach/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { useToday } from '@/hooks/use-today'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  cancelSwap,
  decideSwap,
  listMyRota,
  listRota,
  listSwaps,
  publishWeek,
  requestSwap,
  setRotaDay,
} from './api'

export function useRota(from: string, to: string) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.rota(branchId, from, to),
    queryFn: () => listRota(branchId, from, to),
  })
}

/** The signed-in employee's rota from yesterday to tomorrow (for clock-in). */
export function useMyRotaAroundToday() {
  const { uid, access } = useCurrentUser()
  const today = useToday()
  const from = addDays(today, -1)
  const to = addDays(today, 1)
  return useQuery({
    queryKey: [...qk.rota(access.branchId, from, to), uid],
    queryFn: () => listMyRota(access.branchId, uid, from, to),
  })
}

export function useSwaps() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: ['swaps', branchId], queryFn: () => listSwaps(branchId) })
}

/** Rota and swap changes refresh the rota, swaps and attendance (planned shifts change). */
function useRotaMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, ['rota'], ['swaps'], qk.attendance),
  })
}

export function useSetRotaDay() {
  const actor = useCurrentUser()
  return useRotaMutation(
    ({
      employee,
      date,
      shiftId,
    }: {
      employee: User
      date: string
      shiftId: string | null | 'usual'
    }) => setRotaDay(employee, date, shiftId, actor),
  )
}

export function usePublishWeek() {
  const actor = useCurrentUser()
  return useRotaMutation(
    (i: {
      weekStart: string
      employees: User[]
      shifts: Shift[]
      existing: RotaEntry[]
      branch: Branch
    }) => publishWeek(i.weekStart, i.employees, i.shifts, i.existing, i.branch, actor),
  )
}

export function useRequestSwap() {
  const actor = useCurrentUser()
  return useRotaMutation(
    ({
      input,
      branch,
    }: {
      input: { date: string; toId: string; toName: string; reason: string }
      branch: Branch
    }) => requestSwap(input, branch, actor),
  )
}

export const useCancelSwap = () => useRotaMutation((req: SwapRequest) => cancelSwap(req))

export function useDecideSwap() {
  const actor = useCurrentUser()
  return useRotaMutation(
    (i: {
      req: SwapRequest
      approve: boolean
      plans: { fromShiftId: string | null; toShiftId: string | null }
      branch: Branch
    }) => decideSwap(i.req, i.approve, i.plans, i.branch, actor),
  )
}
