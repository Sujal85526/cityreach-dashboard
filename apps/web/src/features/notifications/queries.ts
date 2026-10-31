import type { Notification } from '@dm/shared'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/session'
import { useLive } from '@/lib/live'
import { markRead, subscribeNotifications, subscribeUnreadCount } from './api'

export function useNotifications() {
  const user = useCurrentUser()
  return useLive<Notification[]>(
    `notifications:${user.uid}:${user.access.role}`,
    (onData, onError) => subscribeNotifications(user, onData, onError),
  )
}

export function useUnreadCount() {
  const user = useCurrentUser()
  return useLive<number>(`unread:${user.uid}:${user.access.role}`, (onData, onError) =>
    subscribeUnreadCount(user, onData, onError),
  )
}

/** Lists are live, so nothing needs invalidating after marking read. */
export const useMarkRead = () => useMutation({ mutationFn: markRead })
