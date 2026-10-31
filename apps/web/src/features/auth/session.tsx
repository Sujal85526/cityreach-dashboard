import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { subscribeToSession, type SessionUser } from './api'

type SessionState =
  { status: 'loading' } | { status: 'signed_out' } | { status: 'signed_in'; user: SessionUser }

const SessionContext = createContext<SessionState>({ status: 'loading' })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const queryClient = useQueryClient()

  useEffect(
    () =>
      subscribeToSession((user) => {
        if (!user) queryClient.clear()
        setState(user ? { status: 'signed_in', user } : { status: 'signed_out' })
      }),
    [queryClient],
  )

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
