import type { PeriodType, User } from '@dm/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { useEmployees } from '@/features/employees/queries'
import { rateEmployee, refreshPerformance } from '@/features/performance/api'
import { useBranch } from '@/features/settings/queries'
import { qk, refreshLists } from '@/lib/query-keys'
import { loadReport } from './api'

export function useReport(type: PeriodType, key: string) {
  const branch = useBranch().data
  const employees = useEmployees().data
  return useQuery({
    queryKey: ['reports', type, key],
    queryFn: () =>
      branch && employees
        ? loadReport(type, key, branch, employees)
        : Promise.reject(new Error('Still loading')),
    enabled: Boolean(branch && employees),
  })
}

/** Rating then recalculation, so the new rating shows in scores straight away. */
export function useRateEmployee() {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  const branch = useBranch().data
  const employees = useEmployees().data
  return useMutation({
    mutationFn: (input: { employee: User; week: string; rating: number | null; comment: string }) =>
      rateEmployee(input.employee, input.week, input.rating, input.comment, actor),
    // The rating is saved; scores recalculate in the background (many reads and writes).
    onSuccess: () => {
      const refresh = () => refreshLists(queryClient, ['reports'], qk.employees, ['performance'])
      refresh()
      if (branch && employees)
        void refreshPerformance(branch, employees, actor).then(refresh, refresh)
    },
  })
}

export function useRecalculate() {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  const branch = useBranch().data
  const employees = useEmployees().data
  return useMutation({
    mutationFn: () => {
      if (!branch || !employees) throw new Error('Still loading, try again in a moment.')
      return refreshPerformance(branch, employees, actor)
    },
    onSuccess: () =>
      refreshLists(
        queryClient,
        ['reports'],
        qk.employees,
        ['performance'],
        qk.branch(actor.access.branchId),
      ),
  })
}
