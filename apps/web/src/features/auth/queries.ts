import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import {
  changeOwnPassword,
  countKnownDevices,
  getLoginId,
  getProfile,
  listDemoPeople,
  listDevices,
  removeDevice,
  signInAs,
  signInWithPassword,
  signOut,
} from './api'
import { useCurrentUser } from './session'
import { loginWithFingerprint, setUpFingerprint } from './fingerprint'

export const useProfile = (uid: string) =>
  useQuery({ queryKey: qk.employee(uid), queryFn: () => getProfile(uid) })

export const useDemoPeople = () =>
  useQuery({ queryKey: ['demoPeople'], queryFn: listDemoPeople, staleTime: 0 })

/** The login ID of a person, for the manager's edit dialog and the profile. */
export const useLoginId = (uid: string) =>
  useQuery({ queryKey: ['loginId', uid], queryFn: () => getLoginId(uid), staleTime: 0 })

/** Switching person clears cached data, so one role never sees the previous role's screens. */
export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (uid: string) => signInAs(uid),
    onSuccess: () => queryClient.clear(),
  })
}

export function useSignInWithPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ loginId, password }: { loginId: string; password: string }) =>
      signInWithPassword(loginId, password),
    onSuccess: () => queryClient.clear(),
  })
}

export function useSignInWithFingerprint() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: loginWithFingerprint, onSuccess: () => queryClient.clear() })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: signOut, onSuccess: () => queryClient.clear() })
}

export function useChangePassword() {
  const actor = useCurrentUser()
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => changeOwnPassword(actor, currentPassword, newPassword),
  })
}

/* ---------- fingerprint ---------- */

const deviceKey = (uid: string) => ['devices', uid] as const

export function useDevices() {
  const { uid } = useCurrentUser()
  return useQuery({ queryKey: deviceKey(uid), queryFn: () => listDevices(uid) })
}

/** True when at least one fingerprint is registered in this browser (by anyone). */
export const useHasKnownDevices = () =>
  useQuery({ queryKey: ['knownDevices'], queryFn: async () => (await countKnownDevices()) > 0 })

export function useSetUpFingerprint() {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => setUpFingerprint(actor, label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })
}

export function useRemoveDevice() {
  const actor = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentialId: string) => removeDevice(actor, credentialId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })
}
