import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { getProfile, listDemoPeople, signInAs, signOut } from './api'

export const useProfile = (uid: string) =>
  useQuery({ queryKey: qk.employee(uid), queryFn: () => getProfile(uid) })

export const useDemoPeople = () =>
  useQuery({ queryKey: ['demoPeople'], queryFn: listDemoPeople, staleTime: 0 })

/** Switching person clears cached data, so one role never sees the previous role's screens. */
export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (uid: string) => signInAs(uid),
    onSuccess: () => queryClient.clear(),
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: signOut, onSuccess: () => queryClient.clear() })
}
