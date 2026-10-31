import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useSignOut } from '@/features/auth/queries'
import { errorMessage } from '@/lib/errors'

/** "Log out?" confirmation, shared by the sidebar button and the profile menu. */
export function LogoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const signOut = useSignOut()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log out?"
      description="You'll need your email and password to sign in again."
      confirmLabel="Log out"
      pending={signOut.isPending}
      onConfirm={() => signOut.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
    />
  )
}
