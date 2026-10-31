import type { Branch } from '@cityreach/shared'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { qk } from '@/lib/query-keys'
import { listOwnedBranches, loadBranchSummary, switchBranch } from './api'

/** The owner's branches; disabled (and refused by the api) for anyone else. */
export function useMyBranches() {
  const actor = useCurrentUser()
  return useQuery({
    queryKey: qk.myBranches(actor.uid),
    queryFn: () => listOwnedBranches(actor),
    enabled: actor.access.role === 'owner',
  })
}

/** One query per branch, so a slow or failing branch doesn't hold back the others. */
export function useBranchSummaries(branches: Branch[]) {
  const actor = useCurrentUser()
  return useQueries({
    queries: branches.map((branch) => ({
      queryKey: qk.branchSummary(branch.id),
      queryFn: () => loadBranchSummary(branch, actor),
      retry: false,
    })),
  })
}

/** Opens another branch; the whole app reloads so every screen shows it. */
export function useOpenBranch() {
  const actor = useCurrentUser()
  return useMutation({
    mutationFn: (branchId: string) => switchBranch(branchId, actor),
    onSuccess: () => window.location.assign('/'),
  })
}
