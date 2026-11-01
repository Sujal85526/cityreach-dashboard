import { zodResolver } from '@hookform/resolvers/zod'
import { loginFormSchema, type LoginForm as LoginValues } from '@cityreach/shared'
import { Loader2, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthError } from '../api'
import { useSignInWithPassword } from '../queries'

/** What the "Try the demo" strip puts into the form. */
export interface Prefill {
  loginId: string
  password: string
  /** Changes on every click so the same person can be filled in twice. */
  nonce: number
}

/** ID + password sign-in with inline errors, a show/hide button and a lockout countdown. */
export function LoginForm({ prefill }: { prefill: Prefill | null }) {
  const signIn = useSignInWithPassword()
  const [failure, setFailure] = useState<string | null>(null)
  const [lockedFor, setLockedFor] = useState(0)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { loginId: '', password: '' },
  })
  const { register, handleSubmit, setValue, setFocus, formState } = form

  useEffect(() => {
    if (!prefill) return
    setValue('loginId', prefill.loginId, { shouldValidate: false })
    setValue('password', prefill.password, { shouldValidate: false })
    setFailure(null)
    setFocus('password')
  }, [prefill, setValue, setFocus])

  // Count the lockout down, so the button comes back by itself.
  useEffect(() => {
    if (lockedFor <= 0) return
    const id = setTimeout(() => setLockedFor((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [lockedFor])

  const onSubmit = handleSubmit((values) => {
    setFailure(null)
    signIn.mutate(values, {
      onError: (error) => {
        if (error instanceof AuthError && error.code === 'locked')
          setLockedFor(error.retryAfterSeconds ?? 30)
        setFailure(error instanceof Error ? error.message : 'Could not sign in. Try again.')
        form.resetField('password')
        setFocus('password')
      },
    })
  })

  const { errors } = formState
  const locked = lockedFor > 0
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Sign in">
      <div className="space-y-2">
        <Label htmlFor="login-id">Login ID</Label>
        <Input
          id="login-id"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={Boolean(errors.loginId)}
          aria-describedby={errors.loginId ? 'login-id-error' : undefined}
          {...register('loginId')}
        />
        {errors.loginId && (
          <p id="login-id-error" className="text-sm text-destructive">
            {errors.loginId.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p id="login-password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      {failure && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {locked
            ? `Too many wrong attempts. Try again in ${lockedFor} second${lockedFor === 1 ? '' : 's'}.`
            : failure}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={signIn.isPending || locked}>
        {signIn.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <LogIn aria-hidden />
        )}
        {signIn.isPending ? 'Signing in…' : locked ? `Wait ${lockedFor}s` : 'Sign in'}
      </Button>
    </form>
  )
}
