import type { User } from '@dm/shared'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/errors'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/features/auth/session'
import { useSendPasswordReset, useSetEmployeeStatus } from '../queries'

interface Props {
  employee: User
  onEdit: (employee: User) => void
}

/** Row "…" menu: profile, edit, password reset, deactivate / reactivate. */
export function EmployeeActions({ employee, onEdit }: Props) {
  const navigate = useNavigate()
  const me = useCurrentUser()
  const setStatus = useSetEmployeeStatus()
  const reset = useSendPasswordReset()
  const inactive = employee.status === 'inactive'

  const [confirming, setConfirming] = useState(false)

  const changeStatus = () =>
    setStatus.mutate(
      { employee, status: inactive ? 'active' : 'inactive' },
      {
        onSuccess: () => {
          setConfirming(false)
          toast.success(`${employee.name} ${inactive ? 'reactivated' : 'deactivated'}`)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  const sendReset = () =>
    reset.mutate(employee.email, {
      onSuccess: () => toast.success(`Password reset email sent to ${employee.email}`),
      onError: (e) => toast.error(errorMessage(e)),
    })

  return (
    <>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Deactivate ${employee.name}?`}
        description="They will be signed out and can no longer sign in. Their history is kept, and you can reactivate them later."
        confirmLabel="Deactivate"
        destructive
        pending={setStatus.isPending}
        onConfirm={changeStatus}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${employee.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => navigate(`/employees/${employee.id}`)}>
            View profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(employee)}>Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={sendReset}>Send password reset</DropdownMenuItem>
          {employee.id !== me.uid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => (inactive ? changeStatus() : setConfirming(true))}
                className={inactive ? undefined : 'text-danger focus:text-danger'}
              >
                {inactive ? 'Reactivate' : 'Deactivate'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
