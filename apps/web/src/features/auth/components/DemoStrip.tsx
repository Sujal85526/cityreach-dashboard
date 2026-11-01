import { DEMO_LOGINS, DEMO_PASSWORD, seedLoginId, type Role } from '@cityreach/shared'
import {
  ArrowRight,
  Building2,
  Loader2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDemoPeople, useSignIn } from '../queries'

const ROLE: Record<Role, { label: string; icon: LucideIcon; blurb: string }> = {
  owner: { label: 'Owner', icon: Building2, blurb: 'Whole business, branches, finance' },
  manager: { label: 'Manager', icon: UsersRound, blurb: 'Rota, leave, tasks, stock' },
  employee: { label: 'Employee', icon: UserRound, blurb: 'Clock in, my tasks and pay' },
}

/**
 * "Try the demo": the seeded logins and the shared demo password, in plain sight so a client
 * can get in quickly. "Use" fills the form above; "Enter" is the old no-password quick-enter.
 */
export function DemoStrip({ onUse }: { onUse: (loginId: string) => void }) {
  const signIn = useSignIn()
  const people = useDemoPeople()
  const [entering, setEntering] = useState<string | null>(null)
  const [employeeUid, setEmployeeUid] = useState<string | null>(null)

  const employees = useMemo(
    () => people.data?.filter((p) => p.role === 'employee') ?? [],
    [people.data],
  )
  const chosenEmployee = employeeUid ?? 'maya'

  const rows = DEMO_LOGINS.map((login) => {
    const uid = login.role === 'employee' ? chosenEmployee : login.uid
    return { ...login, uid, loginId: login.role === 'employee' ? seedLoginId(uid) : login.loginId }
  })

  return (
    <section
      aria-labelledby="demo-heading"
      className="space-y-4 rounded-2xl border border-dashed bg-muted/50 p-4 sm:p-5"
    >
      <div className="space-y-1">
        <h2 id="demo-heading" className="text-base font-semibold">
          Try the demo
        </h2>
        <p className="text-sm text-muted-foreground">
          Everyone below uses the password{' '}
          <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground select-all">
            {DEMO_PASSWORD}
          </code>
          . Tap <span className="font-medium text-foreground">Use</span> to fill the form, or{' '}
          <span className="font-medium text-foreground">Enter</span> to skip it.
        </p>
      </div>
      <ul className="grid gap-2">
        {rows.map(({ role, loginId, uid }) => {
          const { label, icon: Icon, blurb } = ROLE[role]
          return (
            <li key={role} className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <div className="text-sm font-medium">
                    {label}
                    <span className="ml-2 font-normal text-muted-foreground">
                      ID <code className="font-mono text-[0.8rem] text-foreground">{loginId}</code>
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{blurb}</div>
                </div>
                <div className="flex gap-2 max-sm:w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:flex-1"
                    onClick={() => onUse(loginId)}
                    aria-label={`Use the ${label} login`}
                  >
                    Use
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="max-sm:flex-1"
                    disabled={signIn.isPending}
                    onClick={() => {
                      setEntering(role)
                      signIn.mutate(uid, { onError: () => setEntering(null) })
                    }}
                    aria-label={`Enter as ${label} without typing`}
                  >
                    {entering === role ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <>
                        Enter <ArrowRight aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {role === 'employee' && employees.length > 0 && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <span className="whitespace-nowrap text-muted-foreground">Employee</span>
                  <select
                    value={chosenEmployee}
                    onChange={(e) => setEmployeeUid(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm max-md:h-11"
                  >
                    {employees.map((p) => (
                      <option key={p.uid} value={p.uid}>
                        {p.name} · {p.position}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
