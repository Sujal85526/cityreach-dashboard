import { useCurrentUser } from '@/features/auth/session'
import { GrowthPanel } from '../components/GrowthPanel'

/** Employee: their own training, certificates and goals (read-only). */
export function MyGrowthPage() {
  const me = useCurrentUser()
  return <GrowthPanel employee={{ id: me.uid, name: me.name }} />
}
