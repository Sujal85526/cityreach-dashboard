import type { Supplier, SupplierInput } from '@dm/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import { deleteSupplier, listSuppliers, saveSupplier } from './api'

export function useSuppliers() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.suppliers(branchId), queryFn: () => listSuppliers(branchId) })
}

/** Supplier changes also refresh inventory, which shows supplier names. */
function useSupplierMutation<TInput>(fn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient()
  const { branchId } = useCurrentUser().access
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.suppliers(branchId), qk.inventory),
  })
}

export function useSaveSupplier() {
  const actor = useCurrentUser()
  return useSupplierMutation(
    ({ current, input }: { current: Supplier | null; input: SupplierInput }) =>
      saveSupplier(current, input, actor),
  )
}

export function useDeleteSupplier() {
  const actor = useCurrentUser()
  return useSupplierMutation((supplier: Supplier) => deleteSupplier(supplier, actor))
}
