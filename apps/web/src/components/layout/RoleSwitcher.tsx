import type { Role } from '@cityreach/shared'
import { Check } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useDemoPeople, useSignIn } from '@/features/auth/queries'
import { useCurrentUser } from '@/features/auth/session'

const ORDER: Role[] = ['owner', 'manager', 'employee']
const LABEL: Record<Role, string> = { owner: 'Owner', manager: 'Manager', employee: 'Employee' }

/** Demo-only: jump between roles without a password. Lives in the account menu. */
export function RoleSwitcher() {
  const user = useCurrentUser()
  const people = useDemoPeople().data
  const signIn = useSignIn()
  if (!people) return null

  return (
    <>
      <DropdownMenuLabel className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Switch role
      </DropdownMenuLabel>
      {ORDER.map((role) => {
        // Employees: stay on the current person if already one, otherwise the first employee (Maya).
        const person =
          role === 'employee'
            ? (people.find((p) => p.uid === user.uid && p.role === 'employee') ??
              people.find((p) => p.uid === 'maya') ??
              people.find((p) => p.role === 'employee'))
            : people.find((p) => p.role === role)
        if (!person) return null
        const current = person.uid === user.uid
        return (
          <DropdownMenuItem
            key={role}
            disabled={signIn.isPending}
            onSelect={() => !current && signIn.mutate(person.uid)}
          >
            <span className="flex-1">
              {LABEL[role]} <span className="text-muted-foreground">· {person.name}</span>
            </span>
            {current && <Check className="size-4 text-primary" aria-hidden />}
          </DropdownMenuItem>
        )
      })}
      <DropdownMenuSeparator />
    </>
  )
}
