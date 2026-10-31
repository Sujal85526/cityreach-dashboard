import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { countActivitySince, listRecentActivity } from './api'

const MINUTE = 60_000

export function useRecentActivity() {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: ['activity', 'recent', branchId],
    queryFn: () => listRecentActivity(branchId),
    refetchInterval: MINUTE,
  })
}

/** Dashboard "Live activity": events in the last hour, refreshed every minute. */
export function useActivityLastHour() {
  const { branchId } = useCurrentUser().access
  return useQuery({
    queryKey: ['activity', 'last-hour', branchId],
    queryFn: () => countActivitySince(branchId, new Date(Date.now() - 60 * MINUTE)),
    refetchInterval: MINUTE,
  })
}
