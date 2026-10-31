import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useSignOut } from '@/features/auth/queries'
import { errorMessage } from '@/lib/errors'

/** "Back to role picker?" confirmation, shared by the sidebar button and the profile menu. */
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
      title="Back to the role picker?"
      description="Your demo changes stay saved in this browser. Pick any role again to continue."
      confirmLabel="Switch role"
      pending={signOut.isPending}
      onConfirm={() => signOut.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
    />
  )
}
