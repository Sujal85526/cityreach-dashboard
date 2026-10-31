import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { startQueryCache, stopQueryCache } from '@/lib/query-cache'
import { subscribeToSession, type SessionUser } from './api'

type SessionState =
  { status: 'loading' } | { status: 'signed_out' } | { status: 'signed_in'; user: SessionUser }

const SessionContext = createContext<SessionState>({ status: 'loading' })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const queryClient = useQueryClient()

  useEffect(() => {
    let current: string | null = null
    let latest: SessionUser | null = null
    return subscribeToSession((user) => {
      if (user) {
        latest = user
        // A second call for the same user is the background re-check: the cache is already running.
        if (current === user.uid) {
          setState({ status: 'signed_in', user })
          return
        }
        current = user.uid
        // The device cache is restored before the first screen renders, so it shows instantly.
        void startQueryCache(queryClient, user.uid).finally(() => {
          if (latest) setState({ status: 'signed_in', user: latest })
        })
      } else {
        latest = null
        stopQueryCache(current ?? undefined)
        current = null
        queryClient.clear()
        setState({ status: 'signed_out' })
      }
    })
  }, [queryClient])

  return <SessionContext value={state}>{children}</SessionContext>
}

export const useSession = () => use(SessionContext)

/** For components rendered only inside signed-in routes. */
export function useCurrentUser(): SessionUser {
  const session = useSession()
  if (session.status !== 'signed_in')
    throw new Error('useCurrentUser used outside a signed-in route')
  return session.user
}
