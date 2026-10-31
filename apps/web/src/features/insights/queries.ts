import { type PurchaseOrder, type SalesDay, salesTotal } from '@cityreach/shared'
import { useQuery } from '@tanstack/react-query'
import { where } from '@/lib/store'
import { useMemo } from 'react'
import { useCurrentUser } from '@/features/auth/session'
import { listMovementsBetween } from '@/features/inventory/api'
import { useRecords } from '@/features/records/queries'
import { useBranch } from '@/features/settings/queries'
import { qk } from '@/lib/query-keys'

/** Every stock change between two local dates. */
export function useMovementsBetween(from: string, to: string) {
  const { branchId } = useCurrentUser().access
  const branch = useBranch().data
  return useQuery({
    queryKey: qk.movementsBetween(branchId, from, to),
    queryFn: () => {
      if (!branch) throw new Error('Still loading the shop settings.')
      return listMovementsBetween(branch, from, to)
    },
    enabled: !!branch,
  })
}

/** Daily takings between two dates, with each day's total. */
export function useSalesBetween(from: string, to: string) {
  const query = useRecords<SalesDay>('salesDays', {
    key: `${from}_${to}`,
    filters: [where('date', '>=', from), where('date', '<=', to)],
    // Matches the (branchId, date ASC) index.
    orderField: 'date',
    direction: 'asc',
  })
  const days = useMemo(
    () => query.data?.map((d) => ({ date: d.date, total: salesTotal(d) })),
    [query.data],
  )
  return { ...query, days }
}

export const usePurchaseOrders = () => useRecords<PurchaseOrder>('purchaseOrders')
