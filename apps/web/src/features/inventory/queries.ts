import type { Branch, InventoryItem, InventoryItemInput, StockChange, Supplier } from '@dm/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import {
  adjustStock,
  createItem,
  deleteItem,
  listItems,
  listMovements,
  updateItem,
  type MovementReason,
} from './api'

export function useInventory() {
  const { branchId } = useCurrentUser().access
  return useQuery({ queryKey: qk.inventoryItems(branchId), queryFn: () => listItems(branchId) })
}

export function useMovements(itemId: string | null) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.stockMovements(itemId ?? ''),
    queryFn: () => listMovements(branchId, itemId ?? ''),
    enabled: itemId !== null,
  })
}

function useInventoryMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => refreshLists(queryClient, qk.inventory),
  })
}

export function useSaveItem() {
  const actor = useCurrentUser()
  return useInventoryMutation(
    ({
      item,
      input,
      supplier,
      branch,
    }: {
      item?: InventoryItem
      input: InventoryItemInput
      supplier: Supplier | null
      branch: Branch
    }) =>
      item
        ? updateItem(item, input, supplier, branch, actor)
        : createItem(input, supplier, branch, actor),
  )
}

export function useAdjustStock() {
  const actor = useCurrentUser()
  return useInventoryMutation(
    ({
      itemId,
      change,
      reason,
      branch,
    }: {
      itemId: string
      change: StockChange
      reason: MovementReason
      branch: Branch
    }) => adjustStock(itemId, change, reason, branch, actor),
  )
}

export function useDeleteItem() {
  const actor = useCurrentUser()
  return useInventoryMutation((item: InventoryItem) => deleteItem(item, actor))
}
