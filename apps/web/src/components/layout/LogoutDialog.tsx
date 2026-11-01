import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useSignOut } from '@/features/auth/queries'
import { errorMessage } from '@/lib/errors'

/** Sign-out confirmation, shared by the sidebar button and the profile menu. */
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
      title="Sign out?"
      description="Your demo changes stay saved in this browser. Sign in again to continue."
      confirmLabel="Sign out"
      pending={signOut.isPending}
      onConfirm={() => signOut.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
    />
  )
}
