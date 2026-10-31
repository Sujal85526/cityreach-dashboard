import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { getProfile, signIn, signOut } from './api'

export const useProfile = (uid: string) =>
  useQuery({ queryKey: qk.employee(uid), queryFn: () => getProfile(uid) })

export const useSignIn = () =>
  useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
  })

/** Clears all cached data so the next user never sees the previous user's data. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: signOut, onSuccess: () => queryClient.clear() })
}
