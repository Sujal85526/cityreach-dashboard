import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryConstraint } from 'firebase/firestore'
import { useCurrentUser } from '@/features/auth/session'
import { qk, refreshLists } from '@/lib/query-keys'
import { deleteRecord, listRecords, saveRecord, type SaveOptions, type StoredRecord } from './api'

/**
 * Cached list of a record collection. `key` distinguishes filtered lists of the same collection
 * (e.g. one employee's goals); filters must match it.
 */
export function useRecords<T extends StoredRecord>(
  coll: string,
  {
    key = 'all',
    filters,
    orderField,
    direction,
    enabled = true,
  }: {
    key?: string
    filters?: QueryConstraint[]
    orderField?: string
    direction?: 'asc' | 'desc'
    enabled?: boolean
  } = {},
) {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: qk.records(coll, branchId, key),
    queryFn: () => listRecords<T>(coll, branchId, { filters, orderField, direction }),
    enabled,
  })
}

/** Save / delete refresh every list of that collection, plus anything else named in `alsoRefresh`. */
export function useSaveRecord(coll: string, alsoRefresh: readonly (readonly unknown[])[] = []) {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      existing,
      data,
      options,
    }: {
      existing: StoredRecord | null
      data: Record<string, unknown>
      options: SaveOptions
    }) => saveRecord(coll, existing, data, actor, options),
    onSuccess: () => refreshLists(queryClient, qk.recordsOf(coll), ...alsoRefresh),
  })
}

export function useDeleteRecord(coll: string) {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ record, summary }: { record: StoredRecord; summary: string }) =>
      deleteRecord(coll, record, actor, summary),
    onSuccess: () => refreshLists(queryClient, qk.recordsOf(coll)),
  })
}
