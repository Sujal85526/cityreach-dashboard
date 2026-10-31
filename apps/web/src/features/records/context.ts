import { isManagerRole } from '@dm/shared'
import { useCurrentUser } from '@/features/auth/session'
import { useBranch } from '@/features/settings/queries'
import { useToday } from '@/hooks/use-today'
import type { ModuleContext } from '@/features/operations/modules'

/** What record modules need from the session: today, the branch, who is acting. Null while loading. */
export function useModuleContext(): ModuleContext | null {
  const actor = useCurrentUser()
  const branch = useBranch().data
  const today = useToday()
  return branch ? { today, branch, actor, isManager: isManagerRole(actor.access.role) } : null
}
