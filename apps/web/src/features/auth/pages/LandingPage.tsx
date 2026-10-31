import type { Role } from '@cityreach/shared'
import { ArrowRight, Building2, Loader2, UserRound, UsersRound, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { preloadHomePages } from '@/app/preload'
import { homePathFor } from '@/app/routes'
import { Wordmark } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'
import { useDemoPeople, useSignIn } from '../queries'
import { useSession } from '../session'

interface RoleCard {
  role: Role
  title: string
  icon: LucideIcon
  blurb: string
  points: string[]
}

const ROLES: RoleCard[] = [
  {
    role: 'owner',
    title: 'Owner',
    icon: Building2,
    blurb: 'The whole business at a glance.',
    points: ['Sales, finance and reports', 'Branches and settings', 'Everything a manager sees'],
  },
  {
    role: 'manager',
    title: 'Manager',
    icon: UsersRound,
    blurb: 'Run the day for the team.',
    points: ['Attendance, rota and leave', 'Tasks, stock and suppliers', 'Approvals and payslips'],
  },
  {
    role: 'employee',
    title: 'Employee',
    icon: UserRound,
    blurb: 'A phone-first view of my shift.',
    points: ['Clock in with a selfie', 'My tasks, rota and pay', 'Leave requests'],
  },
]

const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as React.CSSProperties

/** Branded landing screen: no password, just pick who you want to explore the demo as. */
export function LandingPage() {
  const session = useSession()
  const signIn = useSignIn()
  const people = useDemoPeople()
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [entering, setEntering] = useState<Role | null>(null)

  useEffect(() => {
    const id = setTimeout(preloadHomePages, 300)
    return () => clearTimeout(id)
  }, [])

  const employees = useMemo(
    () => people.data?.filter((p) => p.role === 'employee') ?? [],
    [people.data],
  )
  const owner = people.data?.find((p) => p.role === 'owner')
  const manager = people.data?.find((p) => p.role === 'manager')
  const chosenEmployee = employeeId ?? (employees.find((p) => p.uid === 'maya') ?? employees[0])?.uid

  if (session.status === 'signed_in')
    return <Navigate to={homePathFor(session.user.access.role)} replace />

  const enter = (role: Role) => {
    const uid = { owner: owner?.uid, manager: manager?.uid, employee: chosenEmployee }[role]
    if (!uid) return
    setEntering(role)
    signIn.mutate(uid, { onError: () => setEntering(null) })
  }
  const ready = Boolean(owner && manager && chosenEmployee)

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-brand p-8 text-brand-cream sm:p-12 lg:p-14">
        <div
          className="pointer-events-none absolute -right-40 -bottom-40 size-[34rem] rounded-full border border-brand-cream/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -bottom-20 size-[22rem] rounded-full border border-brand-cream/10"
          aria-hidden
        />
        <Wordmark className="h-4 self-start sm:h-5" />
        <div className="relative my-12 max-w-md space-y-5 lg:my-0">
          <h1 className="animate-fade-up text-4xl leading-[1.08] font-medium sm:text-5xl">
            Every branch, one calm dashboard.
          </h1>
          <p
            className="animate-fade-up text-base leading-relaxed text-brand-cream/70"
            style={delay(90)}
          >
            Staff, attendance, tasks, stock and sales for growing local businesses. This is a live
            demo: explore it as the owner, a manager or an employee.
          </p>
        </div>
        <p className="relative hidden text-xs tracking-wide text-brand-cream/50 lg:block">
          Demo data lives only in your browser. Nothing is sent anywhere.
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-2xl space-y-8">
          <header className="space-y-2">
            <h2 className="text-3xl font-medium">Choose how to explore</h2>
            <p className="text-muted-foreground">
              No password needed. You can switch role any time from the profile menu.
            </p>
          </header>

          <ul className="grid gap-4">
            {ROLES.map(({ role, title, icon: Icon, blurb, points }, i) => (
              <li key={role} className="animate-fade-up" style={delay(150 + i * 80)}>
                <div
                  className={cn(
                    'group rounded-2xl border bg-card p-5 shadow-sm transition duration-300',
                    'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
                  )}
                >
                  <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-cream dark:bg-accent dark:text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <p className="text-sm text-muted-foreground">{blurb}</p>
                      </div>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {points.map((p) => (
                          <li key={p} className="flex items-center gap-1.5">
                            <span className="size-1 rounded-full bg-primary/60" aria-hidden />
                            {p}
                          </li>
                        ))}
                      </ul>
                      {role === 'employee' && employees.length > 0 && (
                        <label className="flex items-center gap-2 text-sm">
                          <span className="whitespace-nowrap text-muted-foreground">Sign in as</span>
                          <select
                            value={chosenEmployee}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="h-9 min-w-0 rounded-lg border bg-background px-2 text-sm"
                          >
                            {employees.map((p) => (
                              <option key={p.uid} value={p.uid}>
                                {p.name} · {p.position}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => enter(role)}
                      disabled={!ready || signIn.isPending}
                      aria-label={`Continue as ${title}`}
                      className="flex h-11 shrink-0 items-center gap-2 self-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60 max-sm:w-full max-sm:justify-center"
                    >
                      {entering === role ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          Enter
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
