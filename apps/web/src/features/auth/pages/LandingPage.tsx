import { DEMO_PASSWORD } from '@cityreach/shared'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { preloadHomePages } from '@/app/preload'
import { homePathFor } from '@/app/routes'
import { Wordmark } from '@/components/brand/Logo'
import { DemoStrip } from '../components/DemoStrip'
import { FingerprintButton } from '../components/FingerprintButton'
import { LoginForm, type Prefill } from '../components/LoginForm'
import { useSession } from '../session'

const delay = (ms: number) => ({ '--delay': `${ms}ms` }) as React.CSSProperties

/** Branded sign-in screen: ID + password, fingerprint, and a "Try the demo" strip for clients. */
export function LandingPage() {
  const session = useSession()
  const [prefill, setPrefill] = useState<Prefill | null>(null)

  useEffect(() => {
    const id = setTimeout(preloadHomePages, 300)
    return () => clearTimeout(id)
  }, [])

  if (session.status === 'signed_in')
    return <Navigate to={homePathFor(session.user.access.role)} replace />

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
            demo: sign in with an ID and password, or try one of the demo logins.
          </p>
        </div>
        <p className="relative hidden text-xs tracking-wide text-brand-cream/50 lg:block">
          Demo data lives only in your browser. Nothing is sent anywhere.
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md space-y-7">
          <header className="space-y-2">
            <h2 className="text-3xl font-medium">Sign in</h2>
            <p className="text-muted-foreground">
              Use your login ID and password, or the fingerprint set up on this device.
            </p>
          </header>

          <div className="space-y-5">
            <LoginForm prefill={prefill} />
            <div className="flex items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase">
              <span className="h-px flex-1 bg-border" aria-hidden />
              or
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <FingerprintButton />
          </div>

          <DemoStrip
            onUse={(loginId) => setPrefill({ loginId, password: DEMO_PASSWORD, nonce: Date.now() })}
          />
        </div>
      </main>
    </div>
  )
}
