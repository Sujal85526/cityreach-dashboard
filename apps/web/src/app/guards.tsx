import { isManagerRole, type Role } from '@dm/shared'
import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/features/auth/session'
import { homePathFor } from './routes'

export function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  )
}

/**
 * Route guard for UX only. The same checks run again in firestore.rules on every request,
 * so bypassing this never exposes data.
 */
/** `role="manager"` also lets owners in (they run the branch too). */
export function RequireRole({ role }: { role: Exclude<Role, 'owner'> }) {
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') return <FullScreenLoader />
  if (session.status === 'signed_out')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  const actual = session.user.access.role
  if ((role === 'manager') !== isManagerRole(actual))
    return <Navigate to={homePathFor(session.user.access.role)} replace />
  return <Outlet />
}
