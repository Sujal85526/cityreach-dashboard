import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import { listMonthPayslips, listMyPayslips, savePayslip } from './api'

export function useMonthPayslips(month: string) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.monthPayslips(branchId, month),
    queryFn: () => listMonthPayslips(branchId, month),
  })
}

export function useMyPayslips() {
  const { uid } = useCurrentUser()
  return useQuery({ queryKey: qk.myPayslips(uid), queryFn: () => listMyPayslips(uid) })
}

export function useSavePayslip() {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof savePayslip>[0]) => savePayslip(input, actor),
    onSuccess: () => refreshLists(queryClient, qk.payslips),
  })
}
