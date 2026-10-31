import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useCurrentUser } from '@/features/auth/session'
import { useBranch } from '@/features/settings/queries'
import { useToday } from '@/hooks/use-today'
import { ask } from './api'
import type { Intent, When } from './intents'

/** Asks a question with the signed-in user's context. Each answer is read when asked, not kept live. */
export function useAsk() {
  const client = useQueryClient()
  const user = useCurrentUser()
  const branch = useBranch().data
  const today = useToday()
  return useCallback(
    (intent: Intent, when: When | null) => {
      if (!branch) throw new Error('Still loading the shop settings.')
      return ask(intent, when, { client, user, branch, today })
    },
    [branch, client, today, user],
  )
}
