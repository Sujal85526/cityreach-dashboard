import { zodResolver } from '@hookform/resolvers/zod'
import { Coffee, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router'
import { z } from 'zod'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { preloadHomePages } from '@/app/preload'
import { homePathFor } from '@/app/routes'
import { useSignIn } from '../queries'
import { useSession } from '../session'

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

const HIGHLIGHTS = [
  { value: 'Live', label: 'Attendance' },
  { value: 'Auto', label: 'Alerts' },
  { value: '1', label: 'System' },
]

export function LoginPage() {
  const session = useSession()
  const signIn = useSignIn()
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  useEffect(() => {
    const id = setTimeout(preloadHomePages, 300) // after the login page itself has painted
    return () => clearTimeout(id)
  }, [])

  if (session.status === 'signed_in')
    return <Navigate to={homePathFor(session.user.access.role)} replace />

  const onSubmit = form.handleSubmit((values) => signIn.mutate(values))
  const { errors } = form.formState

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
          aria-hidden
        />
        <Brand />
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl leading-tight font-semibold">
            The smart operations platform for small coffee shops.
          </h1>
          <p className="text-primary-foreground/80">
            Manage employees, attendance, tasks, inventory and performance reports — without hiring
            a full-time manager.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.label}
                className="rounded-xl bg-primary-foreground/10 p-4 ring-1 ring-primary-foreground/15"
              >
                <div className="text-2xl font-semibold">{h.value}</div>
                <div className="text-xs text-primary-foreground/75">{h.label}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Digital Manager
        </p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5" noValidate>
          <div className="lg:hidden">
            <Brand dark />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your workspace to continue.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="h-11"
              {...form.register('email')}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              className="h-11"
              {...form.register('password')}
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
          </div>

          {signIn.error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {friendlyAuthError(signIn.error)}
            </p>
          )}

          <Button type="submit" className="h-11 w-full" disabled={signIn.isPending}>
            {signIn.isPending && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Forgot your password? Ask your manager to reset it.
          </p>
        </form>
      </main>
    </div>
  )
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          dark
            ? 'flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground'
            : 'flex size-9 items-center justify-center rounded-xl bg-primary-foreground text-primary'
        }
      >
        <Coffee className="size-5" />
      </span>
      <div className="leading-tight">
        <div className={'font-semibold'}>Digital Manager</div>
        <div
          className={dark ? 'text-xs text-muted-foreground' : 'text-xs text-primary-foreground/70'}
        >
          Coffee ops platform
        </div>
      </div>
    </div>
  )
}

function friendlyAuthError(error: Error): string {
  const code = (error as { code?: string }).code
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Email or password is incorrect.'
  }
  if (code === 'auth/user-disabled') return 'This account has been deactivated.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.'
  return error.message
}
